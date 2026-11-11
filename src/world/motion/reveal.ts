import * as THREE from 'three';

export type Reveal = { material: THREE.Material; set: (share: number) => void };

/**
 * A run's wires drawn only up to a share of their length, measured from the supply end, so a new run grows in from where the
 * power comes. With invert, only the part beyond that share is drawn: the old colorway giving way as the new one sweeps along.
 * The tube's u coordinate is its length in millimeters, so the cut is exact on every wire of the run.
 */
export function revealMaterial(base: THREE.Material, length: number, fromEnd: boolean, invert = false): Reveal {
  const m = base.clone();
  const uniforms = { uReveal: { value: 0 }, uLen: { value: length }, uFromEnd: { value: fromEnd ? 1 : 0 }, uInvert: { value: invert ? 1 : 0 } };
  const inner = base.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    inner.call(base, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = uv.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlong;\nuniform float uReveal;\nuniform float uLen;\nuniform float uFromEnd;\nuniform float uInvert;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat revealAt = uFromEnd > 0.5 ? uLen - vAlong : vAlong;\nif ((revealAt > uReveal) != (uInvert > 0.5)) discard;');
  };
  const key = base.customProgramCacheKey.bind(base);
  m.customProgramCacheKey = () => `${key()}|reveal`;
  return { material: m, set: (share) => { uniforms.uReveal.value = share * length + (share >= 1 ? 1 : 0); } };
}
