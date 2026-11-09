import * as THREE from 'three';
import { ledTexture } from './textures.js';

const tmp = new THREE.Color();
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

export class Rgb {
  constructor() {
    this.zones = [];
    this.effect = 'wave';
    this.speed = 0.6;
    this.brightness = 0.85;
    this.time = 0;
    this.on = true;
    this.power = 1;
    this.stops = ['#ff2bd1', '#7b3dff', '#18e0ff'].map((h) => new THREE.Color(h));
    this.extent = { min: -0.26, max: 0.26 };
  }

  gradient(x, out) {
    const n = this.stops.length;
    const f = ((x % 1) + 1) % 1 * n;
    const i = Math.floor(f), k = f - i;
    return out.copy(this.stops[i % n]).lerp(this.stops[(i + 1) % n], k * k * (3 - 2 * k));
  }

  addZone({ name, count, ring = false, from, to, center, phase = 0, intensity = 3.2 }) {
    const tex = ledTexture(count, ring);
    const zone = { name, count, ring, from, to, center, phase, tex, avg: new THREE.Color(), listeners: [], id: this.zones.length, intensity };
    this.zones.push(zone);
    return zone;
  }

  ledWorldX(z, i) {
    const u = z.count > 1 ? i / (z.count - 1) : 0;
    if (z.ring) return z.center.x + Math.cos((i / z.count) * Math.PI * 2) * (z.center.r || 0.05);
    return z.from.x + (z.to.x - z.from.x) * u;
  }

  ledWorldY(z, i) {
    const u = z.count > 1 ? i / (z.count - 1) : 0;
    if (z.ring) return z.center.y + Math.sin((i / z.count) * Math.PI * 2) * (z.center.r || 0.05);
    return z.from.y + (z.to.y - z.from.y) * u;
  }

  update(dt) {
    this.time += dt;
    const t = this.time * this.speed;
    const span = this.extent.max - this.extent.min;
    for (const z of this.zones) {
      const d = z.tex.image.data;
      let ar = 0, ag = 0, ab = 0;
      for (let i = 0; i < z.count; i++) {
        const u = z.ring ? i / z.count : (z.count > 1 ? i / (z.count - 1) : 0);
        const pn = (this.ledWorldX(z, i) - this.extent.min) / span + this.ledWorldY(z, i) * 0.6;
        let k = 1;
        switch (this.effect) {
          case 'static': this.gradient(pn * 0.66, tmp); break;
          case 'breathing': this.gradient(pn * 0.66, tmp); k = 0.12 + 0.88 * (0.5 + 0.5 * Math.sin(t * 2.4)); break;
          case 'spectrum': tmp.setHSL((t * 0.12) % 1, 1, 0.5); break;
          case 'wave': this.gradient(pn * 0.8 - t * 0.35, tmp); break;
          case 'comet': {
            const head = (t * 0.6 + z.phase) % 1;
            const dist = ((head - u) % 1 + 1) % 1;
            this.gradient(z.phase + t * 0.05, tmp);
            k = Math.exp(-dist * 7) + 0.04;
            break;
          }
          case 'starlight': {
            const h = hash(z.id * 31 + i);
            this.gradient(h, tmp);
            k = 0.08 + Math.pow(Math.max(0, Math.sin(t * 2.2 + h * 6.283)), 14);
            break;
          }
          case 'thermal': {
            const heat = THREE.MathUtils.clamp(0.35 + 0.3 * Math.sin(t * 0.5 + z.phase * 4) + (z.heat || 0), 0, 1);
            tmp.setHSL(0.62 - heat * 0.62, 1, 0.5);
            break;
          }
          default: tmp.setRGB(1, 1, 1);
        }
        k *= this.brightness * this.power * (this.on ? 1 : 0);
        const r = tmp.r * k, g = tmp.g * k, b = tmp.b * k;
        ar += r; ag += g; ab += b;
        d[i * 4] = Math.round(THREE.MathUtils.clamp(Math.pow(r, 1 / 2.2), 0, 1) * 255);
        d[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(Math.pow(g, 1 / 2.2), 0, 1) * 255);
        d[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(Math.pow(b, 1 / 2.2), 0, 1) * 255);
      }
      z.tex.needsUpdate = true;
      z.avg.setRGB(ar / z.count, ag / z.count, ab / z.count);
      for (const fn of z.listeners) fn(z.avg);
    }
  }
}
