import * as THREE from 'three';
import type { Socket } from '../../engine/queries';
import type { Build } from '../../engine/types';
import { forcePlace } from '../layout/force';
import type { Placed } from '../layout/place';
import { displayColor } from '../post';
import { token } from '../tokens';

export type SocketView = {
  socket: Socket;
  /** case space bounds of the part at this place, mm */
  box: THREE.Box3;
  /** the part's objects at this place, for the held model's preview pose */
  placed: Placed[];
  group: THREE.Group;
  line: THREE.LineSegments;
  fill: THREE.Mesh;
};

type State = 'idle' | 'near';

/**
 * Where a held part can go: the outline of the part's bounds at each place, with dashes that move and a faint fill. Valid places
 * take the accent, blocked ones the danger color, both read from the design tokens. A liquid cooler's places are its radiator's.
 */
export class Sockets {
  readonly group = new THREE.Group();
  views: SocketView[] = [];
  private mats: { line: THREE.LineDashedMaterial; fill: THREE.MeshBasicMaterial; offset: { value: number } }[] = [];

  constructor(overlay: THREE.Scene, private space: THREE.Object3D) {
    this.group.name = 'sockets';
    overlay.add(this.group);
  }

  show(build: Build, sockets: Socket[]) {
    this.clear();
    for (const socket of sockets) {
      let placed = forcePlace(build, socket.category, socket.id, socket.opts);
      if (socket.category === 'cooler' && placed.some((p) => p.kind === 'radiator')) placed = placed.filter((p) => p.kind === 'radiator');
      const box = new THREE.Box3();
      for (const p of placed) for (const b of p.boxes) { box.expandByPoint(new THREE.Vector3(...b.min)); box.expandByPoint(new THREE.Vector3(...b.max)); }
      if (box.isEmpty()) continue;
      const color = displayColor(token(socket.ok ? 'accent' : 'danger'));
      const offset = { value: 0 };
      const line = new THREE.LineDashedMaterial({ color, dashSize: 7, gapSize: 5, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });
      line.onBeforeCompile = (sh) => {
        sh.uniforms.dashOffset = offset;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float dashOffset;').replace('vLineDistance = scale * lineDistance;', 'vLineDistance = scale * lineDistance - dashOffset;');
      };
      line.customProgramCacheKey = () => 'socket-dash';
      const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(2, 2, 2)); const center = box.getCenter(new THREE.Vector3());
      const g = new THREE.Group();
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), line);
      edges.computeLineDistances();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), fill);
      g.add(edges, mesh); g.position.copy(center);
      g.renderOrder = 5;
      this.group.add(g);
      this.mats.push({ line, fill, offset });
      this.views.push({ socket, box, placed, group: g, line: edges, fill: mesh });
    }
    this.sync();
  }

  /** The sockets follow the rig's transform: they are drawn in a separate scene. */
  sync() {
    this.space.updateMatrixWorld();
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(this.space.matrixWorld);
    this.group.matrixWorldNeedsUpdate = true;
  }

  /** The nearest place within reach brightens; dashes move with time. */
  update(time: number, near: number | null) {
    this.mats.forEach((m, i) => {
      const s: State = near === i ? 'near' : 'idle';
      m.offset.value = time * 18;
      m.line.opacity = s === 'near' ? 1 : 0.7;
      m.fill.opacity = s === 'near' ? 0.09 : 0.05;
    });
  }

  clear() {
    for (const v of this.views) { v.group.removeFromParent(); v.line.geometry.dispose(); v.fill.geometry.dispose(); }
    for (const m of this.mats) { m.line.dispose(); m.fill.dispose(); }
    this.views = []; this.mats = [];
  }

  get active() { return this.views.length > 0; }
}
