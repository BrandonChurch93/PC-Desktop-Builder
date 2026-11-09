import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { canvas, textures, wrap } from './kit/textures';

const DESK = { w: 3.2, d: 1.2, z: 0.04 };
const FLAG_LAYER = 1;

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

/** A soft rounded footprint for contact shading under the case. */
function contactAlpha(): THREE.Texture {
  const S = 256;
  const { canvas: c, g } = canvas(S, S);
  g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, S, S);
  g.filter = 'blur(20px)';
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath(); g.roundRect(S * 0.18, S * 0.18, S * 0.64, S * 0.64, S * 0.06); g.fill();
  g.filter = 'none';
  return wrap(c, { repeat: false });
}

/** The soft pool of cool light on the wall behind the rig, drawn on the wall so it lights only the wall. */
function wallPool(): THREE.Texture {
  const S = 512;
  const { canvas: c, g } = canvas(S, S);
  g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, S, S);
  // The wall is 9 m wide and 4 m tall with its bottom at y -0.6: this puts an ellipse about 2.4 by 1.6 m centered 0.45 m up.
  g.save(); g.translate(S * 0.5, S * 0.74); g.scale(0.667, 1);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(150,150,150,1)');
  grd.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, S * 0.2, 0, Math.PI * 2); g.fill();
  g.restore();
  return wrap(c, { srgb: true, repeat: false });
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

export type RoomLights = { key: THREE.RectAreaLight; fill: THREE.RectAreaLight; side: THREE.RectAreaLight; shadow: THREE.SpotLight; kick: THREE.SpotLight; rim: THREE.SpotLight; back: THREE.SpotLight; hemi: THREE.HemisphereLight };

/** The dark studio desk, its mirror, the wall behind, and the studio lights. */
export class Room {
  readonly group = new THREE.Group();
  readonly mirror: Reflector | null;
  readonly lights: RoomLights;
  private desk: THREE.Mesh;
  private contact: THREE.Mesh;
  private base = { key: 7.5, fill: 1.2, side: 1.6, shadow: 34, kick: 7, rim: 13, back: 14, hemi: 0.55 };
  private flag: THREE.Mesh;
  private sideFlag: THREE.Mesh;
  hideInMirror: () => THREE.Object3D[] = () => [];

  constructor(scene: THREE.Scene, mirrorSize: number) {
    this.group.name = 'room';
    const t = textures();
    const mottle = t.mottle.clone(); mottle.repeat.set(DESK.w / 0.32, DESK.d / 0.32); mottle.needsUpdate = true;
    const deskMat = new THREE.MeshPhysicalMaterial({ color: 0x2b2840, metalness: 0, roughness: 1, specularIntensity: 0, map: mottle, transparent: mirrorSize > 0, opacity: mirrorSize > 0 ? 0.8 : 1, alphaMap: mirrorSize > 0 ? radialAlpha() : null });
    mottle.colorSpace = THREE.SRGBColorSpace;
    this.desk = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.036, DESK.d), deskMat);
    this.desk.position.set(0, -0.018, DESK.z);
    this.desk.receiveShadow = true;
    this.desk.name = 'desk';
    this.group.add(this.desk);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(DESK.w, 0.006, 0.006), new THREE.MeshPhysicalMaterial({ color: 0x3a3c44, metalness: 1, roughness: 0.4 }));
    edge.position.set(0, -0.003, DESK.z + DESK.d / 2 - 0.003);
    this.group.add(edge);
    // A neutral grey wall: its blue comes from the backdrop light, so the rig's glow can tint it any color.
    const wallMat = new THREE.MeshPhysicalMaterial({ color: 0x34333c, metalness: 0, roughness: 1, specularIntensity: 0, map: wallTexture(), emissive: 0x201d52, emissiveMap: wallPool(), emissiveIntensity: 1 });
    // 27 m wide so its ends lie past the fog: a 9 m wall showed its end as a hard vertical edge from the front view.
    for (const t of [wallMat.map, wallMat.emissiveMap]) if (t) { t.repeat.set(3, 1); t.offset.set(-1, 0); }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(27, 4), wallMat);
    wall.position.set(0, 1.4, -0.6);
    wall.name = 'wall';
    this.group.add(wall);
    scene.add(this.group);
    scene.background = new THREE.Color(0x07060d);
    scene.fog = new THREE.Fog(0x07060d, 3.4, 9);

    if (mirrorSize > 0) {
      const m = new Reflector(new THREE.PlaneGeometry(DESK.w, DESK.d), { clipBias: 0.001, textureWidth: mirrorSize, textureHeight: mirrorSize, color: 0x86839c });
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

    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x030206, transparent: true, opacity: 0.72, depthWrite: false, alphaMap: contactAlpha() }));
    this.contact.rotation.x = -Math.PI / 2; this.contact.position.y = 0.0006; this.contact.renderOrder = 1; this.contact.visible = false;
    this.contact.name = 'contact';
    this.group.add(this.contact);

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
    // A soft kicker on the rear face, level with the wall so it does not paint it. It casts shadows: an area light here lit
    // the inside of the case through the rear panel.
    const kick = new THREE.SpotLight(0xd6dbff, this.base.kick, 5, 0.2, 1, 2);
    kick.position.set(-1.45, 0.3, -0.03); kick.target.position.set(-0.23, 0.19, -0.03);
    kick.shadow.camera.layers.enable(FLAG_LAYER);
    kick.castShadow = true; kick.shadow.mapSize.set(1024, 1024); kick.shadow.bias = -0.0002; kick.shadow.normalBias = 0.0015;
    kick.shadow.radius = 8; kick.shadow.blurSamples = 16; kick.shadow.camera.near = 0.6; kick.shadow.camera.far = 3.2;
    kick.shadow.autoUpdate = false; kick.shadow.needsUpdate = true;
    const rim = new THREE.SpotLight(0xb8c2ff, this.base.rim, 6, 0.85, 1, 2);
    // Behind the wall plane: it rims the case from behind and cannot light the wall, where it drew a hard band in the front view.
    rim.position.set(-1.3, 2.0, -0.64); rim.target.position.set(0, 0.3, 0);
    const back = new THREE.SpotLight(0x7a74d0, this.base.back, 6, 0.7, 1, 2);
    back.position.set(0.2, 1.9, 0.5); back.target.position.set(0, 0.45, -0.6);
    const hemi = new THREE.HemisphereLight(0x2a2450, 0x05040a, this.base.hemi);
    for (const l of [key, fill, side, shadow, kick, rim, back, hemi]) this.group.add(l);
    for (const l of [shadow, kick, rim, back]) this.group.add(l.target);
    this.lights = { key, fill, side, shadow, kick, rim, back, hemi };
    // A flag inside the rear panel above the supply, seen only by the kicker's shadow camera, as a photographer flags a
    // light: the kicker lights the rear face, and its light through the rear openings drew glints inside the case.
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.flag.layers.set(FLAG_LAYER); this.flag.castShadow = true; this.flag.visible = false;
    this.sideFlag = this.flag.clone(); this.sideFlag.layers.set(FLAG_LAYER);
    this.group.add(this.flag, this.sideFlag);
  }

  /** Bench lighting is a little brighter, Showcase drops the softboxes so the rig's own light carries the frame. */
  setLevel(k: number) {
    const L = this.lights; const b = this.base;
    L.key.intensity = b.key * k; L.fill.intensity = b.fill * k; L.side.intensity = b.side * k; L.shadow.intensity = b.shadow * k;
    L.rim.intensity = b.rim * (0.6 + 0.4 * k); L.kick.intensity = b.kick * (0.6 + 0.4 * k); L.back.intensity = b.back * (0.7 + 0.3 * k); L.hemi.intensity = b.hemi * (0.7 + 0.3 * k);
  }

  /** The flag covers the rear face of the case from the top of the supply up. */
  setRearFlag(caseBox: THREE.Box3 | null, supplyBox: THREE.Box3 | null) {
    if (!caseBox || caseBox.isEmpty()) { this.flag.visible = false; this.sideFlag.visible = false; return; }
    const y0 = supplyBox && !supplyBox.isEmpty() ? supplyBox.max.y + 0.002 : caseBox.min.y + 0.01; const y1 = caseBox.max.y - 0.006;
    const z0 = caseBox.min.z + 0.006; const z1 = caseBox.max.z - 0.006;
    this.flag.visible = true;
    this.flag.position.set(caseBox.min.x + 0.008, (y0 + y1) / 2, (z0 + z1) / 2);
    this.flag.rotation.set(0, Math.PI / 2, 0);
    this.flag.scale.set(z1 - z0, y1 - y0, 1);
    // And one just inside the glass, so the kicker cannot reach into the case through it.
    this.sideFlag.visible = true;
    this.sideFlag.position.set((caseBox.min.x + caseBox.max.x) / 2, (caseBox.min.y + caseBox.max.y) / 2, caseBox.max.z - 0.012);
    this.sideFlag.rotation.set(0, 0, 0);
    this.sideFlag.scale.set(caseBox.max.x - caseBox.min.x - 0.012, caseBox.max.y - caseBox.min.y - 0.012, 1);
    this.lights.kick.shadow.needsUpdate = true;
  }

  updateShadow() { this.lights.shadow.shadow.needsUpdate = true; this.lights.kick.shadow.needsUpdate = true; }

  /** Contact shading under whatever stands on the desk, sized to its footprint. */
  setFootprint(box: THREE.Box3 | null) {
    if (!box || box.isEmpty()) { this.contact.visible = false; return; }
    this.contact.visible = true;
    this.contact.position.set((box.min.x + box.max.x) / 2, 0.0006, (box.min.z + box.max.z) / 2);
    this.contact.scale.set((box.max.x - box.min.x) / 0.64 * 1.02, (box.max.z - box.min.z) / 0.64 * 1.08, 1);
  }
}
