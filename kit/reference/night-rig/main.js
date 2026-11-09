import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { gsap } from 'gsap';
import { makeTextures } from './textures.js';
import { makeMaterials } from './materials.js';
import { Rgb } from './rgb.js';
import { D, buildCase, buildGlass, buildBoard, buildRam, buildGpu, buildCooler, buildCables, buildFan, buildRoom } from './parts.js';

const Q = new URLSearchParams(location.search);
const frozen = Q.has('t') ? parseFloat(Q.get('t')) : null;
if (Q.get('ui') === '0') document.body.classList.add('no-ui');

await Promise.all([document.fonts.load('700 40px "Unbounded"'), document.fonts.load('600 40px "DM Sans"')]);

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.25 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[Q.get('tm') || 'aces'];
renderer.toneMappingExposure = parseFloat(Q.get('exp') || '1.15');

RectAreaLightUniformsLib.init();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060d);
scene.fog = new THREE.Fog(0x07060d, 3.2, 9);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 0.22; controls.maxDistance = 2.6;
controls.maxPolarAngle = Math.PI * 0.497;
controls.zoomToCursor = true;

const CAMS = {
  hero: { p: [0.68, 0.52, 1.3], t: [0.0, 0.245, 0] },
  front: { p: [1.5, 0.42, 0.72], t: [0, 0.25, 0] },
  side: { p: [0, 0.3, 1.7], t: [0, 0.26, 0] },
  top: { p: [0.3, 1.25, 0.95], t: [0, 0.3, 0] },
  rear: { p: [-1.25, 0.5, 0.9], t: [0, 0.26, 0] },
  gpu: { p: [0.12, 0.36, 0.5], t: [-0.03, 0.262, 0.03] },
  ram: { p: [0.2, 0.44, 0.32], t: [-0.03, 0.35, -0.03] },
  pump: { p: [-0.02, 0.4, 0.36], t: [-0.115, 0.353, -0.02] },
  board: { p: [0.04, 0.2, 0.42], t: [-0.07, 0.18, -0.06] },
  fan: { p: [0.5, 0.33, 0.3], t: [0.215, 0.207, 0] },
  cable: { p: [0.26, 0.34, 0.34], t: [0.03, 0.33, -0.03] },
};
function setCam(name, animate = false) {
  const c = CAMS[name] || CAMS.hero;
  if (!animate) { camera.position.set(...c.p); controls.target.set(...c.t); controls.update(); return; }
  gsap.to(camera.position, { x: c.p[0], y: c.p[1], z: c.p[2], duration: 1.6, ease: 'power3.inOut' });
  gsap.to(controls.target, { x: c.t[0], y: c.t[1], z: c.t[2], duration: 1.6, ease: 'power3.inOut' });
}
setCam(Q.get('cam') || 'hero');

const T = makeTextures();
const M = makeMaterials(T);
const rgb = new Rgb();
const ctx = { M, T, rgb, rotors: [] };
if (Q.get('effect')) rgb.effect = Q.get('effect');

const rig = new THREE.Group();
rig.scale.setScalar(0.001);
scene.add(rig);

const P = {};
P.case = buildCase(ctx);
P.glass = buildGlass(ctx);
P.board = buildBoard(ctx);
P.ram = new THREE.Group();
P.ram.add(buildRam(ctx, -31, 0), buildRam(ctx, -13, 1));
P.gpu = buildGpu(ctx);
const cooler = buildCooler(ctx);
P.pump = cooler.pump; P.rad = cooler.rad; P.tubes = cooler.tubes;
P.cables = buildCables(ctx);
P.front = new THREE.Group();
[85, 207, 329].forEach((y, i) => {
  const f = buildFan(ctx, { name: 'front-' + i, world: { x: 215, y } });
  f.rotation.y = -Math.PI / 2; f.position.set(205, y, 0);
  P.front.add(f);
});
P.rearFan = buildFan(ctx, { name: 'rear', world: { x: -214, y: 370 } });
P.rearFan.rotation.y = Math.PI / 2; P.rearFan.position.set(D.xr + 15, 370, 5);
P.room = buildRoom(ctx);
for (const k in P) rig.add(P[k]);
rig.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
P.room.traverse((o) => { o.castShadow = false; });

const mirror = new Reflector(new THREE.PlaneGeometry(3.2, 1.18), { clipBias: 0.001, textureWidth: 1024, textureHeight: 1024, color: 0x5a5a66 });
mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -0.0015, 0.04);
mirror.material.fragmentShader = mirror.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( min( blendOverlay( min( base.rgb, vec3( 1.0 ) ), color ), vec3( 1.0 ) ), 1.0 );');
const glassSpec = []; P.glass.traverse((o) => { if (o.userData.spec) glassSpec.push(o); });
const mirrorRender = mirror.onBeforeRender;
mirror.onBeforeRender = function (...a) { for (const o of glassSpec) o.visible = false; mirrorRender.apply(this, a); for (const o of glassSpec) o.visible = true; };
if (Q.get('mirror') !== '0') scene.add(mirror);

const key = new THREE.SpotLight(0xfff1e6, 15, 6, 0.42, 0.85, 2);
key.position.set(0.9, 1.55, 1.75); key.target.position.set(0, 0.22, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.0012; key.shadow.radius = 9; key.shadow.blurSamples = 16;
key.shadow.camera.near = 0.8; key.shadow.camera.far = 4.2;
scene.add(key, key.target);
const rim = new THREE.SpotLight(0x8fa2ff, 14, 6, 0.5, 0.9, 2);
rim.position.set(-1.4, 1.1, -0.3); rim.target.position.set(0, 0.3, 0);
scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(0x2a2450, 0x05040a, 0.4));
const soft = new THREE.RectAreaLight(0xfff4ea, 7.5, 1.3, 1.0);
soft.position.set(0.7, 1.5, 1.5); soft.lookAt(0, 0.25, 0);
scene.add(soft);
const back = new THREE.SpotLight(0x6f78c8, 16, 5, 0.75, 1, 2);
back.position.set(0.2, 1.9, 0.5); back.target.position.set(0, 0.45, -0.62);
scene.add(back, back.target);
const softTop = new THREE.RectAreaLight(0xdfe6ff, 2.2, 1.2, 0.8);
softTop.position.set(-0.3, 1.7, 0.1); softTop.lookAt(0, 0.3, 0);
scene.add(softTop);

const LAMPS = [
  { zones: ['front-0', 'front-1', 'front-2'], w: 0.12, h: 0.36, pos: [0.185, 0.207, 0], to: [-1, 0.207, 0], k: 2.4 },
  { zones: ['front-0', 'front-1', 'front-2'], w: 0.12, h: 0.36, pos: [0.24, 0.207, 0], to: [2, 0.05, 0], k: 2.2 },
  { zones: ['top-0', 'top-1', 'top-2'], w: 0.36, h: 0.12, pos: [0, 0.44, 0], down: true, k: 5 },
  { zones: ['rear'], w: 0.11, h: 0.11, pos: [-0.2, 0.37, 0.005], to: [1, 0.37, 0.005], k: 5 },
  { zones: ['gpu-bar'], w: 0.25, h: 0.014, pos: [-0.066, 0.271, 0.074], to: [-0.066, 0.2, 2], k: 16 },
  { zones: ['ram-0', 'ram-1'], w: 0.03, h: 0.128, pos: [-0.022, 0.344, -0.016], to: [-0.022, 0.344, 2], k: 9 },
  { zones: ['pump'], w: 0.066, h: 0.066, pos: [-0.115, 0.353, -0.006], to: [-0.115, 0.353, 2], k: 7 },
  { zones: ['top-0', 'top-1', 'top-2', 'rear', 'front-1', 'gpu-bar'], w: 0.5, h: 0.46, pos: [0, 0.27, -0.13], to: [0, 0.5, -2], k: 4.2 },
];
const lamps = LAMPS.map((l) => {
  const light = new THREE.RectAreaLight(0xffffff, 0, l.w, l.h);
  light.position.set(...l.pos);
  if (l.down) light.rotation.x = -Math.PI / 2; else light.lookAt(...l.to);
  scene.add(light);
  return { ...l, light, z: l.zones.map((n) => rgb.zones.find((z) => z.name === n)).filter(Boolean) };
});

const size = new THREE.Vector2();
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: parseInt(Q.get('msaa') || '4', 10) });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 4, 4);
gtao.blendIntensity = 1;
gtao.updateGtaoMaterial({ radius: 0.035, distanceExponent: 1.2, thickness: 1.1, scale: parseFloat(Q.get('aos') || '1'), samples: 16, distanceFallOff: 0.9, screenSpaceRadius: false });
const gtaoRender = gtao.render.bind(gtao);
gtao.render = (...a) => { P.glass.visible = false; mirror.visible = false; gtaoRender(...a); P.glass.visible = state.glass; mirror.visible = true; };
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.33, 0.42, parseFloat(Q.get('thr') || '1.6'));
gtao.output = GTAOPass.OUTPUT.Off;
gtao.needsSwap = false;
const aoMix = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tAO: { value: null }, intensity: { value: 1.0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform float intensity; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; float ao = texture2D(tAO, vUv).r; if (isnan(ao) || isinf(ao)) ao = 1.0; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(6.0)) * mix(1.0, clamp(ao, 0.0, 1.0), intensity), 1.0); }',
});
aoMix.uniforms.tAO.value = gtao.gtaoMap;
if (Q.get('ao') !== '0') { composer.addPass(gtao); composer.addPass(aoMix); }
if (Q.get('bloom') !== '0') composer.addPass(bloom);
composer.addPass(new OutputPass());

const state = { glass: Q.get('glass') !== '0', power: true, explode: 0, gpuIn: true, mode: 'build' };
P.glass.visible = state.glass;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  renderer.getDrawingBufferSize(size);
  composer.setSize(w, h);
  camera.aspect = w / h;
  const lift = document.body.classList.contains('no-ui') || w < 900 ? 0 : -h * 0.07;
  camera.setViewOffset(w, h, 0, -lift, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const EX = {
  glass: [0, 0, 190], gpu: [0, -6, 170], ram: [0, 0, 120], pump: [0, 0, 150], tubes: [0, 30, 150], rad: [0, 150, 0],
  front: [140, 0, 0], rearFan: [-110, 0, 0], board: [0, 0, 46], cables: [0, 0, 0],
};
const base = {}; for (const k in EX) base[k] = P[k].position.clone();
const gpuOff = new THREE.Vector3();
function applyExplode() {
  for (const k in EX) P[k].position.copy(base[k]).addScaledVector(new THREE.Vector3(...EX[k]), state.explode);
  P.gpu.position.add(gpuOff);
  P.cables.visible = state.explode < 0.02 && state.gpuIn;
  P.tubes.visible = state.explode < 0.02;
}
if (Q.get('explode') === '1') state.explode = 1;
applyExplode();

function toggleGpu() {
  const card = document.getElementById('gpuCard'), label = document.getElementById('gpuState');
  const tl = gsap.timeline({ onUpdate: applyExplode });
  if (state.gpuIn) {
    state.gpuIn = false;
    tl.to(gpuOff, { z: 34, duration: 0.35, ease: 'power2.out' })
      .to(gpuOff, { z: 300, y: -200, x: 60, duration: 1.1, ease: 'power3.inOut' });
    card.classList.remove('is-installed'); label.textContent = 'Fits · tap to install'; label.className = 'fit';
    document.getElementById('gpuStat').textContent = 'None'; document.getElementById('gpuStatSub').textContent = 'Integrated graphics';
  } else {
    tl.to(gpuOff, { z: 34, y: 0, x: 0, duration: 1.1, ease: 'power3.inOut' })
      .to(gpuOff, { z: 0, duration: 0.42, ease: 'back.out(2.2)' })
      .add(() => { state.gpuIn = true; applyExplode(); });
    card.classList.add('is-installed'); label.textContent = 'Installed · tap to remove'; label.className = '';
    document.getElementById('gpuStat').textContent = '322 mm'; document.getElementById('gpuStatSub').textContent = 'of 400 mm clearance';
  }
}

const FX = ['Static', 'Breathing', 'Spectrum', 'Wave', 'Comet', 'Starlight', 'Thermal'];
const fxEl = document.getElementById('fx');
FX.forEach((n) => {
  const b = document.createElement('button');
  b.textContent = n; b.dataset.fx = n.toLowerCase();
  if (b.dataset.fx === rgb.effect) b.classList.add('is-on');
  b.onclick = () => { rgb.effect = b.dataset.fx; fxEl.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b)); };
  fxEl.appendChild(b);
});
const bind = (id, out, fn) => { const el = document.getElementById(id); el.oninput = () => { fn(+el.value); document.getElementById(out).textContent = Math.round(el.value * 100); }; };
bind('speed', 'speedOut', (v) => { rgb.speed = v; });
bind('bright', 'brightOut', (v) => { rgb.brightness = v; });
const chip = (id, fn) => { const el = document.getElementById(id); el.onclick = () => { const on = !el.classList.contains('is-on'); el.classList.toggle('is-on', on); el.setAttribute('aria-pressed', on); fn(on); }; };
chip('glass', (on) => { state.glass = on; P.glass.visible = on; });
chip('power', (on) => { state.power = on; gsap.to(rgb, { power: on ? 1 : 0, duration: 0.9, ease: 'power2.inOut' }); gsap.to(spin, { v: on ? 1 : 0, duration: on ? 1.8 : 3, ease: 'power2.out' }); });
chip('sync', () => {});
document.getElementById('gpuCard').onclick = toggleGpu;
document.querySelectorAll('.mode').forEach((b) => {
  b.onclick = () => {
    const m = b.dataset.mode;
    if (m === 'share') return;
    document.querySelectorAll('.mode:not(.mode--cta)').forEach((x) => x.classList.toggle('is-on', x === b));
    document.body.classList.toggle('is-showcase', m === 'showcase');
    gsap.to(state, { explode: m === 'exploded' ? 1 : 0, duration: 1.4, ease: 'power3.inOut', onUpdate: applyExplode });
    setCam(m === 'showcase' ? 'front' : m === 'exploded' ? 'top' : 'hero', true);
  };
});

const spin = { v: 1 };
let angle = 0;
const timer = new THREE.Timer();
let frames = 0;
function frame(now) {
  timer.update(now);
  const dt = frozen !== null ? 0 : Math.min(timer.getDelta(), 0.05);
  if (frozen !== null) { rgb.time = frozen; angle = frozen * 9; }
  rgb.update(dt);
  angle += dt * 9 * spin.v;
  for (const r of ctx.rotors) { if (r.axis === 'y') r.rotor.rotation.y = -angle * r.speed; else r.rotor.rotation.z = angle * r.speed; }
  for (const l of lamps) {
    let r = 0, g = 0, b = 0;
    for (const z of l.z) { r += z.avg.r; g += z.avg.g; b += z.avg.b; }
    const n = Math.max(1, l.z.length), peak = Math.max(r, g, b, 1e-4) / n;
    l.light.color.setRGB(r / n / peak, g / n / peak, b / n / peak);
    l.light.intensity = l.k * peak;
  }
  controls.update();
  composer.render();
  frames++;
  if (frames === 3) { window.__ready = true; if (frozen !== null) return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__render = () => { frames = 0; window.__ready = false; requestAnimationFrame(frame); };
window.__dbg = { soft, softTop, key, rim, lamps, explode: (v, cam) => { state.explode = v; applyExplode(); if (cam) setCam(cam); }, scene, camera, controls, rgb, P, state, renderer, setCam };
