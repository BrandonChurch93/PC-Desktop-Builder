import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ledMaterial } from './materials.js';
import { label, rng } from './textures.js';

const PI = Math.PI;
export const NAMES = { caseBrand: 'MIREVALE', gpu: 'VELTRIN', board: 'KORRIN Z7', ram: 'CALYRA', cool: 'KESTRANE', psu: 'THESSIC 850' };
export const D = { xr: -230, xf: 230, y0: 18, y1: 498, zl: 115, zr: -115, tray: -75, bz: -66.9, shroudTop: 118, shroudEnd: 170 };

function rb(w, h, d, r, mat, seg = 3) {
  const rad = Math.max(0.05, Math.min(r, Math.min(w, h, d) / 2 - 0.02));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, rad), mat);
}
function at(m, x, y, z) { m.position.set(x, y, z); return m; }
function cyl(r, h, mat, axis = 'y', seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg);
  if (axis === 'z') g.rotateX(PI / 2);
  if (axis === 'x') g.rotateZ(PI / 2);
  return new THREE.Mesh(g, mat);
}
function rrect(p, x, y, w, h, r) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}
function rectHole(x, y, w, h, r = 1.5) { return rrect(new THREE.Path(), x, y, w, h, r); }
function circHole(x, y, r) { const p = new THREE.Path(); p.absarc(x, y, r, 0, PI * 2, true); return p; }
function poly(pts, P = THREE.Shape) { const s = new P(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function extrude(shape, depth, bevel = 0.5, plane = 'xy') {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 28 });
  if (plane === 'xz') g.rotateX(-PI / 2);
  if (plane === 'zy') g.rotateY(PI / 2);
  return g;
}
function uvAlong(geo, axis) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv;
  const min = b.min[axis], span = b.max[axis] - b.min[axis];
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p['get' + axis.toUpperCase()](i) - min) / span, 0.5);
  return geo;
}
function decal(text, widthMm, { color = '#d7dae0', emissive = null, font, spacing = 6, opacity = 1 } = {}) {
  const l = label(text, { font, color: emissive ? '#ffffff' : color, spacing });
  const mat = emissive
    ? new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: l.tex, emissiveIntensity: 2.6, alphaMap: l.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
    : new THREE.MeshStandardMaterial({ map: l.tex, transparent: true, opacity, roughness: 0.5, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(widthMm, widthMm / l.aspect), mat);
  m.userData.noShadow = true;
  return m;
}
function heatsink(w, h, d, n, mat, finAxis = 'y') {
  const g = new THREE.Group();
  const baseD = d * 0.32;
  g.add(at(rb(w, h, baseD, 1.2, mat), 0, 0, -d / 2 + baseD / 2));
  const along = finAxis === 'y' ? h : w;
  const pitch = along / n, t = pitch * 0.48;
  for (let i = 0; i < n; i++) {
    const o = -along / 2 + pitch * (i + 0.5);
    const fin = finAxis === 'y' ? rb(w, t, d, 0.6, mat, 2) : rb(t, h, d, 0.6, mat, 2);
    g.add(at(fin, finAxis === 'y' ? 0 : o, finAxis === 'y' ? o : 0, 0));
  }
  return g;
}

function bladeGeometry({ r0, r1, c0, c1, pitch0 = 0.82, pitch1 = 0.42, sweep = 0.55, nu = 12, nv = 7 }) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, r = r0 + (r1 - r0) * u;
    const tip = Math.sqrt(1 - Math.pow(Math.max(0, (u - 0.8) / 0.2), 2) * 0.55);
    const chord = (c0 + (c1 - c0) * u) * tip, pitch = pitch0 + (pitch1 - pitch0) * u;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv, s = (v - 0.5) * chord;
      const ang = sweep * u * u + (s * Math.cos(pitch)) / r;
      const camber = chord * 0.09 * (1 - 4 * (v - 0.5) * (v - 0.5));
      pos.push(r * Math.cos(ang), r * Math.sin(ang), s * Math.sin(pitch) + camber);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildFan(ctx, { size = 120, thick = 25, blades = 9, lit = true, name = 'fan', world, brand = NAMES.cool }) {
  const { M, rgb } = ctx;
  const g = new THREE.Group();
  const half = size / 2, hole = half - 3.2;
  const flange = () => {
    const s = rrect(new THREE.Shape(), -half, -half, size, size, 7);
    s.holes.push(circHole(0, 0, hole));
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) s.holes.push(circHole(sx * (half - 7.5), sy * (half - 7.5), 2.2));
    return new THREE.Mesh(extrude(s, 3.4, 0.5), M.plastic);
  };
  g.add(at(flange(), 0, 0, thick / 2 - 3.9));
  g.add(at(flange(), 0, 0, -thick / 2 + 0.5));
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(hole + 2.2, hole + 2.2, thick - 2, 64, 1, true).rotateX(PI / 2), M.plastic);
  shroud.material = M.plastic.clone(); shroud.material.side = THREE.DoubleSide;
  g.add(shroud);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(at(cyl(4.6, thick - 6, M.plastic, 'z', 16), sx * (half - 7.5), sy * (half - 7.5), 0));
    g.add(at(rb(9, 9, 2.2, 1.2, M.rubber), sx * (half - 7.5), sy * (half - 7.5), thick / 2 + 0.4));
  }
  const rotor = new THREE.Group();
  const hubProfile = [[0, 9], [14, 9], [18.2, 7.2], [19.4, 4], [19.4, -8], [0, -8]].map(([r, z]) => new THREE.Vector2(r, z));
  rotor.add(new THREE.Mesh(new THREE.LatheGeometry(hubProfile, 48).rotateX(PI / 2), M.gloss));
  const bladeMat = M.blade.clone();
  const bg = bladeGeometry({ r0: 18.5, r1: hole - 1.6, c0: 17, c1: 43 });
  for (let i = 0; i < blades; i++) { const b = new THREE.Mesh(bg, bladeMat); b.rotation.z = (i / blades) * PI * 2; rotor.add(b); }
  const cap = decal(brand, 22, { color: '#8f94a0', spacing: 4 });
  rotor.add(at(cap, 0, 0, 9.3));
  g.add(rotor);
  g.add(at(cyl(17, 5, M.plastic, 'z', 32), 0, 0, -thick / 2 + 3));
  for (let i = 0; i < 4; i++) {
    const s = rb(hole - 14, 3, 2.4, 1, M.plastic, 2);
    s.position.set(Math.cos(i * PI / 2 + 0.5) * (hole + 16) / 2, Math.sin(i * PI / 2 + 0.5) * (hole + 16) / 2, -thick / 2 + 2);
    s.rotation.z = i * PI / 2 + 0.5;
    g.add(s);
  }
  if (lit) {
    const zone = rgb.addZone({ name, count: 18, ring: true, center: { x: world.x / 1000, y: world.y / 1000, r: 0.055 }, phase: (world.x + world.y) / 900 });
    const mat = ledMaterial(zone.tex, 2.7);
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(hole + 0.4, 1.7, 10, 96), mat), 0, 0, thick / 2 - 0.3));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(hole + 0.4, 1.7, 10, 96), mat), 0, 0, -thick / 2 + 0.3));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(hole + 0.2, hole + 0.2, thick - 6, 96, 1, true).rotateX(PI / 2), ledMaterial(zone.tex, 1.1));
    inner.material.side = THREE.BackSide;
    g.add(inner);
    zone.listeners.push((c) => { bladeMat.emissive.copy(c).multiplyScalar(0.22); });
    g.userData.zone = zone;
  }
  g.userData.rotor = rotor;
  ctx.rotors.push({ rotor, speed: 1 });
  return g;
}

export function buildCase(ctx) {
  const { M, T } = ctx;
  const g = new THREE.Group();
  const W = D.xf - D.xr, H = D.y1 - D.y0, Z = D.zl - D.zr, cy = (D.y0 + D.y1) / 2;

  g.add(at(rb(W, 2, Z, 0.8, M.steel), 0, D.y0 + 1, 0));
  g.add(at(rb(W, H, 1.4, 0.6, M.steel), 0, cy, D.zr + 0.7));

  const top = new THREE.Shape(); rrect(top, -W / 2, -Z / 2, W, Z, 6);
  top.holes.push(rectHole(-205, -62, 410, 124, 8));
  g.add(at(new THREE.Mesh(extrude(top, 1.6, 0.5, 'xz'), M.steel), 0, D.y1 - 1.6, 0));
  const topMesh = new THREE.Mesh(new THREE.PlaneGeometry(414, 128).rotateX(-PI / 2), M.mesh.clone());
  topMesh.material.alphaMap = T.perf.clone(); topMesh.material.alphaMap.repeat.set(92, 16); topMesh.material.alphaMap.needsUpdate = true;
  g.add(at(topMesh, 0, D.y1 - 0.3, 0));

  const rear = new THREE.Shape(); rrect(rear, -Z / 2, D.y0, Z, H, 5);
  rear.holes.push(circHole(-5, 370, 57));
  rear.holes.push(rectHole(22, 266, 46, 158, 2));
  for (let i = 0; i < 7; i++) rear.holes.push(rectHole(-52, 274 - i * 20.32, 110, 13, 2));
  rear.holes.push(rectHole(-80, 26, 150, 86, 3));
  g.add(at(new THREE.Mesh(extrude(rear, 1.4, 0.4, 'zy'), M.steel), D.xr, 0, 0));
  for (const r of [18, 31, 44, 56]) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 6, 48).rotateY(PI / 2), M.steel), D.xr + 0.7, 370, 5));
  for (let i = 0; i < 4; i++) { const s = rb(1.6, 114, 1.6, 0.5, M.steel, 1); s.position.set(D.xr + 0.7, 370, 5); s.rotation.x = i * PI / 4; g.add(s); }

  const front = new THREE.Shape(); rrect(front, -Z / 2, D.y0, Z, H, 6);
  front.holes.push(rectHole(-Z / 2 + 16, D.y0 + 16, Z - 32, H - 32, 8));
  g.add(at(new THREE.Mesh(extrude(front, 3, 0.8, 'zy'), M.steel), D.xf - 3, 0, 0));
  const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(Z - 28, H - 28).rotateY(PI / 2), M.mesh.clone());
  frontMesh.material.alphaMap = T.perf.clone(); frontMesh.material.alphaMap.repeat.set(46, 58); frontMesh.material.alphaMap.needsUpdate = true;
  g.add(at(frontMesh, D.xf - 1.2, cy, 0));
  g.add(at(decal(NAMES.caseBrand, 44, { color: '#8a8f9a', spacing: 10 }), D.xf + 0.2, D.y0 + 30, 0).rotateY(PI / 2));

  const tray = new THREE.Shape(); rrect(tray, D.xr + 1, D.shroudTop, W - 2, D.y1 - D.shroudTop - 2, 2);
  const grom = [[36, 150, 22, 66], [36, 236, 22, 66], [36, 322, 22, 82], [-196, 438, 70, 16], [80, 150, 16, 250]];
  for (const [x, y, w, h] of grom) tray.holes.push(rectHole(x, y, w, h, 7));
  g.add(at(new THREE.Mesh(extrude(tray, 1.2, 0.3), M.steelInner), 0, 0, D.tray - 1.2));
  for (const [x, y, w, h] of grom.slice(0, 4)) g.add(at(rb(w + 3, h + 3, 2.4, 1, M.rubber), x + w / 2, y + h / 2, D.tray - 0.6));

  const sx0 = D.xr + 1, sLen = D.shroudEnd - sx0, sz0 = D.tray, sz1 = D.zl - 4;
  const st = new THREE.Shape(); rrect(st, sx0, -sz1, sLen, sz1 - sz0, 3);
  st.holes.push(rectHole(-118, -100, 78, 24, 8));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) st.holes.push(rectHole(-10 + c * 19, -86 + r * 13, 14, 5, 2.4));
  g.add(at(new THREE.Mesh(extrude(st, 1.4, 0.4, 'xz'), M.steel), 0, D.shroudTop - 1.4, 0));
  g.add(at(rb(82, 2.6, 28, 1.2, M.rubber), -79, D.shroudTop - 0.8, 88));
  g.add(at(rb(sLen, D.shroudTop - D.y0 - 2, 1.4, 0.6, M.steel), sx0 + sLen / 2, (D.shroudTop + D.y0) / 2 + 1, sz1));
  g.add(at(rb(1.4, D.shroudTop - D.y0 - 2, sz1 - sz0, 0.6, M.steel), D.shroudEnd, (D.shroudTop + D.y0) / 2 + 1, (sz0 + sz1) / 2));
  g.add(at(rb(64, 15, 1.6, 1, M.aluSatin), sx0 + 60, 66, sz1 + 1));
  g.add(at(decal(NAMES.caseBrand, 50, { color: '#c9ccd4', spacing: 12 }), sx0 + 60, 66, sz1 + 2));
  g.add(at(rb(150, 86, 140, 2, M.steelInner), -150, 69, 4));

  const e = 9;
  for (const [x, z] of [[D.xr + e / 2, D.zl - e / 2], [D.xf - e / 2, D.zl - e / 2], [D.xr + e / 2, D.zr + e / 2], [D.xf - e / 2, D.zr + e / 2]]) g.add(at(rb(e, H, e, 2.6, M.steel), x, cy, z));
  for (const y of [D.y0 + e / 2, D.y1 - e / 2]) {
    g.add(at(rb(W, e, e, 2.6, M.steel), 0, y, D.zl - e / 2));
    g.add(at(rb(W, e, e, 2.6, M.steel), 0, y, D.zr + e / 2));
    g.add(at(rb(e, e, Z, 2.6, M.steel), D.xr + e / 2, y, 0));
    g.add(at(rb(e, e, Z, 2.6, M.steel), D.xf - e / 2, y, 0));
  }
  for (const x of [-165, 165]) {
    g.add(at(rb(34, 13, Z - 20, 4, M.plastic), x, 10.5, 0));
    g.add(at(rb(30, 4, Z - 26, 1.5, M.rubber), x, 2.2, 0));
  }
  return g;
}

export function buildGlass(ctx) {
  const { M } = ctx;
  const g = new THREE.Group();
  const W = D.xf - D.xr - 4, H = D.y1 - D.y0 - 4, cy = (D.y0 + D.y1) / 2;
  const geo = new THREE.BoxGeometry(W, H, 4);
  const tint = new THREE.Mesh(geo, M.glassTint); tint.renderOrder = 10;
  const spec = new THREE.Mesh(geo, M.glassSpec); spec.renderOrder = 11; spec.userData.spec = true;
  g.add(at(tint, 0, cy, D.zl + 2), at(spec, 0, cy, D.zl + 2));
  const b = 13;
  const fr = new THREE.Shape(); rrect(fr, -W / 2, -H / 2, W, H, 3);
  fr.holes.push(rectHole(-W / 2 + b, -H / 2 + b, W - b * 2, H - b * 2, 4));
  g.add(at(new THREE.Mesh(extrude(fr, 0.5, 0), M.frit), 0, cy, D.zl - 0.6));
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const s = cyl(5.5, 5, ctx.M.aluSatin, 'z', 24);
    g.add(at(s, sx * (W / 2 - 7), cy + sy * (H / 2 - 7), D.zl + 5));
  }
  g.traverse((o) => { o.userData.noShadow = true; o.userData.glass = true; });
  return g;
}

export function buildBoard(ctx) {
  const { M, rgb } = ctx;
  const g = new THREE.Group();
  const bx = -96, by = 275.5, bz = D.bz;
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(244, 305, 1.6), [M.pcbPlain, M.pcbPlain, M.pcbPlain, M.pcbPlain, M.pcb, M.pcbPlain]);
  g.add(at(pcb, bx, by, bz - 0.8));
  for (const [x, y] of [[-212, 422], [-90, 422], [20, 422], [-212, 268], [-90, 268], [20, 268], [-212, 130], [-90, 130], [20, 130]]) {
    g.add(at(cyl(3.3, 1.8, M.nickel, 'z', 20), x, y, bz + 0.9));
    g.add(at(cyl(1.5, 2, M.steel, 'z', 6), x, y, bz + 1));
  }
  const sx = -115, sy = 353;
  g.add(at(rb(58, 58, 5, 1.5, M.steelBare), sx, sy, bz + 2.5));
  g.add(at(rb(46, 46, 6.4, 1, M.plasticSoft), sx, sy, bz + 3.2));

  const vrmL = heatsink(26, 104, 34, 13, M.alu, 'y'); g.add(at(vrmL, -170, 362, bz + 17));
  const vrmT = heatsink(96, 22, 30, 16, M.alu, 'x'); g.add(at(vrmT, -112, 414, bz + 15));
  g.add(at(decal('ARC', 16, { color: '#70747e', spacing: 4 }), -170, 362, bz + 34.4).rotateZ(PI / 2));

  const io = new THREE.Shape(poly([[-218, 268], [-186, 268], [-183, 300], [-183, 392], [-190, 424], [-218, 424]]).getPoints());
  g.add(at(new THREE.Mesh(extrude(io, 42, 1.2), M.plastic), 0, 0, bz));
  g.add(at(rb(26, 2.4, 0.8, 0.3, M.aluLight), -202, 300, bz + 43.4));
  const ioZone = rgb.addZone({ name: 'board-io', count: 14, from: { x: -0.2, y: 0.3 }, to: { x: -0.2, y: 0.41 }, phase: 0.1 });
  g.add(at(new THREE.Mesh(uvAlong(new RoundedBoxGeometry(2.6, 104, 2, 2, 0.8), 'y'), ledMaterial(ioZone.tex, 3)), -187.5, 352, bz + 43));
  g.add(at(decal(NAMES.board, 30, { color: '#9498a3', spacing: 5 }), -203, 345, bz + 43.4).rotateZ(PI / 2));

  for (const [i, x] of [-40, -31, -22, -13].entries()) {
    g.add(at(rb(7, 138, 9, 0.8, i % 2 ? M.slot : M.plasticSoft), x, 344, bz + 4.5));
    g.add(at(rb(7.6, 9, 13, 1, M.plastic), x, 414.5, bz + 6.5));
    g.add(at(rb(7.6, 7, 11, 1, M.plastic), x, 273.5, bz + 5.5));
  }
  g.add(at(rb(11, 54, 13, 1, M.plasticSoft), 19, 330, bz + 6.5));
  g.add(at(rb(22, 11, 13, 1, M.plasticSoft), -196, 420, bz + 6.5).translateZ(0));
  g.add(at(rb(92, 9, 11.5, 1, M.nickel), -160, 285, bz + 5.75));
  g.add(at(rb(92, 9, 11.5, 1, M.nickel), -160, 204, bz + 5.75));
  g.add(at(rb(86, 5.4, 11.6, 0.6, M.slot), -160, 204, bz + 5.9));
  g.add(at(rb(40, 8, 11, 1, M.slot), -186, 163, bz + 5.5));
  g.add(at(rb(8, 8, 14, 1, M.plastic), -111, 204, bz + 7));

  g.add(at(rb(84, 23, 4.4, 1.2, M.aluSatin), -95, 310, bz + 2.2));
  g.add(at(decal('M.2 · SLOT 1', 34, { color: '#7a7e88', spacing: 3, font: '600 72px "DM Sans", sans-serif' }), -95, 310, bz + 4.5));
  const armor = new THREE.Shape(poly([[-200, 126], [-34, 126], [-34, 176], [-52, 196], [-104, 196], [-116, 184], [-200, 184]]).getPoints());
  g.add(at(new THREE.Mesh(extrude(armor, 5, 0.8), M.aluSatin), 0, 0, bz));
  for (let i = 0; i < 6; i++) g.add(at(rb(52, 1, 0.6, 0.2, M.alu, 1), -160 + i * 3, 135 + i * 7, bz + 5.9).rotateZ(0));
  g.add(at(decal(NAMES.board, 46, { color: '#aeb2bc', spacing: 6 }), -82, 150, bz + 6));
  const chip = new THREE.Shape(poly([[-26, 150], [20, 150], [20, 226], [-10, 226], [-26, 210]]).getPoints());
  g.add(at(new THREE.Mesh(extrude(chip, 8, 1), M.alu), 0, 0, bz));
  g.add(at(rb(34, 34, 1, 0.5, M.gloss), -3, 186, bz + 9));
  const chipZone = rgb.addZone({ name: 'board-chipset', count: 10, from: { x: -0.02, y: 0.16 }, to: { x: 0.015, y: 0.22 }, phase: 0.6 });
  const strip = new THREE.Mesh(uvAlong(new RoundedBoxGeometry(2.2, 58, 1.6, 2, 0.7), 'y'), ledMaterial(chipZone.tex, 3));
  g.add(at(strip, 15.5, 190, bz + 9));
  const lg = decal('K', 15, { emissive: true, font: '700 110px "Unbounded", sans-serif', spacing: 0 });
  chipZone.listeners.push((c) => lg.material.emissive.copy(c));
  g.add(at(lg, -3, 186, bz + 9.7));

  for (const y of [205, 170]) g.add(at(rb(15, 30, 9, 1, M.plasticSoft), 19, y, bz + 4.5));
  const r = rng(5);
  for (let i = 0; i < 9; i++) g.add(at(rb(8.5, 8.5, 6.5, 1, M.plasticSoft), -151, 314 + i * 10.6, bz + 3.25));
  for (let i = 0; i < 8; i++) g.add(at(rb(8.5, 8.5, 6.5, 1, M.plasticSoft), -152 + i * 10.6, 396.5, bz + 3.25));
  for (let i = 0; i < 14; i++) {
    const x = [-140, -84][i % 2] + (r() - 0.5) * 6, y = 318 + Math.floor(i / 2) * 11.5;
    if (Math.abs(x - sx) < 34 && Math.abs(y - sy) < 34) continue;
    g.add(at(cyl(3.1, 7.5, M.plastic, 'z', 16), x, y, bz + 3.75));
    g.add(at(cyl(2.9, 0.4, M.nickel, 'z', 16), x, y, bz + 7.6));
  }
  for (let i = 0; i < 6; i++) {
    const x = -206 + (i % 3) * 9.5, y = 150 + Math.floor(i / 3) * 12;
    g.add(at(cyl(3.6, 9, M.gold, 'z', 16), x, y, bz + 4.5));
  }
  g.add(at(cyl(10, 3, M.nickel, 'z', 32), -62, 246, bz + 2.5));
  g.add(at(rb(24, 24, 1.6, 0.5, M.plastic), -62, 246, bz + 0.8));
  for (let i = 0; i < 5; i++) g.add(at(rb(9, 3.4, 8, 0.4, M.plasticSoft), -190 + i * 34, 128.5, bz + 4));
  for (let i = 0; i < 3; i++) g.add(at(rb(3.4, 9, 8, 0.4, M.plasticSoft), 22.5, 250 + i * 14, bz + 4));
  g.add(at(rb(1.2, 156, 40, 0.3, M.steelBare), D.xr + 3, 345, bz + 21));
  for (let i = 0; i < 7; i++) g.add(at(rb(1.6, 13, 14 + (i % 3) * 6, 0.5, M.plastic), D.xr + 2.6, 282 + i * 20, bz + 12 + (i % 2) * 14));
  return g;
}

export function buildRam(ctx, x, idx) {
  const { M, rgb } = ctx;
  const g = new THREE.Group();
  const bz = D.bz, z0 = bz + 4;
  g.add(at(rb(1.3, 133, 30, 0.2, M.pcbPlain), 0, 344, z0 + 15));
  for (let i = 0; i < 22; i++) g.add(at(rb(1.5, 3.2, 2.6, 0.1, M.gold, 1), 0, 284 + i * 5.6, z0 + 1.6));
  const prof = poly([[6, -66.5], [40, -66.5], [43, -58], [43, -30], [39, -22], [39, 22], [43, 30], [43, 58], [40, 66.5], [6, 66.5]]);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(extrude(prof, 2.2, 0.5, 'zy'), M.alu);
    m.rotation.y = PI; m.position.set(s * 2.2 + 1.1, 344, z0);
    g.add(m);
  }
  g.add(at(decal(NAMES.ram, 38, { color: '#8d919c', spacing: 8 }), 3.9, 344, z0 + 22).rotateY(PI / 2).rotateZ(PI / 2));
  const zone = rgb.addZone({ name: 'ram-' + idx, count: 16, from: { x: x / 1000, y: 0.28 }, to: { x: x / 1000, y: 0.408 }, phase: 0.2 + idx * 0.13 });
  const bar = new THREE.Mesh(uvAlong(new RoundedBoxGeometry(6.4, 128, 8, 3, 2.6), 'y'), ledMaterial(zone.tex, 2.0));
  g.add(at(bar, 0, 344, z0 + 43.5));
  g.position.x = x;
  g.userData.zone = zone;
  return g;
}

export function buildGpu(ctx) {
  const { M, rgb } = ctx;
  const g = new THREE.Group();
  const x0 = -224, x1 = 96, zb = -64, zt = 66, yTop = 291, yBot = 230;
  g.add(at(rb(300, 1.6, 118, 0.2, M.pcbPlain), -74, 286, -5));
  g.add(at(rb(86, 1.4, 9, 0.2, M.gold), -160, 286, zb - 5));

  const bp = new THREE.Shape(poly([[x0, -zt + 6], [x0 + 6, -zt], [x1 - 14, -zt], [x1, -zt + 14], [x1, -zb], [x0, -zb]]).getPoints());
  bp.holes.push(rectHole(-150, -22, 44, 44, 3));
  for (let i = 0; i < 6; i++) bp.holes.push(poly([[-60 + i * 22, 20], [-48 + i * 22, 20], [-34 + i * 22, 48], [-46 + i * 22, 48]], THREE.Path));
  g.add(at(new THREE.Mesh(extrude(bp, 2.2, 0.5, 'xz'), M.aluSatin), 0, yTop - 2.2, 0));
  g.add(at(rb(40, 1, 40, 0.3, M.nickel), -128, yTop - 3.4, 0));
  g.add(at(decal(NAMES.gpu, 88, { color: '#b8bcc6', spacing: 14 }), -40, yTop + 0.25, -22).rotateX(-PI / 2));
  g.add(at(decal('APEX 3X', 34, { color: '#6f737d', spacing: 8, font: '600 80px "DM Sans", sans-serif' }), -178, yTop + 0.25, 42).rotateX(-PI / 2));

  const sh = new THREE.Shape(poly([[x0, -zt + 4], [x0 + 4, -zt], [x1 - 18, -zt], [x1, -zt + 18], [x1, -zb - 10], [x1 - 10, -zb], [x0, -zb]]).getPoints());
  const fanX = [-170, -64, 42];
  for (const fx of fanX) sh.holes.push(circHole(fx, -2, 46));
  g.add(at(new THREE.Mesh(extrude(sh, 9, 1, 'xz'), M.plastic), 0, yBot, 0));
  for (const fx of fanX) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46.6, 1.3, 8, 64).rotateX(PI / 2), M.aluSatin);
    g.add(at(ring, fx, yBot - 0.4, 2));
    const rotor = new THREE.Group();
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 9, 40), M.gloss));
    const bg = bladeGeometry({ r0: 15.5, r1: 44.5, c0: 12, c1: 26, pitch0: 0.7, pitch1: 0.36, sweep: 0.7 }).rotateX(PI / 2);
    for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(bg, M.plastic); b.rotation.y = (i / 11) * PI * 2; rotor.add(b); }
    rotor.position.set(fx, yBot + 5, 2);
    g.add(rotor);
    ctx.rotors.push({ rotor, speed: 0.7, axis: 'y' });
  }

  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 44, 118), M.fin, 128);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 128; i++) { mtx.makeTranslation(x0 + 8 + i * 2.36, 263, 1); fins.setMatrixAt(i, mtx); }
  g.add(fins);
  for (const z of [-28, -12, 18, 34]) g.add(at(cyl(3, 296, M.nickel, 'x', 16), -66, 248, z));

  const side = new THREE.Shape(poly([[x0, 232], [x1 - 16, 232], [x1, 246], [x1, 289], [x0, 289]]).getPoints());
  side.holes.push(poly([[-196, 240], [-92, 240], [-80, 262], [-196, 262]], THREE.Path));
  side.holes.push(poly([[-60, 240], [58, 240], [72, 254], [72, 262], [-48, 262]], THREE.Path));
  side.holes.push(rectHole(-60, 279, 40, 10, 1));
  g.add(at(new THREE.Mesh(extrude(side, 3, 0.6), M.plastic), 0, 0, zt));
  g.add(at(rb(x1 - x0, 57, 2, 0.5, M.plastic), (x0 + x1) / 2, 260.5, zb + 1));
  g.add(at(rb(2.4, 57, zt - zb, 0.6, M.plastic), x1 - 1.2, 260.5, 1));
  for (let i = 0; i < 3; i++) g.add(at(rb(300, 0.9, 1.2, 0.3, M.aluSatin, 1), -70, 236.5 + i * 1.9, zt + 3.3));

  const zone = rgb.addZone({ name: 'gpu-bar', count: 24, from: { x: -0.19, y: 0.272 }, to: { x: 0.06, y: 0.272 }, phase: 0.45 });
  g.add(at(new THREE.Mesh(uvAlong(new RoundedBoxGeometry(252, 4.2, 2.4, 3, 1.1), 'x'), ledMaterial(zone.tex, 2.2)), -66, 271, zt + 3.4));
  const logo = decal(NAMES.gpu, 70, { emissive: true, spacing: 16 });
  zone.listeners.push((c) => logo.material.emissive.copy(c).lerp(new THREE.Color(1, 1, 1), 0.25));
  g.add(at(logo, 30, 282.5, zt + 3.9));
  g.add(at(rb(36, 9, 10, 1, M.plasticSoft), -40, 284, zt - 3));

  g.add(at(rb(1.3, 62, 124, 0.3, M.steelBare), D.xr + 3.2, 259, 0));
  for (let i = 0; i < 4; i++) g.add(at(rb(1.8, 7, 18, 0.6, M.plastic), D.xr + 3, 280, -44 + i * 26));
  g.userData.zone = zone;
  return g;
}

export function buildCooler(ctx) {
  const { M, rgb } = ctx;
  const pump = new THREE.Group(), rad = new THREE.Group(), tubes = new THREE.Group();
  const sx = -115, sy = 353, bz = D.bz, zc = bz + 6;
  pump.add(at(rb(86, 86, 3, 1, M.steelBare), sx, sy, zc + 1.5).rotateZ(PI / 4));
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2;
    pump.add(at(cyl(5, 9, M.nickel, 'z', 20), sx + Math.cos(a) * 52, sy + Math.sin(a) * 52, zc + 6));
    pump.add(at(cyl(2.4, 1, M.steel, 'z', 6), sx + Math.cos(a) * 52, sy + Math.sin(a) * 52, zc + 10.6));
  }
  const prof = [[0, 0], [34, 0], [36, 2], [36, 40], [33.5, 47], [30, 49], [0, 49]].map(([r, z]) => new THREE.Vector2(r, z));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 72).rotateX(PI / 2), M.alu);
  pump.add(at(body, sx, sy, zc + 3));
  pump.add(at(cyl(29.5, 1.2, M.gloss, 'z', 64), sx, sy, zc + 52.2));
  const zone = rgb.addZone({ name: 'pump', count: 20, ring: true, center: { x: sx / 1000, y: sy / 1000, r: 0.03 }, phase: 0.3 });
  pump.add(at(new THREE.Mesh(new THREE.TorusGeometry(31.4, 1.5, 10, 96), ledMaterial(zone.tex, 2.8)), sx, sy, zc + 51));
  pump.add(at(new THREE.Mesh(new THREE.TorusGeometry(20, 0.7, 8, 96), ledMaterial(zone.tex, 2.4)), sx, sy, zc + 52.8));
  const logo = decal(NAMES.cool, 30, { emissive: true, spacing: 8 });
  zone.listeners.push((c) => logo.material.emissive.copy(c).lerp(new THREE.Color(1, 1, 1), 0.3));
  pump.add(at(logo, sx, sy, zc + 53));

  const rx = -2, ry = 482, len = 396;
  rad.add(at(rb(len - 44, 27, 118, 1, M.finCore), rx, ry, 0));
  for (const s of [-1, 1]) rad.add(at(rb(24, 28.5, 121, 2.5, M.plastic), rx + s * (len / 2 - 12), ry, 0));
  for (const s of [-1, 1]) rad.add(at(rb(len - 46, 28, 2, 0.6, M.plastic), rx, ry, s * 60));
  const fans = [];
  for (const [i, fx] of [-124, -2, 120].entries()) {
    const f = buildFan(ctx, { name: 'top-' + i, world: { x: fx, y: 456 }, lit: true });
    f.rotation.x = PI / 2; f.position.set(fx, 456, 0);
    rad.add(f); fans.push(f);
  }
  const fit = (x, y, z) => { tubes.add(at(cyl(7.2, 14, M.aluSatin, 'y', 20), x, y, z)); tubes.add(at(cyl(8.4, 4, M.alu, 'y', 20), x, y - 6, z)); };
  const ends = [[150, 468, -16], [172, 468, 10]];
  ends.forEach(([x, y, z]) => fit(x, y - 6, z));
  const starts = [[sx + 30, sy + 22, zc + 30], [sx + 36, sy + 4, zc + 30]];
  starts.forEach(([x, y, z], i) => {
    const el = cyl(7.2, 16, M.aluSatin, 'x', 20); tubes.add(at(el, x + 6, y, z));
    const [ex, ey, ez] = ends[i];
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + 12, y, z), new THREE.Vector3(x + 44, y + 4, z + 16 + i * 6), new THREE.Vector3(x + 110, y + 26 - i * 14, z + 34 + i * 8),
      new THREE.Vector3(ex - 6, ey - 70, ez + 22), new THREE.Vector3(ex, ey - 30, ez + 6), new THREE.Vector3(ex, ey - 12, ez),
    ], false, 'catmullrom', 0.5);
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 90, 6.1, 14), M.sleeve.clone());
    t.material.bumpMap = M.sleeve.bumpMap.clone(); t.material.bumpMap.repeat.set(70, 3); t.material.bumpMap.needsUpdate = true;
    tubes.add(t);
  });
  return { pump, rad, tubes };
}

function wireBundle(ctx, pathFn, rows, cols, pitch, mats, radius = 1.9) {
  const g = new THREE.Group();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const pts = pathFn(r, c, (r - (rows - 1) / 2) * pitch, c * pitch);
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8), mats[(r + c) % mats.length]));
  }
  return g;
}

export function buildCables(ctx) {
  const { M } = ctx;
  const g = new THREE.Group();
  const bz = D.bz;
  const sleeveA = M.sleeve.clone(), sleeveB = M.sleeveAccent.clone();
  for (const m of [sleeveA, sleeveB]) { m.bumpMap = M.sleeve.bumpMap.clone(); m.bumpMap.repeat.set(40, 2); m.bumpMap.needsUpdate = true; }
  g.add(wireBundle(ctx, (r, c, oy, oc) => [
    [19 - 2 + c * 4.2, 330 + oy, bz + 12], [19 - 2 + c * 4.2, 330 + oy, bz + 30 + oc * 1.5], [30 + oc, 330 + oy * 1.05, bz + 44 + oc * 1.2],
    [44 + oc * 0.6, 348 + oy * 1.1, bz + 30 + oc], [47, 362 + oy * 1.12, D.tray + 6 + oc * 0.4], [47, 364 + oy * 1.12, D.tray - 14],
  ], 12, 2, 4.3, [sleeveA, sleeveA, sleeveB]));
  for (const k of [0.36, 0.7]) {
    const comb = rb(11, 56, 3, 1, M.gloss);
    comb.position.set(27 + k * 16, 331 + k * 14, bz + 40 - k * 6); comb.rotation.y = -0.6 - k * 0.5;
    g.add(comb);
  }
  g.add(wireBundle(ctx, (r, c, oy, oc) => [
    [-40 + oy * 0.72, 284 + (c - 0.5) * 4.2, 66], [-40 + oy * 0.72, 284 + (c - 0.5) * 4.2, 82 + c * 3], [-44 + oy * 0.76, 262, 98 + c * 4],
    [-62 + oy * 0.82, 200, 100 + c * 4.2], [-78 + oy * 0.86, 148, 92 + c * 4.2], [-79 + oy * 0.86, 122, 88 + c * 2], [-79 + oy * 0.86, 104, 86],
  ], 8, 2, 4.3, [sleeveA, sleeveB, sleeveA]));
  for (const [y, z] of [[236, 101], [170, 99]]) {
    const comb = rb(40, 3, 12, 1, M.gloss);
    comb.position.set(-52 - (262 - y) * 0.22, y, z + 2); comb.rotation.x = 0.04;
    g.add(comb);
  }
  g.add(wireBundle(ctx, (r, c, oy) => [
    [-196 + oy, 420, bz + 12], [-196 + oy, 428, bz + 22], [-190 + oy, 440, bz + 14], [-176 + oy, 447, D.tray + 4], [-170 + oy, 447, D.tray - 12],
  ], 4, 2, 4.3, [sleeveA, sleeveB], 1.8));
  return g;
}

export function buildRoom(ctx) {
  const { M } = ctx;
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40000, 6000), M.wall);
  wall.position.set(0, 1500, -620);
  g.add(wall);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3200, 36, 1180), M.desk);
  desk.position.set(0, -18, 40);
  desk.userData.desk = true;
  g.add(desk);
  const edge = rb(3200, 6, 6, 2, M.aluSatin);
  edge.position.set(0, -3, 628);
  g.add(edge);
  return g;
}
