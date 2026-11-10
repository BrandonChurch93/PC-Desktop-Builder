import * as THREE from 'three';
import { getCooler, getRam, type Category } from '../data/catalog';
import { lathe } from './kit/geometry';
import { canvas, wrap } from './kit/textures';
import { RgbEngine } from './light/rgb';
import type { Zone } from './light/zones';
import { inspectPart } from './parts';
import type { GenOpts, PartObject } from './parts/types';

const MM = 0.001;
const GLOW_GAIN = 0.55;
// A longer lens than the room camera, as product photography uses, so boxes keep their proportions.
const FOV = 22;

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

/**
 * The LEDs' light on the turntable, computed per texel from every emitter: its color, its distance, the way it faces and
 * the angle it reaches the disc at. A ring of the average color lit the disc the same everywhere, even behind the part.
 */
const GLOW_N = 64;
type GlowSource = { p: THREE.Vector3; n: THREE.Vector3; k: number; zone: Zone };
class TurntableGlow {
  readonly tex: THREE.DataTexture;
  private data = new Uint8Array(GLOW_N * GLOW_N * 4);
  private geo: Float32Array = new Float32Array(0);
  private sources: GlowSource[] = [];
  private zones: Zone[] = [];
  private norm = 1;
  constructor() {
    this.tex = new THREE.DataTexture(this.data, GLOW_N, GLOW_N);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.colorSpace = THREE.NoColorSpace;
  }

  /** Sources in turntable space; half is the half size of the glow plane, centered on the turntable axis. */
  build(sources: GlowSource[], half: number) {
    this.sources = sources;
    this.zones = [...new Set(sources.map((s) => s.zone))];
    const zi = new Map(this.zones.map((z, i) => [z, i]));
    const nz = this.zones.length;
    this.geo = new Float32Array(GLOW_N * GLOW_N * Math.max(1, nz));
    const d = new THREE.Vector3(); let peak = 0;
    for (let j = 0; j < GLOW_N; j++) for (let i = 0; i < GLOW_N; i++) {
      const x = ((i + 0.5) / GLOW_N * 2 - 1) * half; const z = ((j + 0.5) / GLOW_N * 2 - 1) * half;
      const u = Math.abs((i + 0.5) / GLOW_N * 2 - 1); const v = Math.abs((j + 0.5) / GLOW_N * 2 - 1);
      const edge = Math.max(0, Math.min(1, (1 - Math.pow(Math.pow(u, 4) + Math.pow(v, 4), 0.25)) / 0.3));
      const t = (j * GLOW_N + i) * nz; let sum = 0;
      for (const s of sources) {
        d.set(x - s.p.x, -s.p.y, z - s.p.z);
        // Softened by 5 cm: a diffuser a few millimeters above the disc otherwise drew a hard bright line under itself.
        const r2 = d.lengthSq() + 0.0025; const len = Math.sqrt(r2);
        const facing = Math.max(0, s.n.dot(d) / len);
        const down = Math.max(0, s.p.y / len);
        const g = s.k * (0.06 + facing) * (0.15 + down) / r2 * edge * edge * (3 - 2 * edge);
        const at = t + zi.get(s.zone)!;
        this.geo[at] = (this.geo[at] ?? 0) + g; sum += g;
      }
      peak = Math.max(peak, sum);
    }
    this.norm = peak > 0 ? 1 / peak : 0;
  }

  update(gain: number) {
    const nz = this.zones.length;
    for (let p = 0; p < GLOW_N * GLOW_N; p++) {
      let r = 0; let g = 0; let b = 0;
      for (let k = 0; k < nz; k++) { const w = this.geo[p * nz + k]!; const c = this.zones[k]!.avg; r += c.r * w; g += c.g * w; b += c.b * w; }
      const s = this.norm * gain * 255;
      this.data[p * 4] = Math.min(255, r * s); this.data[p * 4 + 1] = Math.min(255, g * s); this.data[p * 4 + 2] = Math.min(255, b * s); this.data[p * 4 + 3] = 255;
    }
    this.tex.needsUpdate = true;
  }

  get empty() { return this.sources.length === 0; }
  dispose() { this.tex.dispose(); }
}

/** A soft rounded blob for contact shade. */
function blobAlpha(): THREE.Texture {
  const S = 128; const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!; const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = Math.abs((x + 0.5) / S - 0.5) * 2; const v = Math.abs((y + 0.5) / S - 0.5) * 2;
    const d = Math.pow(Math.pow(u, 4) + Math.pow(v, 4), 0.25);
    const k = 1 - Math.max(0, Math.min(1, (d - 0.55) / 0.45));
    const i = (y * S + x) * 4; const val = Math.round(255 * k * k);
    img.data[i] = val; img.data[i + 1] = val; img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

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
  private glow: THREE.Mesh;
  private shade: THREE.Mesh;
  private light = new TurntableGlow();
  private lights: { key: THREE.RectAreaLight; fill: THREE.RectAreaLight; rim: THREE.RectAreaLight; sheen: THREE.RectAreaLight };
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
    const rim = new THREE.RectAreaLight(0xf0f2ff, 2.2, 1.4, 0.35); rim.position.set(-0.5, 0.45, -1.25); rim.lookAt(0, 0.08, 0);
    const top = new THREE.RectAreaLight(0xffffff, 1.1, 0.9, 0.9); top.position.set(0, 1.4, 0.1); top.lookAt(0, 0, 0);
    const spot = new THREE.SpotLight(0xffffff, 1.4, 5, 1.0, 1, 2); spot.position.set(0.5, 1.6, 0.8); spot.castShadow = false;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.radius = 8; spot.shadow.blurSamples = 16; spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.002;
    void top;
    // A broad softbox seen in a case's large side panels, so a dark panel shows a soft sheen and not a flat slab.
    const sheen = new THREE.RectAreaLight(0xeef0ff, 0, 1.8, 1.2); sheen.position.set(-1.4, 1.1, 0.9); sheen.lookAt(0, 0.2, 0);
    this.scene.add(sheen);
    this.lights = { key, fill, rim, sheen };
    this.scene.add(key, fill, rim, spot, spot.target, new THREE.HemisphereLight(0x3a3650, 0x0a0a10, 0.6));
    this.disc = new THREE.Mesh(lathe([[0, -0.02], [0.96, -0.02], [1, -0.012], [1, -0.002], [0.985, 0], [0, 0]], 96), new THREE.MeshPhysicalMaterial({ color: 0x24232c, metalness: 0, roughness: 0.7, specularIntensity: 0.4 }));
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.receiveShadow = true;
    this.table.add(this.disc, this.holder);
    this.scene.add(this.table);
    // The LEDs' light on the turntable is a soft colored ring drawn around the part, and its contact is a soft shade under it.
    // A real lamp this close to the disc drew a hard edged footprint and lit the part's own underside.
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, map: this.light.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.0004; this.glow.renderOrder = 1;
    this.shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050407, alphaMap: blobAlpha(), transparent: true, opacity: 0.75, depthWrite: false }));
    // The contact shade draws over the LED glow: occlusion darkens every light near the part's base, the glow included.
    this.shade.rotation.x = -Math.PI / 2; this.shade.position.y = 0.0006; this.shade.renderOrder = 2;
    this.table.add(this.glow, this.shade);
    this.rgb = new RgbEngine(this.scene, false);
    this.rgb.lampCount = 4;
    this.rgb.lampGain = 1.7;
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
      // An air cooler and a flat M.2 drive stand up from the board along their z.
      const air = category === 'cooler' && getCooler(id)?.type !== 'aio';
      // An air cooler turns its fan toward the camera's front angle, which is set for a liquid cooler's fan side.
      const pose: [number, number, number] = air ? [-Math.PI / 2, 0, Math.PI] : category === 'storage' && id === 'nvme' ? [-Math.PI / 2, 0, 0] : POSE[category];
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
      // The part stands on its lowest real surface: collision boxes have margins, and standing on them left every part
      // floating 4 mm over the disc, or let a cooler's tubes dip into it.
      let floor = Infinity;
      const gb = new THREE.Box3();
      part.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.spill || o.userData.label || o.userData.glass) return;
        if (o instanceof THREE.InstancedMesh) { o.computeBoundingBox(); gb.copy(o.boundingBox!).applyMatrix4(o.matrixWorld); }
        else { o.geometry.computeBoundingBox(); gb.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld); }
        floor = Math.min(floor, gb.min.y);
      });
      if (!Number.isFinite(floor)) floor = box.min.y;
      orient.position.set(-this.center.x, -floor + 0.0002, -this.center.z);
      this.center.set(0, this.size.y / 2 + 0.004, 0);
      this.radius = Math.max(0.02, this.size.length() / 2);
      const r = Math.max(this.size.x, this.size.z) * 0.62 + 0.012;
      this.disc.scale.set(r, r, 1);
      // Boxes that stand flat on the disc throw a wider contact shade; a tight one stayed hidden under their footprint.
      const sk = category === 'case' || category === 'psu' ? 1.42 : 1.15;
      // A part that stands on a thin edge, such as a memory stick, still gets a shade band a few centimeters wide.
      // A stick that lies flat, such as an M.2 drive, needs a wider shade to show past its edges.
      const flat = category === 'storage' && id === 'nvme' ? 1.5 : 1;
      this.shade.scale.set(this.size.x * sk * flat, Math.max(this.size.z * sk * flat, category === 'ram' ? 0.07 : 0), 1);
      (this.shade.material as THREE.MeshBasicMaterial).opacity = flat > 1 ? 0.92 : category === 'ram' ? 0.96 : 0.75;
      const gs = Math.max(this.size.x, this.size.z) * 2.6;
      this.glow.scale.set(gs, gs, 1);
      this.holder.updateMatrixWorld(true);
      for (const z of part.zones) if (!z.owner) z.owner = part.root;
      const toTable = new THREE.Matrix4().copy(this.table.matrixWorld).invert();
      const sources: GlowSource[] = [];
      for (const z of part.zones) {
        const m = toTable.clone().multiply(z.owner!.matrixWorld);
        const q = new THREE.Quaternion(); new THREE.Matrix4().extractRotation(m).decompose(new THREE.Vector3(), q, new THREE.Vector3());
        const sc = new THREE.Vector3(); m.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
        for (const e of z.emitters) sources.push({ p: e.center.clone().applyMatrix4(m), n: e.normal.clone().applyQuaternion(q).normalize(), k: e.weight * e.w * e.h * sc.x * sc.x, zone: z });
      }
      // The glow plane lies in the turntable's frame; its texture runs +x right and +z toward v = 1 after the plane is laid flat.
      for (const s of sources) s.p.z = -s.p.z, s.n.z = -s.n.z;
      this.light.build(sources, gs / 2);
      this.glow.visible = !this.light.empty;
      this.rgb.setZones(part.zones, new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, this.center.y, 0), this.size));
    }
    this.flip = flip;
    // A case is large and black: as a studio would, it gets more light than a small part so its frame separates from the backdrop.
    const big = category === 'case';
    // A card is long and dark too, as is an unlit black memory kit: a stronger rim and the sheen softbox trace their edges
    // against the backdrop and light the disc around them, so their contact shade reads.
    const long = category === 'gpu' || (category === 'ram' && getRam(id)?.lit === false);
    this.lights.key.intensity = big ? 6.6 : 4.6; this.lights.fill.intensity = big ? 4.6 : 3.2; this.lights.rim.intensity = big ? 4.4 : long ? 3.6 : 2.2; this.lights.sheen.intensity = big ? 3.2 : long ? 1.6 : 0;
    this.scene.environmentIntensity = big ? 1.7 : 1.25;
    // A card's hero surfaces are its backplate and its glass facing edge, so the camera stands higher to show that edge.
    this.elevation = category === 'cpu' || category === 'storage' ? 0.62 : category === 'board' ? 0.2 : category === 'gpu' ? 0.5 : 0.32;
  }

  /** Sub-pixel geometry the occlusion pass must not see in the Inspector. */
  /**
   * Meshes the occlusion pass must not see: sub-pixel fins, and every decal (labels, LED spill, the turntable glow and
   * shade). A decal lies a fraction of a millimeter over its surface, and the pass read its edge as a step and drew a straight
   * line across flat faces.
   */
  noAO(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [this.glow, this.shade];
    this.part?.root.traverse((o) => { if (o.userData.noAO || o.userData.spill || o.userData.label || o.userData.glass) out.push(o); });
    return out;
  }

  /** The turntable glow follows the LEDs that face it. */
  updateGlow() {
    if (this.glow.visible) this.light.update(GLOW_GAIN);
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
