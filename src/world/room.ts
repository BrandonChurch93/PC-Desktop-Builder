import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { canvas, textures, wrap } from './kit/textures';

const DESK = { w: 3.2, d: 1.2, z: 0.04 };

function radialAlpha(): THREE.Texture {
  const S = 512;
  const { canvas: c, g } = canvas(S, S);
  const grd = g.createRadialGradient(S * 0.5, S * 0.47, S * 0.06, S * 0.5, S * 0.47, S * 0.5);
  grd.addColorStop(0, 'rgba(214,214,214,1)');
  grd.addColorStop(0.55, 'rgba(232,232,232,1)');
  grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return wrap(c, { repeat: false });
}

function wallTexture(): THREE.Texture {
  const S = 512;
  const { canvas: c, g } = canvas(S, S);
  const grd = g.createRadialGradient(S * 0.5, S * 0.62, S * 0.02, S * 0.5, S * 0.62, S * 0.62);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(150,150,160,1)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return wrap(c, { srgb: true, repeat: false });
}

export type RoomLights = { key: THREE.RectAreaLight; fill: THREE.RectAreaLight; side: THREE.RectAreaLight; shadow: THREE.SpotLight; rim: THREE.SpotLight; back: THREE.SpotLight; hemi: THREE.HemisphereLight };

/** The dark studio desk, its mirror, the wall behind, and the studio lights. */
export class Room {
  readonly group = new THREE.Group();
  readonly mirror: Reflector | null;
  readonly lights: RoomLights;
  private desk: THREE.Mesh;
  private base = { key: 7.5, fill: 2.4, side: 1.6, shadow: 6, rim: 9, back: 16, hemi: 0.45 };
  hideInMirror: () => THREE.Object3D[] = () => [];

  constructor(scene: THREE.Scene, mirrorSize: number) {
    this.group.name = 'room';
    const t = textures();
    const mottle = t.mottle.clone(); mottle.repeat.set(DESK.w / 0.32, DESK.d / 0.32); mottle.needsUpdate = true;
    const deskMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1824, metalness: 0, roughness: 1, specularIntensity: 0, map: mottle, transparent: mirrorSize > 0, opacity: mirrorSize > 0 ? 0.84 : 1, alphaMap: mirrorSize > 0 ? radialAlpha() : null });
    mottle.colorSpace = THREE.SRGBColorSpace;
    this.desk = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.036, DESK.d), deskMat);
    this.desk.position.set(0, -0.018, DESK.z);
    this.desk.receiveShadow = true;
    this.desk.name = 'desk';
    this.group.add(this.desk);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.006, 0.006), new THREE.MeshPhysicalMaterial({ color: 0x3a3c44, metalness: 1, roughness: 0.4 }));
    edge.position.set(0, -0.003, DESK.z + DESK.d / 2 - 0.003);
    this.group.add(edge);
    const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x1e1c2b, metalness: 0, roughness: 1, specularIntensity: 0, map: wallTexture() });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), wallMat);
    wall.position.set(0, 1.4, -0.6);
    wall.name = 'wall';
    this.group.add(wall);
    scene.add(this.group);
    scene.background = new THREE.Color(0x07060d);
    scene.fog = new THREE.Fog(0x07060d, 3.4, 9);

    if (mirrorSize > 0) {
      const m = new Reflector(new THREE.PlaneGeometry(DESK.w, DESK.d), { clipBias: 0.001, textureWidth: mirrorSize, textureHeight: mirrorSize, color: 0x55545f });
      const mm = m.material as THREE.ShaderMaterial;
      mm.fragmentShader = mm.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( min( blendOverlay( min( base.rgb, vec3( 1.0 ) ), color ), vec3( 1.0 ) ), 1.0 );');
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, -0.0012, DESK.z);
      const before = m.onBeforeRender.bind(m);
      m.onBeforeRender = (...args: Parameters<typeof m.onBeforeRender>) => {
        const hidden = this.hideInMirror().filter((o) => o.visible);
        for (const o of hidden) o.visible = false;
        before(...args);
        for (const o of hidden) o.visible = true;
      };
      this.group.add(m);
      this.mirror = m;
    } else {
      this.mirror = null;
      const shade = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: 0x020205, transparent: true, opacity: 0.55, depthWrite: false, alphaMap: radialAlpha() }));
      shade.rotation.x = -Math.PI / 2; shade.position.set(0, 0.0005, 0);
      this.group.add(shade);
    }

    const key = new THREE.RectAreaLight(0xfff1e4, this.base.key, 1.3, 1.0);
    key.position.set(0.7, 1.5, 1.5); key.lookAt(0, 0.25, 0);
    const fill = new THREE.RectAreaLight(0xdfe6ff, this.base.fill, 1.2, 0.8);
    fill.position.set(-0.3, 1.7, 0.1); fill.lookAt(0, 0.3, 0);
    const side = new THREE.RectAreaLight(0xe8ecff, this.base.side, 0.5, 1.2);
    side.position.set(-1.3, 0.6, 1.2); side.lookAt(0, 0.3, 0);
    const shadow = new THREE.SpotLight(0xfff1e6, this.base.shadow, 6, 0.45, 0.9, 2);
    shadow.position.set(0.9, 1.55, 1.75); shadow.target.position.set(0, 0.22, 0);
    shadow.castShadow = true; shadow.shadow.mapSize.set(2048, 2048); shadow.shadow.bias = -0.0002; shadow.shadow.normalBias = 0.0015;
    shadow.shadow.radius = 10; shadow.shadow.blurSamples = 20; shadow.shadow.camera.near = 0.8; shadow.shadow.camera.far = 4.2;
    shadow.shadow.autoUpdate = false; shadow.shadow.needsUpdate = true;
    const rim = new THREE.SpotLight(0x8fa2ff, this.base.rim, 6, 0.5, 0.9, 2);
    rim.position.set(-1.4, 1.1, -0.3); rim.target.position.set(0, 0.3, 0);
    const back = new THREE.SpotLight(0x6f78c8, this.base.back, 5, 0.75, 1, 2);
    back.position.set(0.2, 1.9, 0.5); back.target.position.set(0, 0.45, -0.6);
    const hemi = new THREE.HemisphereLight(0x2a2450, 0x05040a, this.base.hemi);
    for (const l of [key, fill, side, shadow, rim, back, hemi]) this.group.add(l);
    for (const l of [shadow, rim, back]) this.group.add(l.target);
    this.lights = { key, fill, side, shadow, rim, back, hemi };
  }

  /** Bench lighting is a little brighter, Showcase drops the softboxes so the rig's own light carries the frame. */
  setLevel(k: number) {
    const L = this.lights; const b = this.base;
    L.key.intensity = b.key * k; L.fill.intensity = b.fill * k; L.side.intensity = b.side * k; L.shadow.intensity = b.shadow * k;
    L.rim.intensity = b.rim * (0.6 + 0.4 * k); L.back.intensity = b.back * (0.7 + 0.3 * k); L.hemi.intensity = b.hemi * (0.7 + 0.3 * k);
  }

  updateShadow() { this.lights.shadow.shadow.needsUpdate = true; }
}
