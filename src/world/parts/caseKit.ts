import * as THREE from 'three';
import type { Box } from '../layout/math';
import type { CaseLayout, GlassPanel } from '../layout/types';
import { at, cyl, extrude, lathe, PartBuilder, rbox, rrectHole, rrectShape, screwGeometry } from '../kit/geometry';
import { mat, type CaseFinish, type MatName } from '../kit/materials';

export const HOLES4: [number, number][] = [[52.5, 52.5], [52.5, -52.5], [-52.5, 52.5], [-52.5, -52.5]];
/** Shape drawn in (z, y) seen from +x, extruded toward -x. */
export const ZY = new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);

/** A perforated sheet: an alpha tested plane inside its own solid border, both with real thickness. */
export function perforated(pb: PartBuilder, F: CaseFinish, w: number, h: number, m: THREE.Matrix4, border = 3, to?: THREE.Object3D, scale = 1) {
  const frame = rrectShape(w, h, 4);
  frame.holes.push(rrectHole(w - 2 * border, h - 2 * border, 2.5));
  pb.add(extrude(frame, 1.0, 0.3, 'xy', 8, 1), F.shell, m, to ? { to } : {});
  const plane = new THREE.PlaneGeometry(w - 2 * border + 0.4, h - 2 * border + 0.4);
  let sheet: THREE.Material | MatName = F.mesh;
  if (scale !== 1) {
    // The same sheet at a coarser pitch: its own alpha map repeat, the shared perforation shader.
    const base = mat(F.mesh) as THREE.MeshPhysicalMaterial; const m2 = pb.own(base.clone());
    const am = pb.own(base.alphaMap!.clone()); am.repeat.multiplyScalar(1 / scale); am.needsUpdate = true;
    m2.alphaMap = am; m2.onBeforeCompile = base.onBeforeCompile; m2.customProgramCacheKey = base.customProgramCacheKey;
    sheet = m2;
  }
  pb.add(plane, sheet, m.clone().multiply(at(0, 0, 0.5)), to ? { to } : {});
}

/**
 * The frame a glass panel is built in: u along its width, v up, w out through its thickness. A left panel is built in case
 * space as is; a front panel is turned a quarter about y, so its u runs along -z and its w along +x.
 */
function panelFrame(g: GlassPanel): { m: THREE.Matrix4; u0: number; u1: number } {
  if (g.side === 'front') return { m: new THREE.Matrix4().makeRotationY(Math.PI / 2), u0: -g.rect.max[2], u1: -g.rect.min[2] };
  return { m: new THREE.Matrix4(), u0: g.rect.min[0], u1: g.rect.max[0] };
}

const capCorners = (g: GlassPanel): [number, number][] => (g.caps === 'top' ? [[1, 1], [-1, 1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]]);

/**
 * How each brand holds its glass, from its design language in the catalog: Mirevale hides its fasteners, so a low cap painted
 * like the glass border; Skarn shows its function, so a hex bolt on a washer; Paleforge machines its parts, so a flat turned
 * disc with a groove, in the plate finish. All stay inside the cap collision box (12 square, 4 deep).
 */
export type GlassFixing = 'flush' | 'hex' | 'turned' | 'dome';
const GLASS_FIXING: Record<string, GlassFixing> = { mirevale: 'flush', skarn: 'hex', paleforge: 'turned' };

function glassFixing(pb: PartBuilder, fixing: GlassFixing, F: CaseFinish, m: THREE.Matrix4, to: THREE.Object3D) {
  const metal = F.light ? 'capSilver' : 'capDark';
  if (fixing === 'flush') {
    pb.add(lathe([[0, 0], [4.4, 0], [4.6, 0.3], [4.3, 0.9], [0, 1.0]], 40), 'capDark', m, { to });
  } else if (fixing === 'hex') {
    pb.add(lathe([[0, 0], [5.8, 0], [5.8, 0.8], [0, 0.8]], 40), metal, m, { to });
    const head = new THREE.CylinderGeometry(4.6, 4.6, 3.0, 6, 1); head.rotateX(Math.PI / 2); head.rotateZ(Math.PI / 6); head.translate(0, 0, 0.8 + 1.5);
    pb.add(head, metal, m, { to });
    pb.add(lathe([[0, 0], [2.2, 0], [2.2, 0.2], [0, 0.2]], 24), 'darkVoid', m.clone().multiply(at(0, 0, 3.81)), { to, uv: 'keep' });
  } else if (fixing === 'turned') {
    pb.add(lathe([[0, 0], [5.9, 0], [5.9, 2.9], [5.4, 3.5], [3.4, 3.5], [3.1, 3.2], [2.6, 3.2], [2.3, 3.5], [0, 3.5]], 48), F.shell === 'aluRaw' ? 'aluRaw' : F.light ? 'plateAnoWhite' : 'plateAnoBlack', m, { to });
  } else {
    pb.add(lathe([[0, 0], [5.4, 0], [5.8, 0.4], [5.8, 2.6], [5.0, 3.6], [0, 3.8]], 40), metal, m, { to });
  }
}

/** Corner caps sit this far in from each corner of a glass panel. */
const CAP_INSET = 12;

function glassPanel(pb: PartBuilder, g: GlassPanel, F: CaseFinish, group: THREE.Object3D, fixing: GlassFixing) {
  const { m, u0, u1 } = panelFrame(g);
  const frame = pb.group(`glass-${g.side}`, group, m);
  const w = u1 - u0; const h = g.rect.max[1] - g.rect.min[1];
  const cx = (u0 + u1) / 2; const cy = (g.rect.min[1] + g.rect.max[1]) / 2;
  const t = g.outer - g.inner;
  // Over a white interior the stock tint vanished, so the glass reads its smoke more strongly on light finishes.
  const tintMat = F.light ? pb.own(Object.assign((mat('glassTint') as THREE.MeshPhysicalMaterial).clone(), { opacity: 0.62, color: new THREE.Color(0x1a1d26) })) : mat('glassTint');
  const tint = pb.mesh(new THREE.BoxGeometry(w - 1, h - 1, t - 0.3), tintMat, at(cx, cy, (g.inner + g.outer) / 2), { to: frame });
  tint.renderOrder = 10; tint.userData.glass = true;
  const spec = pb.mesh(new THREE.PlaneGeometry(w - 1.2, h - 1.2), mat('glassSpec'), at(cx, cy, g.outer + 0.02), { to: frame });
  spec.renderOrder = 11; spec.userData.glass = true; spec.userData.glassSpec = true;
  const edge = mat('glassEdge');
  // The edge strips run to within a millimeter of each corner, so the glass edge reads unbroken around the panel (critic 269).
  for (const [ex, ey, ew, eh] of [[cx, g.rect.min[1] + 0.25, w - 2, 0.5], [cx, g.rect.max[1] - 0.25, w - 2, 0.5], [u0 + 0.25, cy, 0.5, h - 2], [u1 - 0.25, cy, 0.5, h - 2]] as [number, number, number, number][]) {
    const e = pb.mesh(rbox(ew, eh, t - 0.2, 0.15, 1), edge, at(ex, ey, (g.inner + g.outer) / 2), { to: frame });
    e.userData.glass = true; e.renderOrder = 9;
  }
  const border = 22;
  const fr = rrectShape(w - 1.5, h - 1.5, 3, cx, cy);
  fr.holes.push(rrectHole(w - 2 * border, h - 2 * border, 5, cx, cy));
  const frit = pb.mesh(extrude(fr, 0.25, 0, 'xy', 8), mat('frit'), at(0, 0, g.inner + 0.05), { to: frame });
  frit.userData.glass = true;
  for (const [sx, sy] of capCorners(g)) {
    // Seated well inside the glass edge, on the painted border, clear of the frame pillars beside it.
    const x = cx + sx * (w / 2 - CAP_INSET); const y = cy + sy * (h / 2 - CAP_INSET);
    glassFixing(pb, fixing, F, at(x, y, g.outer), frame);
    pb.add(cyl(3.6, 0.6, 'z', 32), fixing === 'flush' ? 'capDark' : F.light ? 'capSilver' : 'capDark', at(x, y, g.inner - 0.3), { to: frame });
  }
}

/** Every glass panel of a case, in one group the rig shows and hides with the build's glass. */
export function glassPanels(pb: PartBuilder, L: CaseLayout, F: CaseFinish, brand: string): THREE.Group {
  const group = pb.group('glass', pb.root);
  const fixing = GLASS_FIXING[brand] ?? 'dome';
  for (const g of L.glass) glassPanel(pb, g, F, group, fixing);
  return group;
}

/** Collision boxes of the glass panels' outer corner caps. */
export function glassCapBoxes(L: CaseLayout): Box[] {
  const out: Box[] = [];
  for (const g of L.glass) {
    const { m, u0, u1 } = panelFrame(g);
    const w = u1 - u0; const h = g.rect.max[1] - g.rect.min[1];
    const cx = (u0 + u1) / 2; const cy = (g.rect.min[1] + g.rect.max[1]) / 2;
    for (const [sx, sy] of capCorners(g)) {
      const lo = new THREE.Vector3(cx + sx * (w / 2 - CAP_INSET) - 6, cy + sy * (h / 2 - CAP_INSET) - 6, g.outer).applyMatrix4(m);
      const hi = new THREE.Vector3(cx + sx * (w / 2 - CAP_INSET) + 6, cy + sy * (h / 2 - CAP_INSET) + 6, g.outer + 4).applyMatrix4(m);
      out.push({ min: [Math.min(lo.x, hi.x), Math.min(lo.y, hi.y), Math.min(lo.z, hi.z)], max: [Math.max(lo.x, hi.x), Math.max(lo.y, hi.y), Math.max(lo.z, hi.z)], tag: 'glass-cap' });
    }
  }
  return out;
}

export function screwsAt(pb: PartBuilder, pts: THREE.Matrix4[], kind: 'pan' | 'flat' | 'hex' | 'button', color: number, r = 2.4) {
  const sg = screwGeometry(r, r * 0.55, kind);
  const sm = pb.own(new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.35, vertexColors: true }));
  pb.instanced(sg, sm, pts);
  sg.dispose();
}

/** Rubber grommets in a board tray at depth trayZ: a ring, a split membrane and a dark cable space behind each opening. */
export function trayGrommets(pb: PartBuilder, L: CaseLayout, F: CaseFinish, trayZ: number) {
  for (const gr of L.grommets) {
    if (gr.normal[2] !== 1) continue;
    const [gw, gh] = gr.size;
    const ring = rrectShape(gw + 6, gh + 6, Math.min(9, (gw + 6) / 2 - 0.5), gr.center[0], gr.center[1]);
    ring.holes.push(rrectHole(gw - 2, gh - 2, Math.min(6, gw / 2 - 1.5, gh / 2 - 1.5), gr.center[0], gr.center[1]));
    pb.add(extrude(ring, 2.8, 0.9, 'xy', 12, 2), F.foot, at(0, 0, trayZ - 1));
    // A split rubber membrane: two flaps along the opening's length, pushed back where cables pass, over a dark cable space.
    const along = gh >= gw; const span = along ? gh - 2 : gw - 2; const across = (along ? gw : gh) - 2; const flap = across * 0.34;
    for (const s of [1, -1]) {
      const g = new THREE.PlaneGeometry(along ? flap : span, along ? span : flap);
      const off = s * (across / 2 - flap / 2);
      const m = at(gr.center[0] + (along ? off : 0), gr.center[1] + (along ? 0 : off), trayZ - 0.4).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(along ? 0 : s * 0.5, along ? -s * 0.5 : 0, 0)));
      pb.add(g, 'rubber', m);
    }
    pb.add(new THREE.PlaneGeometry(gw + 4, gh + 4), 'darkVoid', at(gr.center[0], gr.center[1], trayZ - 22), { uv: 'keep' });
  }
}

/** Hex standoffs for every board size at the anchor, standing from the tray's front face. */
export function hexStandoffs(pb: PartBuilder, holes: [number, number][], anchor: [number, number, number], trayFront: number, light: boolean) {
  for (const [hx, hy] of holes) {
    const x = anchor[0] + hx; const y = anchor[1] + hy;
    const hex = new THREE.Shape();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; if (i) hex.lineTo(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2); else hex.moveTo(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2); }
    hex.closePath();
    pb.add(extrude(hex, 6.35 - 0.02, 0.2, 'xy', 6, 1), light ? 'nickel' : 'aluBlack', at(0, 0, trayFront));
  }
}
