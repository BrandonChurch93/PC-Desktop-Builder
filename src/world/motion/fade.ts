import * as THREE from 'three';

type Faded = { mesh: THREE.Mesh | THREE.InstancedMesh | THREE.LineSegments; original: THREE.Material | THREE.Material[]; clones: THREE.Material[]; base: number[] };

/**
 * One object's opacity, for fading a part in or out without touching the shared materials: each mesh gets a transparent clone
 * of its material for the fade, keeping the compile hooks so perforation, LED and label shaders still apply, and gets its own
 * material back when the fade ends at full opacity.
 */
export class Fader {
  private faded: Faded[] = [];
  private value = 1;

  constructor(readonly root: THREE.Object3D) {}

  get opacity() { return this.value; }

  set(v: number) {
    this.value = v;
    if (v >= 0.999) { this.restore(); this.root.visible = true; return; }
    if (!this.faded.length) this.capture();
    this.root.visible = v > 0.001;
    for (const f of this.faded) f.clones.forEach((c, i) => { c.opacity = (f.base[i] ?? 1) * v; });
  }

  private capture() {
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
      const original = o.material as THREE.Material | THREE.Material[];
      const list = Array.isArray(original) ? original : [original];
      const clones = list.map((m) => {
        const c = m.clone();
        c.onBeforeCompile = m.onBeforeCompile;
        c.customProgramCacheKey = m.customProgramCacheKey;
        c.transparent = true;
        c.depthWrite = m.transparent ? m.depthWrite : true;
        return c;
      });
      o.material = Array.isArray(original) ? clones : clones[0]!;
      this.faded.push({ mesh: o, original, clones, base: list.map((m) => (m.transparent ? m.opacity : 1)) });
    });
  }

  restore() {
    for (const f of this.faded) { f.mesh.material = f.original; for (const c of f.clones) c.dispose(); }
    this.faded = [];
  }

  dispose() { this.restore(); }
}
