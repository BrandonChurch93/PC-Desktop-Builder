import * as THREE from 'three';
import type { Category } from '../data/catalog';
import { lathe } from './kit/geometry';
import { canvas, wrap } from './kit/textures';
import { RgbEngine } from './light/rgb';
import { inspectPart } from './parts';
import type { GenOpts, PartObject } from './parts/types';

const MM = 0.001;
const FOV = 30;

/** How each category stands on the turntable: its rotation so its face looks at the camera and its natural top is up. */
const POSE: Record<Category, [number, number, number]> = {
  case: [0, 0, 0],
  board: [0, 0, 0],
  cpu: [-Math.PI / 2, 0, 0],
  cooler: [0, 0, 0],
  ram: [-Math.PI / 2, 0, -Math.PI / 2],
  gpu: [-Math.PI / 2, 0, 0],
  storage: [0, 0, 0],
  psu: [0, 0, 0],
  fan: [0, Math.PI, 0],
  cables: [0, 0, 0],
};

function backdrop(): THREE.Texture {
  const W = 1024; const H = 1024;
  const { canvas: c, g } = canvas(W, H);
  const grd = g.createRadialGradient(W * 0.5, H * 0.42, W * 0.04, W * 0.5, H * 0.5, W * 0.72);
  grd.addColorStop(0, 'rgba(36,33,48,1)');
  grd.addColorStop(0.55, 'rgba(18,16,26,1)');
  grd.addColorStop(1, 'rgba(9,8,13,1)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  return wrap(c, { srgb: true, repeat: false });
}

/** The part alone on a slow turntable over a dark gradient, lit by neutral softboxes. */
export class Inspector {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.005, 20);
  readonly rgb: RgbEngine;
  readonly table = new THREE.Group();
  readonly holder = new THREE.Group();
  part: PartObject | null = null;
  key = '';
  private radius = 0.1;
  private center = new THREE.Vector3();
  private size = new THREE.Vector3();
  private disc: THREE.Mesh;
  angle = 0;
  zoom = 0;
  elevation = 0.32;
  focus: [number, number, number] | null = null;
  flip = false;

  constructor(env: THREE.Texture) {
    this.scene.background = backdrop();
    this.scene.environment = env;
    this.scene.environmentIntensity = 1.25;
    const key = new THREE.RectAreaLight(0xfff8f0, 4.6, 1.0, 0.8); key.position.set(0.9, 1.0, 1.1); key.lookAt(0, 0.1, 0);
    const fill = new THREE.RectAreaLight(0xe8eeff, 3.2, 0.8, 0.8); fill.position.set(-1.1, 0.5, 0.6); fill.lookAt(0, 0.1, 0);
    const rim = new THREE.RectAreaLight(0xf0f2ff, 10, 1.4, 0.35); rim.position.set(-0.3, 0.9, -1.1); rim.lookAt(0, 0.1, 0);
    const top = new THREE.RectAreaLight(0xffffff, 1.1, 0.9, 0.9); top.position.set(0, 1.4, 0.1); top.lookAt(0, 0, 0);
    const spot = new THREE.SpotLight(0xffffff, 1.4, 5, 1.0, 1, 2); spot.position.set(0.5, 1.6, 0.8); spot.castShadow = false;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.radius = 8; spot.shadow.blurSamples = 16; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.002;
    this.scene.add(key, fill, rim, top, spot, spot.target, new THREE.HemisphereLight(0x3a3650, 0x0a0a10, 0.6));
    this.disc = new THREE.Mesh(lathe([[0, -0.02], [0.96, -0.02], [1, -0.012], [1, -0.002], [0.985, 0], [0, 0]], 96), new THREE.MeshPhysicalMaterial({ color: 0x0c0b10, metalness: 0, roughness: 0.78, specularIntensity: 0.35 }));
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.receiveShadow = true;
    this.table.add(this.disc, this.holder);
    this.scene.add(this.table);
    this.rgb = new RgbEngine(this.scene, false);
    this.rgb.lampCount = 4;
    this.rgb.power = 1;
  }

  show(category: Category, id: string, opts: GenOpts, flip: boolean) {
    const key = `${category}|${id}|${JSON.stringify(opts)}|${flip}`;
    if (key !== this.key) {
      this.clear();
      const part = inspectPart(category, id, opts);
      this.part = part;
      this.key = key;
      part.root.scale.setScalar(MM);
      const pose = category === 'storage' && id === 'nvme' ? [-Math.PI / 2, 0, 0] as [number, number, number] : POSE[category];
      const orient = new THREE.Group();
      orient.rotation.set(...pose);
      if (flip) orient.rotateX(Math.PI);
      orient.add(part.root);
      this.holder.add(orient);
      part.root.traverse((o) => { if (o instanceof THREE.Mesh && !o.userData.label) { o.castShadow = true; o.receiveShadow = true; } });
      this.holder.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const b of part.boxes) {
        const corners = [
          new THREE.Vector3(b.min[0], b.min[1], b.min[2]), new THREE.Vector3(b.max[0], b.max[1], b.max[2]),
          new THREE.Vector3(b.min[0], b.max[1], b.min[2]), new THREE.Vector3(b.max[0], b.min[1], b.max[2]),
          new THREE.Vector3(b.min[0], b.min[1], b.max[2]), new THREE.Vector3(b.max[0], b.max[1], b.min[2]),
          new THREE.Vector3(b.min[0], b.max[1], b.max[2]), new THREE.Vector3(b.max[0], b.min[1], b.min[2]),
        ];
        for (const c of corners) box.expandByPoint(c.applyMatrix4(part.root.matrixWorld));
      }
      if (box.isEmpty()) box.setFromObject(part.root);
      box.getCenter(this.center); box.getSize(this.size);
      orient.position.set(-this.center.x, -box.min.y + 0.004, -this.center.z);
      this.center.set(0, this.size.y / 2 + 0.004, 0);
      this.radius = Math.max(0.02, this.size.length() / 2);
      const r = Math.max(this.size.x, this.size.z) * 0.62 + 0.012;
      this.disc.scale.set(r, r, 1);
      this.holder.updateMatrixWorld(true);
      for (const z of part.zones) if (!z.owner) z.owner = part.root;
      this.rgb.setZones(part.zones, new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, this.center.y, 0), this.size));
    }
    this.flip = flip;
  }

  clear() {
    if (this.part) {
      this.holder.clear();
      this.part.dispose();
      this.part = null;
      this.key = '';
    }
  }

  /** Places the camera from the turntable angle, zoom and focus. */
  frame(aspect: number) {
    this.camera.aspect = aspect;
    this.table.rotation.y = (this.angle * Math.PI) / 180;
    const fovR = (FOV * Math.PI) / 360;
    const fit = Math.max(this.radius / Math.sin(fovR), (this.radius / Math.sin(fovR)) / Math.min(1, aspect)) * 1.02;
    const near = 0.12;
    const d = Math.exp(Math.log(fit) + (Math.log(near) - Math.log(fit)) * this.zoom);
    const target = this.center.clone();
    if (this.focus) {
      this.table.updateMatrixWorld(true);
      const local = new THREE.Vector3((this.focus[0] - 0.5) * this.size.x, (this.focus[1] - 0.5) * this.size.y, (this.focus[2] - 0.5) * this.size.z).add(this.center);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.table.rotation.y);
      target.lerp(local, Math.min(1, this.zoom * 1.4));
    }
    const dir = new THREE.Vector3(0, Math.sin(this.elevation), Math.cos(this.elevation));
    this.camera.position.copy(target).addScaledVector(dir, d);
    this.camera.near = Math.max(0.004, d * 0.05); this.camera.far = d * 12 + 2;
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }

  get distance() { return this.camera.position.distanceTo(this.center); }
}
