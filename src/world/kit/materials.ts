import * as THREE from 'three';
import { textures, TILE_MM, type TextureSet } from './textures';

export type MatName =
  | 'powderBlack' | 'powderBlackInner' | 'powderWhite' | 'powderWhiteInner' | 'powderGunmetal' | 'powderGunmetalInner'
  | 'steelBare' | 'steelZinc'
  | 'aluBlack' | 'aluSilver' | 'aluWhite' | 'aluRaw' | 'aluBrushed' | 'aluBrushedDark' | 'aluSatinDark' | 'aluGunmetal'
  | 'nickel' | 'copper' | 'gold' | 'solder'
  | 'plasticMatte' | 'plasticSoft' | 'plasticGloss' | 'plasticWhite' | 'plasticWhiteGloss' | 'plasticGrey' | 'plasticDark' | 'plasticNylon'
  | 'rubber' | 'rubberWhite'
  | 'pcbBlack' | 'pcbWhite' | 'pcbGreen' | 'pcbEdge' | 'chip' | 'chipWhite' | 'ceramic' | 'ferrite'
  | 'glassTint' | 'glassSpec' | 'glassEdge' | 'frit'
  | 'bladeSmoke' | 'bladeFrost' | 'bladeBlack' | 'bladeWhite'
  | 'finDark' | 'finSilver' | 'finNickel' | 'radCore' | 'radCoreWhite'
  | 'meshBlack' | 'meshWhite' | 'meshGunmetal' | 'meshRaw'
  | 'labelPaper' | 'sticker'
  | 'thermalPad' | 'diffuserOff' | 'darkVoid'
  | 'desk' | 'wall';

let T: TextureSet | null = null;
const cache = new Map<string, THREE.Material>();

const tex = () => { if (!T) T = textures(); return T; };

function physical(o: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial(o);
}

const powder = (color: number, rough: number, coat: number) => physical({
  color, metalness: 0, roughness: rough, roughnessMap: tex().grain, bumpMap: tex().peel, bumpScale: 0.14,
  clearcoat: coat, clearcoatRoughness: 0.42, specularIntensity: 0.6,
});

const metal = (color: number, rough: number, map: THREE.Texture | null, extra: THREE.MeshPhysicalMaterialParameters = {}) => physical({
  color, metalness: 1, roughness: rough, roughnessMap: map, ...extra,
});

const plastic = (color: number, rough: number, extra: THREE.MeshPhysicalMaterialParameters = {}) => physical({
  color, metalness: 0, roughness: rough, roughnessMap: tex().grain, specularIntensity: 0.55, ...extra,
});

function makeMat(name: MatName): THREE.Material {
  const t = tex();
  switch (name) {
    case 'powderBlack': return powder(0x28292e, 0.58, 0.14);
    case 'powderBlackInner': return powder(0x222327, 0.66, 0.06);
    case 'powderWhite': return powder(0xe4e5e9, 0.42, 0.35);
    case 'powderWhiteInner': return powder(0xcfd1d6, 0.5, 0.2);
    case 'powderGunmetal': return physical({ color: 0x45484f, metalness: 0.55, roughness: 0.4, roughnessMap: t.grainFine, bumpMap: t.peel, bumpScale: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.22 });
    case 'powderGunmetalInner': return physical({ color: 0x2e3036, metalness: 0.45, roughness: 0.5, roughnessMap: t.grainFine, bumpMap: t.peel, bumpScale: 0.25, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    case 'steelBare': return metal(0xa6a9af, 0.34, t.grainFine);
    case 'steelZinc': return metal(0x9a9da2, 0.42, t.grain, { bumpMap: t.mottle, bumpScale: 0.2 });
    case 'aluBlack': return metal(0x34363b, 0.42, t.bead, { bumpMap: t.bead, bumpScale: 0.08 });
    case 'aluSilver': return metal(0xc4c7cd, 0.3, t.brushed, { anisotropy: 0.6 });
    case 'aluWhite': return physical({ color: 0xe8e9ec, metalness: 0.15, roughness: 0.38, roughnessMap: t.bead, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    case 'aluRaw': return metal(0xbabdc2, 0.5, t.bead, { bumpMap: t.bead, bumpScale: 0.1 });
    case 'aluBrushed': return metal(0xbfc2c8, 0.28, t.brushed, { anisotropy: 0.85, bumpMap: t.brushed, bumpScale: 0.08 });
    case 'aluBrushedDark': return metal(0x30333a, 0.3, t.brushed, { anisotropy: 0.8, bumpMap: t.brushed, bumpScale: 0.08 });
    case 'aluSatinDark': return metal(0x464950, 0.36, t.brushed, { anisotropy: 0.5 });
    case 'aluGunmetal': return metal(0x4b4e55, 0.38, t.brushed, { anisotropy: 0.6 });
    case 'nickel': return metal(0xcdced2, 0.17, t.grainFine);
    case 'copper': return metal(0xd38b5d, 0.28, t.grainFine);
    case 'gold': return metal(0xe3bc68, 0.22, null);
    case 'solder': return metal(0xb9bcc0, 0.3, null);
    case 'plasticMatte': return plastic(0x232428, 0.6);
    case 'plasticSoft': return plastic(0x25262b, 0.82, { sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x3a3d48) });
    case 'plasticGloss': return physical({ color: 0x0b0b0e, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
    case 'plasticWhite': return plastic(0xe1e2e6, 0.55);
    case 'plasticWhiteGloss': return physical({ color: 0xe9eaed, metalness: 0, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    case 'plasticGrey': return plastic(0x55585f, 0.6);
    case 'plasticDark': return plastic(0x1b1c20, 0.5);
    case 'plasticNylon': return plastic(0xd8d4c8, 0.6);
    case 'rubber': return physical({ color: 0x18181b, metalness: 0, roughness: 0.94, roughnessMap: t.grainFine, specularIntensity: 0.3 });
    case 'rubberWhite': return physical({ color: 0xd6d7db, metalness: 0, roughness: 0.92, specularIntensity: 0.3 });
    case 'pcbBlack': return physical({ color: 0x14181d, metalness: 0.1, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, roughnessMap: t.grainFine });
    case 'pcbWhite': return physical({ color: 0xe6e7ea, metalness: 0.05, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2, roughnessMap: t.grainFine });
    case 'pcbGreen': return physical({ color: 0x0f3a24, metalness: 0.05, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    case 'pcbEdge': return physical({ color: 0x8b7f5c, metalness: 0, roughness: 0.75 });
    case 'chip': return physical({ color: 0x1e1f23, metalness: 0, roughness: 0.55, roughnessMap: t.grainFine });
    case 'chipWhite': return physical({ color: 0xcfd0d4, metalness: 0, roughness: 0.5 });
    case 'ceramic': return physical({ color: 0x8a7a62, metalness: 0, roughness: 0.6 });
    case 'ferrite': return physical({ color: 0x24252a, metalness: 0.2, roughness: 0.55, roughnessMap: t.grain });
    case 'glassTint': return new THREE.MeshPhysicalMaterial({ color: 0x0b0c12, metalness: 0, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false, specularIntensity: 0 });
    case 'glassSpec': return physical({ color: 0x000000, metalness: 0, roughness: 0.03, ior: 1.52, specularIntensity: 1, envMapIntensity: 3.2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    case 'glassEdge': return physical({ color: 0x3f6b62, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.85, clearcoat: 1, clearcoatRoughness: 0.02 });
    case 'frit': return physical({ color: 0x07080a, metalness: 0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.1 });
    case 'bladeSmoke': return physical({ color: 0x101115, metalness: 0, roughness: 0.46, specularIntensity: 0.35, transparent: true, opacity: 0.9, clearcoat: 0.08, clearcoatRoughness: 0.2, side: THREE.DoubleSide, emissive: 0x000000 });
    case 'bladeFrost': return physical({ color: 0xe9ebf0, metalness: 0, roughness: 0.55, transparent: true, opacity: 0.92, side: THREE.DoubleSide, emissive: 0x000000 });
    case 'bladeBlack': return physical({ color: 0x1f2024, metalness: 0, roughness: 0.42, side: THREE.DoubleSide, roughnessMap: t.grainFine });
    case 'bladeWhite': return physical({ color: 0xe2e3e7, metalness: 0, roughness: 0.5, side: THREE.DoubleSide });
    case 'finDark': return metal(0x33353b, 0.4, t.grainFine);
    case 'finSilver': return metal(0xb8bbc1, 0.32, t.grainFine);
    case 'finNickel': return metal(0xc9cbcf, 0.24, t.grainFine);
    case 'radCore': return physical({ color: 0x1f2024, metalness: 0.5, roughness: 0.55, roughnessMap: t.grain });
    case 'radCoreWhite': return physical({ color: 0xdcdde1, metalness: 0.2, roughness: 0.5, roughnessMap: t.grain });
    case 'meshBlack': return physical({ color: 0x26272c, metalness: 0, roughness: 0.6, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, bumpMap: t.peel, bumpScale: 0.2 });
    case 'meshWhite': return physical({ color: 0xe1e2e6, metalness: 0, roughness: 0.45, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
    case 'meshGunmetal': return physical({ color: 0x45484f, metalness: 0.5, roughness: 0.42, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
    case 'meshRaw': return physical({ color: 0xb6b9be, metalness: 1, roughness: 0.48, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
    case 'labelPaper': return physical({ color: 0xc9cacd, metalness: 0, roughness: 0.6 });
    case 'sticker': return physical({ color: 0x1a1b1f, metalness: 0, roughness: 0.35, clearcoat: 0.5 });
    case 'thermalPad': return physical({ color: 0x5f6670, metalness: 0, roughness: 0.8 });
    case 'diffuserOff': return physical({ color: 0x2a2b31, metalness: 0, roughness: 0.4, transmission: 0, clearcoat: 0.2 });
    case 'darkVoid': return new THREE.MeshBasicMaterial({ color: 0x050507 });
    case 'desk': return physical({ color: 0x17161f, metalness: 0, roughness: 1, specularIntensity: 0, map: t.mottle, transparent: true, opacity: 0.86 });
    case 'wall': return physical({ color: 0x1b1a26, metalness: 0, roughness: 1, specularIntensity: 0, map: t.soft });
  }
}

export function mat(name: MatName): THREE.Material {
  let m = cache.get(name);
  if (!m) {
    m = makeMat(name);
    m.name = name;
    cache.set(name, m);
  }
  return m;
}

const sleeveCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** Braided sleeve in any color. */
export function sleeve(color: string): THREE.MeshPhysicalMaterial {
  let m = sleeveCache.get(color);
  if (!m) {
    const t = tex();
    m = physical({ color: new THREE.Color(color), metalness: 0, roughness: 0.72, bumpMap: t.braid, bumpScale: 0.9, sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xc8c8d0), 0.35), specularIntensity: 0.5 });
    m.name = `sleeve-${color}`;
    sleeveCache.set(color, m);
  }
  return m;
}

export function setPerfAspect() {
  const t = tex();
  t.perf.repeat.set(1 / TILE_MM.perf, 1 / (TILE_MM.perf * Math.sqrt(3)));
}

/** A finish is a set of material assignments for the painted and anodized surfaces of a case. */
export type CaseFinish = { shell: MatName; inner: MatName; accent: MatName; mesh: MatName; trim: MatName; foot: MatName; light: boolean };

export const FINISHES: Record<string, CaseFinish> = {
  onyx: { shell: 'powderBlack', inner: 'powderBlackInner', accent: 'aluBlack', mesh: 'meshBlack', trim: 'plasticMatte', foot: 'rubber', light: false },
  frost: { shell: 'powderWhite', inner: 'powderWhiteInner', accent: 'aluWhite', mesh: 'meshWhite', trim: 'plasticWhite', foot: 'rubberWhite', light: true },
  gunmetal: { shell: 'powderGunmetal', inner: 'powderGunmetalInner', accent: 'aluGunmetal', mesh: 'meshGunmetal', trim: 'plasticMatte', foot: 'rubber', light: false },
  raw: { shell: 'aluRaw', inner: 'aluRaw', accent: 'aluBrushed', mesh: 'meshRaw', trim: 'plasticMatte', foot: 'rubber', light: true },
};

/** Part colorways: graphite is black and dark metal, frost is white and pale metal. */
export type PartFinish = { body: MatName; metal: MatName; pcb: MatName; plastic: MatName; fin: MatName; blade: MatName };
export const PART_FINISHES: Record<'graphite' | 'frost', PartFinish> = {
  graphite: { body: 'plasticMatte', metal: 'aluBrushedDark', pcb: 'pcbBlack', plastic: 'plasticMatte', fin: 'finDark', blade: 'bladeBlack' },
  frost: { body: 'plasticWhite', metal: 'aluBrushed', pcb: 'pcbWhite', plastic: 'plasticWhite', fin: 'finSilver', blade: 'bladeWhite' },
};

export function disposeMaterials() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
  for (const m of sleeveCache.values()) m.dispose();
  sleeveCache.clear();
}
