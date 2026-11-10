import * as THREE from 'three';

/** How far a blade edge's shading turns toward the edge. */
const RIM_TILT = 0.35;

export type BladeSpec = {
  r0: number; r1: number;
  /** chord at root and tip */
  c0: number; c1: number;
  /** blade angle to the rotation plane at root and tip, radians */
  pitch0: number; pitch1: number;
  /** backward sweep of the tip, radians */
  sweep: number;
  /** maximum thickness */
  thick: number;
  camber?: number;
  nu?: number; nv?: number;
  /** z of the blade's mid chord */
  z?: number;
  /** 1 keeps a full chord to the tip, lower rounds the tip off */
  tip?: number;
};

/**
 * A swept, twisted, cambered fan blade with real thickness that tapers toward its leading and trailing edges, each closed by
 * a half round about 0.4 mm across, as molded blades have: a knife edge read as a hairline up close. Axis z.
 */
export function bladeGeometry(o: BladeSpec): THREE.BufferGeometry {
  const nu = o.nu ?? 14; const nv = o.nv ?? 10;
  const camber = o.camber ?? 0.09;
  const z0 = o.z ?? 0;
  const tipK = o.tip ?? 0.55;
  const top: THREE.Vector3[] = []; const bot: THREE.Vector3[] = [];
  const mid: THREE.Vector3[] = []; const nrm: THREE.Vector3[] = []; const half: number[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu; const r = o.r0 + (o.r1 - o.r0) * u;
    const tip = Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, (u - 0.78) / 0.22), 2) * tipK));
    const chord = (o.c0 + (o.c1 - o.c0) * u) * tip;
    const pitch = o.pitch0 + (o.pitch1 - o.pitch0) * u;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv; const s = (v - 0.5) * chord;
      const ang = o.sweep * u * u + (s * Math.cos(pitch)) / r;
      const bend = chord * camber * (1 - 4 * (v - 0.5) * (v - 0.5));
      const zc = z0 + s * Math.sin(pitch) + bend;
      const t = o.thick * (0.22 + 0.78 * Math.pow(Math.sin(Math.PI * v), 0.55)) * (1 - 0.45 * u) * 0.5;
      const T = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
      const N = T.clone().multiplyScalar(-Math.sin(pitch)).add(new THREE.Vector3(0, 0, Math.cos(pitch)));
      const P = new THREE.Vector3(r * Math.cos(ang), r * Math.sin(ang), zc);
      top.push(P.clone().addScaledVector(N, t));
      bot.push(P.clone().addScaledVector(N, -t));
      mid.push(P); nrm.push(N); half.push(t);
    }
  }
  const pos: number[] = []; const idx: number[] = [];
  const row = nv + 1;
  const push = (v: THREE.Vector3) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
  const tb = top.map(push); const bb = bot.map(push);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * row + j; const b = a + 1; const c = a + row; const d = c + 1;
    idx.push(tb[a]!, tb[c]!, tb[b]!, tb[b]!, tb[c]!, tb[d]!);
    idx.push(bb[a]!, bb[b]!, bb[c]!, bb[b]!, bb[d]!, bb[c]!);
  }
  for (let j = 0; j < nv; j++) {
    const a = nu * row + j;
    const t0 = push(top[a]!); const t1 = push(top[a + 1]!); const b0 = push(bot[a]!); const b1 = push(bot[a + 1]!);
    idx.push(t0, b0, t1, t1, b0, b1);
  }
  // The rounded leading and trailing edges: a half round from the top face over the edge to the bottom face. Each half keeps
  // its own apex vertex and shades like the face it continues, turning only slightly toward the edge. A full turn of the normal
  // left a sideways facing apex that drew a dark line under a pixel wide, which broke into dashes along every blade outline.
  const K = 4;
  const rimNormals: [number, THREE.Vector3][] = [];
  for (const [j, inner, flip] of [[0, 1, false], [nv, nv - 1, true]] as [number, number, boolean][]) {
    const ring: number[][] = [];
    for (let i = 0; i <= nu; i++) {
      const a = i * row + j;
      const out = mid[a]!.clone().sub(mid[i * row + inner]!); out.addScaledVector(nrm[a]!, -out.dot(nrm[a]!)).normalize();
      const pts = [tb[a]!];
      for (let k = 1; k < K; k++) {
        const th = (Math.PI * k) / K;
        const p = mid[a]!.clone().addScaledVector(nrm[a]!, half[a]! * Math.cos(th)).addScaledVector(out, half[a]! * Math.sin(th));
        const sides = k * 2 === K ? [1, -1] : [k * 2 < K ? 1 : -1];
        for (const side of sides) {
          const id = push(p);
          rimNormals.push([id, nrm[a]!.clone().multiplyScalar(side).addScaledVector(out, RIM_TILT * Math.sin(th)).normalize()]);
          pts.push(id);
        }
      }
      pts.push(bb[a]!);
      ring.push(pts);
    }
    for (let i = 0; i < nu; i++) for (let k = 0; k < K + 1; k++) {
      if (k === K / 2) continue;
      const p = ring[i]![k]!; const q = ring[i]![k + 1]!; const r = ring[i + 1]![k]!; const s = ring[i + 1]![k + 1]!;
      if (flip) idx.push(p, r, q, q, r, s); else idx.push(p, q, r, q, s, r);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  for (const [id, v] of rimNormals) n.setXYZ(id, v.x, v.y, v.z);
  return g;
}

/** A soft radial streak texture for the motion blurred disc of a fast rotor. */
export function blurDiscTexture(blades: number, light: boolean): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5) / S - 0.5; const dy = (y + 0.5) / S - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const a = Math.atan2(dy, dx);
    const band = 0.55 + 0.45 * Math.cos(a * blades);
    const radial = r < 0.3 || r > 0.98 ? 0 : Math.sin(((r - 0.3) / 0.68) * Math.PI) ** 0.6;
    const alpha = radial * (0.55 + 0.2 * band);
    const v = light ? 225 : 40;
    const i = (y * S + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + (light ? 0 : 6); img.data[i + 3] = Math.round(alpha * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
