import * as THREE from 'three';

export function makeMaterials(T) {
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const M = {};

  M.steel = S({ color: 0x15171c, metalness: 0.55, roughness: 0.52, roughnessMap: T.grain, bumpMap: T.grainFine, bumpScale: 0.35 });
  M.steelInner = S({ color: 0x111317, metalness: 0.5, roughness: 0.6, roughnessMap: T.grain, bumpMap: T.grainFine, bumpScale: 0.35 });
  M.steelBare = S({ color: 0x9a9da3, metalness: 1, roughness: 0.34, roughnessMap: T.brushed });
  M.alu = P({ color: 0x1b1d22, metalness: 1, roughness: 0.38, roughnessMap: T.brushed, anisotropy: 0.7, anisotropyRotation: 0 });
  M.aluLight = P({ color: 0xb9bcc4, metalness: 1, roughness: 0.3, roughnessMap: T.brushed, anisotropy: 0.7 });
  M.aluSatin = P({ color: 0x2a2d35, metalness: 1, roughness: 0.42, roughnessMap: T.brushed, anisotropy: 0.5 });
  M.fin = S({ color: 0x1a1c20, metalness: 0.9, roughness: 0.45 });
  M.finCore = S({ color: 0x0c0d10, metalness: 0.8, roughness: 0.55, bumpMap: T.fins, bumpScale: 2.5 });
  M.nickel = S({ color: 0xb4b7be, metalness: 1, roughness: 0.3 });
  M.gold = S({ color: 0xd8b56a, metalness: 1, roughness: 0.28 });
  M.plastic = S({ color: 0x0c0d10, metalness: 0, roughness: 0.62, roughnessMap: T.grain });
  M.plasticSoft = S({ color: 0x141519, metalness: 0, roughness: 0.78, roughnessMap: T.grain });
  M.gloss = P({ color: 0x050507, metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 });
  M.rubber = S({ color: 0x08080a, metalness: 0, roughness: 0.92 });
  M.pcb = P({ color: 0xffffff, map: T.pcbColor, bumpMap: T.pcbHeight, bumpScale: 0.6, metalness: 0.15, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  M.pcbPlain = P({ color: 0x07090d, metalness: 0.1, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  M.slot = S({ color: 0x101114, metalness: 0, roughness: 0.5 });
  M.sleeve = S({ color: 0x0d0d10, metalness: 0, roughness: 0.82, bumpMap: T.braid, bumpScale: 1.2 });
  M.sleeveAccent = S({ color: 0x6b2bd6, metalness: 0, roughness: 0.8, bumpMap: T.braid, bumpScale: 1.2 });
  M.blade = P({ color: 0x22242b, metalness: 0, roughness: 0.42, clearcoat: 0.15, clearcoatRoughness: 0.4, emissive: 0x000000, side: THREE.DoubleSide });
  M.mesh = S({ color: 0x15171c, metalness: 0.6, roughness: 0.5, alphaMap: T.perf, alphaTest: 0.5, side: THREE.DoubleSide, bumpMap: T.grainFine, bumpScale: 0.3 });
  M.desk = P({ color: 0x1a1824, metalness: 0, roughness: 1, specularIntensity: 0, transparent: true, opacity: 0.9 });
  M.wall = P({ color: 0x1d1b2a, metalness: 0, roughness: 1, specularIntensity: 0 });
  M.glassTint = new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.2, depthWrite: false });
  M.glassSpec = P({ color: 0x000000, metalness: 0, roughness: 0.035, ior: 1.52, specularIntensity: 1, envMapIntensity: 2.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  M.frit = S({ color: 0x050506, metalness: 0, roughness: 0.3 });
  return M;
}

export function ledMaterial(tex, intensity = 3.2) {
  return new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.35, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: intensity });
}
