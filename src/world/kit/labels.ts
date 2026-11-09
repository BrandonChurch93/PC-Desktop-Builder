import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, wrap } from './textures';
import { drawText, measure, type TextStyle } from './type';
import type { PartBuilder } from './geometry';

type Item = {
  wMm: number; hMm: number;
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  m: THREE.Matrix4; target: THREE.Object3D | null;
  lit: { tex: THREE.Texture; intensity: number; uAxis: 'x' } | null;
  rough: number;
};

export type LabelOpts = { color?: string; align?: 'left' | 'center' | 'right'; to?: THREE.Object3D; lit?: { tex: THREE.Texture; intensity: number }; rough?: number };

const PPM_TEXT = 22;
const scratch = (() => { let c: CanvasRenderingContext2D | null = null; return () => { if (!c) c = canvas(8, 8).g; return c; }; })();

/** Collects every printed mark of one part, packs them into one atlas texture, and adds them as a few meshes. */
export class Labels {
  private items: Item[] = [];
  constructor(private pb: PartBuilder, private ppm = PPM_TEXT) {}

  /** Text of cap height hMm (the plane is a little taller). Returns its size in mm. */
  text(text: string, style: TextStyle, hMm: number, m: THREE.Matrix4, opts: LabelOpts = {}): { w: number; h: number } {
    const px = 100;
    const wPx = measure(scratch(), text, style, px);
    const planeH = hMm * 1.45;
    const wMm = (wPx / px) * hMm * 1.38 + hMm * 0.9;
    const shift = opts.align === 'left' ? wMm / 2 : opts.align === 'right' ? -wMm / 2 : 0;
    const mm = shift ? m.clone().multiply(new THREE.Matrix4().makeTranslation(shift, 0, 0)) : m;
    this.items.push({
      wMm, hMm: planeH,
      draw: (g, w, h) => {
        const fpx = (h / planeH) * hMm * 1.38;
        drawText(g, text, style, (hMm * 0.45 * w) / wMm, h / 2, fpx, opts.lit ? 'rgba(250,250,250,1)' : opts.color ?? '#d8dade');
      },
      m: mm, target: opts.to ?? null, lit: opts.lit ? { ...opts.lit, uAxis: 'x' } : null, rough: opts.rough ?? 0.45,
    });
    return { w: wMm, h: planeH };
  }

  /** Any drawing on a wMm by hMm plane centered at the matrix origin, facing +z. */
  draw(wMm: number, hMm: number, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void, m: THREE.Matrix4, opts: LabelOpts = {}) {
    this.items.push({ wMm, hMm, draw: fn, m, target: opts.to ?? null, lit: opts.lit ? { ...opts.lit, uAxis: 'x' } : null, rough: opts.rough ?? 0.45 });
  }

  finish() {
    const groups = new Map<string, Item[]>();
    for (const it of this.items) {
      const key = `${it.target ? it.target.uuid : 'root'}|${it.lit ? it.lit.tex.uuid : 'print'}|${it.rough}`;
      const list = groups.get(key) ?? [];
      list.push(it);
      groups.set(key, list);
    }
    for (const list of groups.values()) this.bake(list);
    this.items = [];
  }

  private bake(list: Item[]) {
    const pad = 4;
    const W = Math.max(...list.map((it) => it.wMm * this.ppm)) > 2040 ? 4096 : 2048;
    // A label wider than the atlas would have its cell clamped while its text keeps its size, and the text would be cut off.
    const widest = Math.max(...list.map((it) => it.wMm * this.ppm));
    let scale = Math.min(1, (W - pad * 2) / widest);
    let rects: { x: number; y: number; w: number; h: number }[] = [];
    let H = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      rects = []; let x = pad; let y = pad; let row = 0;
      for (const it of list) {
        const w = Math.min(W - pad * 2, Math.floor(it.wMm * this.ppm * scale));
        const h = Math.ceil(it.hMm * this.ppm * scale);
        if (x + w + pad > W) { x = pad; y += row + pad; row = 0; }
        rects.push({ x, y, w, h });
        x += w + pad; row = Math.max(row, h);
      }
      H = y + row + pad;
      if (H <= 4096) break;
      scale *= Math.sqrt(4096 / H) * 0.98;
    }
    const height = Math.max(8, Math.ceil(H / 4) * 4);
    const { canvas: c, g } = canvas(W, height);
    list.forEach((it, i) => {
      const r = rects[i]!;
      g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip(); g.translate(r.x, r.y);
      if (it.lit) { g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, r.w, r.h); }
      it.draw(g, r.w, r.h);
      g.restore();
    });
    const tex = this.pb.own(wrap(c, { srgb: true, repeat: false }));
    tex.premultiplyAlpha = !list[0]!.lit;
    const geos: THREE.BufferGeometry[] = [];
    list.forEach((it, i) => {
      const r = rects[i]!;
      const p = new THREE.PlaneGeometry(it.wMm, it.hMm);
      const uv = p.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) {
        const u = uv.getX(k); const v = uv.getY(k);
        uv.setXY(k, (r.x + u * r.w) / W, 1 - (r.y + (1 - v) * r.h) / height);
      }
      if (it.lit) {
        const uv1 = new Float32Array(uv.count * 2);
        for (let k = 0; k < uv.count; k++) { uv1[k * 2] = 0.08 + 0.84 * (p.getAttribute('uv').getX(k) - r.x / W) / (r.w / W); uv1[k * 2 + 1] = 0.5; }
        p.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
      }
      p.applyMatrix4(it.m);
      geos.push(p);
    });
    const first = list[0]!;
    const material = first.lit
      ? new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.4, metalness: 0, alphaMap: tex, emissive: 0xffffff, emissiveMap: first.lit.tex, emissiveIntensity: first.lit.intensity, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: first.rough, metalness: 0, transparent: true, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    if (first.lit) { tex.colorSpace = THREE.NoColorSpace; }
    material.name = first.lit ? 'label-lit' : 'label';
    this.pb.own(material);
    const merged = mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x), false);
    for (const geo of geos) geo.dispose();
    if (!merged) return;
    const mesh = this.pb.mesh(merged, material, undefined, { uv: 'keep', to: first.target ?? undefined });
    mesh.renderOrder = 2;
    mesh.userData.label = true;
    mesh.userData.flexible = true;
  }
}
