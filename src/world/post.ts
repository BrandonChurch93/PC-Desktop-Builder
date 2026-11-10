import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import type { Tier } from '../state/store';
import { seeded } from './kit/rng';

export const TIER_SETTINGS: Record<Tier, { pixelRatio: number; msaa: number; ao: 'full' | 'half' | 'off'; bloomHalf: boolean; mirror: number; shadow: number; lamps: number; texScale: number; detail: number; dashes: number }> = {
  high: { pixelRatio: 2, msaa: 4, ao: 'full', bloomHalf: false, mirror: 1024, shadow: 2048, lamps: 8, texScale: 1, detail: 1, dashes: 1 },
  medium: { pixelRatio: 1.5, msaa: 2, ao: 'half', bloomHalf: false, mirror: 512, shadow: 1024, lamps: 5, texScale: 0.75, detail: 1, dashes: 0.6 },
  low: { pixelRatio: 1.25, msaa: 0, ao: 'off', bloomHalf: true, mirror: 0, shadow: 1024, lamps: 3, texScale: 0.5, detail: 0.7, dashes: 0.3 },
};

/** Seeded denoise noise, so the occlusion pass draws the same pixels on every load. */
function seededNoise(size = 64): THREE.DataTexture {
  const r = seeded(4242);
  const simplex = new SimplexNoise({ random: r });
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const k = (i * size + j) * 4;
    data[k] = (simplex.noise(i, j) * 0.5 + 0.5) * 255;
    data[k + 1] = (simplex.noise(i + size, j) * 0.5 + 0.5) * 255;
    data[k + 2] = (simplex.noise(i, j + size) * 0.5 + 0.5) * 255;
    data[k + 3] = (simplex.noise(i + size, j + size) * 0.5 + 0.5) * 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return t;
}

const AO_MIX = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, tAO: { value: null as THREE.Texture | null }, tExempt: { value: null as THREE.Texture | null }, intensity: { value: 1.0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform sampler2D tExempt; uniform float intensity; varying vec2 vUv;',
    'void main() {',
    '  vec4 src = texture2D(tDiffuse, vUv); vec3 c = src.rgb;',
    '  float ao = texture2D(tAO, vUv).r;',
    '  if (isnan(ao) || isinf(ao)) ao = 1.0;',
    '  ao = mix(ao, 1.0, texture2D(tExempt, vUv).r);',
    '  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);',
    '  gl_FragColor = vec4(min(c, vec3(6.0)) * mix(1.0, clamp(ao, 0.0, 1.0), intensity), 1.0);',
    '}',
  ].join('\n'),
};

/** Reads the renderer's counters right after the scene pass: the scene's own cost, its shadow and mirror renders included. */
class CountPass extends Pass {
  calls = 0;
  triangles = 0;
  constructor() { super(); this.needsSwap = false; }
  render(renderer: THREE.WebGLRenderer) { this.calls = renderer.info.render.calls; this.triangles = renderer.info.render.triangles; }
}

/** Occlusion reach in meters for the room views. */
export const AO_RADIUS = 0.03;

/** Camera layer used only to draw the occlusion exempt mask. */
const AO_EXEMPT_LAYER = 7;

export class Post {
  readonly composer: EffectComposer;
  readonly render: RenderPass;
  readonly count = new CountPass();
  gtao: GTAOPass | null = null;
  aoMix: ShaderPass | null = null;
  readonly bloom: UnrealBloomPass;
  smaa: SMAAPass | null = null;
  readonly output: OutputPass;
  /** objects hidden while the occlusion pass renders depth and normals */
  hideForAO: () => THREE.Object3D[] = () => [];
  /**
   * LED diffusers. They stay in the depth the occlusion pass reads, and their own pixels take no occlusion. Hidden from that
   * pass instead, the occlusion of the part behind a bar was printed over the bar, so the bars read as clear plastic.
   */
  aoExempt: () => THREE.Object3D[] = () => [];
  private exemptTarget = new THREE.WebGLRenderTarget(4, 4);
  private exemptMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  private tier: Tier;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, tier: Tier) {
    this.tier = tier;
    const s = TIER_SETTINGS[tier];
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: s.msaa, stencilBuffer: true });
    this.composer = new EffectComposer(renderer, rt);
    this.render = new RenderPass(scene, camera);
    this.composer.addPass(this.render);
    this.composer.addPass(this.count);
    if (s.ao !== 'off') {
      const gtao = new GTAOPass(scene, camera, 4, 4);
      gtao.blendIntensity = 1;
      gtao.updateGtaoMaterial({ radius: AO_RADIUS, distanceExponent: 1.3, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 0.85, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      const noise = seededNoise();
      gtao.pdMaterial.uniforms.tNoise!.value = noise;
      gtao.output = GTAOPass.OUTPUT.Off;
      gtao.needsSwap = false;
      const base = gtao.render.bind(gtao);
      gtao.render = (r, w, rd, dt, mask) => {
        const hidden = this.hideForAO().filter((o) => o.visible);
        for (const o of hidden) o.visible = false;
        base(r, w, rd, dt, mask);
        for (const o of hidden) o.visible = true;
        this.renderExempt(r, gtao);
      };
      const mix = new ShaderPass(AO_MIX);
      mix.uniforms.tAO!.value = gtao.gtaoMap;
      mix.uniforms.tExempt!.value = this.exemptTarget.texture;
      this.composer.addPass(gtao);
      this.composer.addPass(mix);
      this.gtao = gtao; this.aoMix = mix;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.33, 0.42, 1.6);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    if (s.msaa === 0) { this.smaa = new SMAAPass(); this.composer.addPass(this.smaa); }
  }

  private renderExempt(renderer: THREE.WebGLRenderer, gtao: GTAOPass) {
    const t = this.exemptTarget;
    const depth = gtao.depthTexture;
    if (t.depthTexture !== depth || t.width !== gtao.width || t.height !== gtao.height) {
      t.dispose();
      t.depthTexture = depth;
      t.setSize(gtao.width, gtao.height);
    }
    const objects = this.aoExempt().filter((o) => o.visible);
    const color = renderer.getClearColor(new THREE.Color()); const alpha = renderer.getClearAlpha(); const auto = renderer.autoClear;
    renderer.setRenderTarget(t);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    if (objects.length) {
      const scene = gtao.scene; const camera = gtao.camera;
      for (const o of objects) o.layers.enable(AO_EXEMPT_LAYER);
      const mask = camera.layers.mask; const bg = scene.background;
      camera.layers.set(AO_EXEMPT_LAYER); scene.background = null; scene.overrideMaterial = this.exemptMaterial;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      scene.overrideMaterial = null; scene.background = bg; camera.layers.mask = mask;
    }
    renderer.autoClear = auto; renderer.setClearColor(color, alpha);
  }

  /**
   * The Inspector shows one part close, where 16 occlusion samples left a visible dither on pale curved plastic; it takes 32
   * and a wider denoise. The room keeps 16 for its frame time.
   */
  setScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera, close = false) {
    this.render.scene = scene; this.render.camera = camera;
    if (this.gtao) {
      this.gtao.scene = scene; this.gtao.camera = camera;
      this.gtao.updateGtaoMaterial({ samples: close ? 32 : 16 });
      this.gtao.updatePdMaterial({ radius: close ? 10 : 6, samples: close ? 32 : 16 });
    }
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    if (this.gtao && TIER_SETTINGS[this.tier].ao === 'half') this.gtao.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2));
    if (TIER_SETTINGS[this.tier].bloomHalf) this.bloom.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2));
  }

  dispose() {
    this.composer.dispose();
    this.gtao?.dispose();
    this.exemptTarget.dispose(); this.exemptMaterial.dispose();
    this.bloom.dispose();
  }
}
