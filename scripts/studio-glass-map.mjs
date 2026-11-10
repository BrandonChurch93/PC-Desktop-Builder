// Prints an ASCII map of the light a glass panel in the Inspector reflects from studio cards, as seen from the Inspector
// camera, so cards can be placed before rendering. Same card math as the glass shader and scripts/glass-map.mjs.
//
//   node scripts/studio-glass-map.mjs <view.json> <cards.json>
//
// view.json: { "cam": [x, y, z], "corners": [[x, y, z] x 6] } as shots/peek/altcam.json prints them (two triangles of the
// glass plane in world meters). cards.json: a list of GlassCard.
import fs from 'node:fs';
import process from 'node:process';

const [viewFile, cardsFile] = process.argv.slice(2);
if (!viewFile || !cardsFile) { console.error('usage: node scripts/studio-glass-map.mjs <view.json> <cards.json>'); process.exit(1); }
const view = JSON.parse(fs.readFileSync(viewFile, 'utf8'));
const cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

const pts = view.corners;
const ys = pts.map((p) => p[1]); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
const low = pts.filter((p) => p[1] === y1);
const a = low.reduce((m, p) => (p[0] < m[0] ? p : m)); const b = low.reduce((m, p) => (p[0] > m[0] ? p : m));
const along = sub(b, a);
let n = norm(cross(along, [0, 1, 0]));
if (dot(n, sub(view.cam, a)) < 0) n = mul(n, -1);

const framed = cards.map((c) => {
  const cn = norm(sub(c.look, c.pos));
  let u = norm(cross(Math.abs(cn[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0], cn));
  let v = cross(cn, u);
  const t = c.tilt ?? 0; const ct = Math.cos(t); const st = Math.sin(t);
  [u, v] = [add(mul(u, ct), mul(v, st)), add(mul(v, ct), mul(u, -st))];
  return { ...c, n: cn, u, v };
});

function radiance(p, r) {
  let sum = 0;
  for (const c of framed) {
    const den = dot(r, c.n);
    if (den >= -1e-4) continue;
    const t = dot(sub(c.pos, p), c.n) / den;
    if (t <= 0) continue;
    const h = sub(add(p, mul(r, t)), c.pos);
    const aa = Math.abs(dot(h, c.u)) / (c.w / 2); const bb = dot(h, c.v) / (c.h / 2);
    const e = c.edge ?? 0.3;
    sum += c.k * smooth((1 - aa) / e) * smooth((1 - Math.abs(bb)) / e) * (1 - (c.grad ?? 0) * (1 - bb) / 2);
  }
  return sum;
}

const ramp = ' .:-=+*#';
const cuts = [0.004, 0.01, 0.02, 0.035, 0.05, 0.08, 0.12];
let total = 0; let count = 0; let peak = 0;
const rows = [];
for (let j = 0; j < 24; j++) {
  const y = y1 - ((y1 - y0) * (j + 0.5)) / 24;
  let line = '';
  for (let i = 0; i < 30; i++) {
    const p = add(add(a, mul(along, (i + 0.5) / 30)), [0, y - a[1], 0]);
    const d = norm(sub(p, view.cam));
    const r = sub(d, mul(n, 2 * dot(d, n)));
    const F = 0.04 + 0.96 * Math.pow(1 - Math.max(0, -dot(d, n)), 5);
    const v = F * radiance(p, r);
    total += v; count++; peak = Math.max(peak, v);
    const k = cuts.findIndex((c) => v < c);
    line += ramp[k === -1 ? 7 : k];
  }
  rows.push(line);
}
console.log(`glass from ${a.map((v) => v.toFixed(3))} to ${b.map((v) => v.toFixed(3))}, normal ${n.map((v) => v.toFixed(3))}`);
console.log(`mean ${(total / count).toFixed(4)}  peak ${peak.toFixed(3)}  (left of the map is the first corner)`);
for (const l of rows) console.log('  |' + l + '|');
