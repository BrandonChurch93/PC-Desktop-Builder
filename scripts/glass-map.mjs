// Prints, for each camera, what the side glass of the Vitrine reflects from a set of cards: an ASCII map of the light
// the glass adds (Fresnel times card radiance), so card placement can be designed before rendering.
//
//   node scripts/glass-map.mjs <cams.json> <cards.json>
//
// cams.json: [[name, { position, target }], ...] as __pcb.camera() returns them. cards.json: the GLASS_CARDS list.
import fs from 'node:fs';
import process from 'node:process';

const [camsFile, cardsFile] = process.argv.slice(2);
const cams = JSON.parse(fs.readFileSync(camsFile, 'utf8'));
const cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
const FOV = 30; const ASPECT = 1.6;
const G = { x0: -0.226, x1: 0.226, y0: 0.02, y1: 0.496, z: 0.1165 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

function frame(card) {
  const n = norm(sub(card.look, card.pos));
  let u = norm(cross(Math.abs(n[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0], n));
  let v = cross(n, u);
  const t = card.tilt ?? 0;
  const ct = Math.cos(t); const st = Math.sin(t);
  [u, v] = [add(mul(u, ct), mul(v, st)), add(mul(v, ct), mul(u, -st))];
  return { n, u, v };
}
const framed = cards.map((c) => ({ ...c, ...frame(c) }));

function radiance(p, r) {
  let sum = 0;
  for (const c of framed) {
    const den = dot(r, c.n);
    if (den >= -1e-4) continue;
    const t = dot(sub(c.pos, p), c.n) / den;
    if (t <= 0) continue;
    const h = sub(add(p, mul(r, t)), c.pos);
    const a = Math.abs(dot(h, c.u)) / (c.w / 2); const b = dot(h, c.v) / (c.h / 2);
    const e = c.edge ?? 0.3;
    const k = smooth((1 - a) / e) * smooth((1 - Math.abs(b)) / e) * (1 - (c.grad ?? 0) * (1 - b) / 2);
    sum += c.k * k;
  }
  return sum;
}

function project(cam, p) {
  const f = norm(sub(cam.target, cam.position)); const s = norm(cross(f, [0, 1, 0])); const up = cross(s, f);
  const d = sub(p, cam.position); const z = dot(d, f);
  const th = Math.tan((FOV * Math.PI) / 360);
  return [dot(d, s) / z / (th * ASPECT), dot(d, up) / z / th];
}

const ramp = ' .:-=+*#';
const cuts = [0.004, 0.01, 0.02, 0.035, 0.05, 0.08, 0.12];
for (const [name, cam] of cams) {
  const rows = []; let n = 0; let total = 0; let peak = 0; let lit = 0;
  for (let y = G.y1 - 0.01; y > G.y0; y -= 0.02) {
    let line = '';
    for (let x = G.x0 + 0.01; x < G.x1; x += 0.0196) {
      const p = [x, y, G.z];
      const [sx, sy] = project(cam, p);
      if (Math.abs(sx) > 1 || Math.abs(sy) > 1) { line += '~'; continue; }
      const d = norm(sub(p, cam.position));
      const r = [d[0], d[1], -d[2]];
      const cos = Math.max(0, -d[2]);
      const F = 0.04 + 0.96 * Math.pow(1 - cos, 5);
      const dist = Math.hypot(...sub(p, cam.position));
      const v = F * radiance(p, r) * smooth((dist - 0.6) / 0.5);
      n++; total += v; peak = Math.max(peak, v); if (v >= 0.01) lit++;
      line += ramp[cuts.findIndex((c) => v < c) === -1 ? 7 : cuts.findIndex((c) => v < c)];
    }
    rows.push(line);
  }
  console.log(`${name}  mean ${(total / Math.max(1, n)).toFixed(4)}  peak ${peak.toFixed(3)}  lit ${Math.round((100 * lit) / Math.max(1, n))}%`);
  for (const l of rows) console.log('  |' + l + '|');
}
