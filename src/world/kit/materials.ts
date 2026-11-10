import * as THREE from 'three';
import { canvas, PERF_HOLE, textures, TILE_MM, wrap, type TextureSet } from './textures';
import { seededFor } from './rng';

/** A spun finish: fine concentric rings of varying tone, for a round part pressed or turned on a lathe. Uv 0..1 across it. */
let spunTex: THREE.Texture | null = null;
function spun(): THREE.Texture {
  if (spunTex) return spunTex;
  const S = 1024; const { canvas: c, g } = canvas(S, S);
  const r = seededFor('spun');
  g.fillStyle = 'rgb(180,180,180)'; g.fillRect(0, 0, S, S);
  for (let rad = S / 2; rad > 2; rad -= 1 + r() * 1.5) {
    const v = 150 + Math.floor(r() * 70);
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + r();
    g.beginPath(); g.arc(S / 2, S / 2, rad, 0, Math.PI * 2); g.stroke();
  }
  spunTex = wrap(c, { repeat: false });
  return spunTex;
}

export type MatName =
  | 'powderBlack' | 'powderBlackInner' | 'powderWhite' | 'powderWhiteInner' | 'powderGunmetal' | 'powderGunmetalInner' | 'powderPanel' | 'panelPowder' | 'finAnodized' | 'capTop' | 'capBody' | 'pcbCore' | 'stickerMatte' | 'chipTop' | 'plasticMolded' | 'finGraphite' | 'aluLidStamp' | 'aluLid' | 'aluStamp'
  | 'steelBare' | 'steelZinc'
  | 'aluBlack' | 'aluSilver' | 'aluWhite' | 'aluRaw' | 'aluBrushed' | 'aluBrushedDark' | 'aluBrushedPlate' | 'aluAnodized' | 'aluCast' | 'aluSatin' | 'aluSatinDark' | 'aluGunmetal' | 'aluFacet'
  | 'nickel' | 'nickelLapped' | 'pipeNickel' | 'copper' | 'gold' | 'solder'
  | 'plasticMatte' | 'plasticSatin' | 'plasticSoft' | 'plasticGloss' | 'plasticWhite' | 'plasticWhiteGloss' | 'plasticGrey' | 'plasticDark' | 'plasticNylon'
  | 'rubber' | 'rubberWhite' | 'rubberPad'
  | 'pcbBlack' | 'pcbWhite' | 'pcbGreen' | 'pcbEdge' | 'chip' | 'chipWhite' | 'ceramic' | 'ferrite'
  | 'glassTint' | 'glassSpec' | 'glassEdge' | 'frit'
  | 'bladeSmoke' | 'bladeFrost' | 'bladeBlack' | 'bladeWhite'
  | 'finDark' | 'finGrey' | 'finSilver' | 'finNickel' | 'radCore' | 'radCoreWhite'
  | 'meshBlack' | 'meshWhite' | 'meshGunmetal' | 'meshRaw'
  | 'labelPaper' | 'sticker'
  | 'thermalPad' | 'diffuserOff' | 'darkVoid'
  | 'desk' | 'wall';

/**
 * three r187 normalizes the screen derivatives in its bump mapping, so a bump is measured per pixel: a fine texture flattens as
 * the camera comes closer, which is the opposite of what leaning in should show. With WORLD_BUMP defined a material keeps the
 * original surface gradient form, where bumpScale is a height in meters per unit of the map, so detail holds up close and
 * averages out with distance.
 */
const SIGMA = /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);\s*vec3 vSigmaY = normalize\( dFdy\( surf_pos\.xyz \) \);/;
if (!SIGMA.test(THREE.ShaderChunk.bumpmap_pars_fragment)) throw new Error('bump chunk changed: WORLD_BUMP patch no longer applies');
THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment.replace(SIGMA, [
  '#ifdef WORLD_BUMP',
  '\t\tvec3 vSigmaX = dFdx( surf_pos.xyz );',
  '\t\tvec3 vSigmaY = dFdy( surf_pos.xyz );',
  '#else',
  '\t\tvec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );',
  '\t\tvec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );',
  '#endif',
].join('\n'));

function worldBump<M extends THREE.Material>(m: M): M {
  m.defines = { ...(m.defines ?? {}), WORLD_BUMP: '' };
  return m;
}

let T: TextureSet | null = null;
const cache = new Map<string, THREE.Material>();

const tex = () => { if (!T) T = textures(); return T; };

function physical(o: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial(o);
}

/** Powder coat: a slow roughness drift and a fine orange peel, its height in meters per unit of the map. */
const powder = (color: number, rough: number, coat: number, peel = 1.5e-5) => worldBump(physical({
  color, metalness: 0, roughness: rough, roughnessMap: tex().mottleMid, bumpMap: tex().orange, bumpScale: peel,
  clearcoat: coat, clearcoatRoughness: 0.42, specularIntensity: 0.6,
}));

const metal = (color: number, rough: number, map: THREE.Texture | null, extra: THREE.MeshPhysicalMaterialParameters = {}) => physical({
  color, metalness: 1, roughness: rough, roughnessMap: map, ...extra,
});

const plastic = (color: number, rough: number, extra: THREE.MeshPhysicalMaterialParameters = {}) => physical({
  color, metalness: 0, roughness: rough, roughnessMap: tex().grain, specularIntensity: 0.55, ...extra,
});

/** Mean coverage of the perforation tile: two holes of radius 0.38 tile in a 1 by root 3 cell leave 52 percent open. */
const PERF_MEAN = 0.48;

/** Thickness of a fine perforated sheet. The sheet is drawn as one plane at its middle and the shader adds the thickness. */
export const PERF_SHEET_MM = 0.6;

/**
 * Perforated sheet, drawn as one plane at the middle of a sheet with real thickness. For each pixel the view ray is
 * followed through the sheet: where it enters on metal it shows the face, where it enters a hole and leaves through the
 * same hole it shows what lies behind, and otherwise it shows the hole's wall, shaded with the wall's own normal. So a
 * sheet seen at an angle shows round holes with lit and shaded walls, as stamped steel does. Edges are smoothed over one
 * pixel along the screen gradient of each distance. Where a pixel reaches across about half a hole, the coverage blends
 * to the sheet's mean, so a distant panel reads as fine mesh and not as moire.
 */
function perforatedSheet(m: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const tw = TILE_MM.perf; const th = TILE_MM.perf * Math.sqrt(3); const d = TILE_MM.perf * PERF_HOLE; const r = d / 2;
  const f = (x: number) => x.toFixed(4);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', [
      '#ifdef USE_ALPHAMAP',
      `  vec2 perfT = vec2(${f(tw)}, ${f(th)});`,
      '  vec2 perfP = vAlphaMapUv * perfT;',
      '  vec2 perfS0 = dFdx(perfP); vec2 perfS1 = dFdy(perfP);',
      '  vec3 perfN = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);',
      '  vec3 perfQ0 = dFdx(-vViewPosition); vec3 perfQ1 = dFdy(-vViewPosition);',
      '  vec3 perfQ1p = cross(perfQ1, perfN); vec3 perfQ0p = cross(perfN, perfQ0);',
      '  vec3 perfTu = normalize(perfQ1p * perfS0.x + perfQ0p * perfS1.x + 1e-9);',
      '  vec3 perfTv = normalize(perfQ1p * perfS0.y + perfQ0p * perfS1.y + 1e-9);',
      '  vec3 perfV = normalize(vViewPosition);',
      '  vec3 perfVt = vec3(dot(perfV, perfTu), dot(perfV, perfTv), max(dot(perfV, perfN), 0.08));',
      `  vec2 perfShift = perfVt.xy * (${f(PERF_SHEET_MM / 2)} / perfVt.z);`,
      '  vec2 perfNear = perfP + perfShift; vec2 perfFarP = perfP - perfShift;',
      '  vec2 perfQn = mod(perfNear, perfT); vec2 perfBase = perfNear - perfQn;',
      '  vec2 perfCa = perfBase + perfT * floor(perfQn / perfT + 0.5);',
      '  vec2 perfCb = perfBase + 0.5 * perfT;',
      '  vec2 perfC = length(perfNear - perfCa) < length(perfNear - perfCb) ? perfCa : perfCb;',
      `  float perfDn = length(perfNear - perfC) - ${f(r)};`,
      `  float perfDx = length(perfFarP - perfC) - ${f(r)};`,
      '  float perfFace = clamp(perfDn / max(length(vec2(dFdx(perfDn), dFdy(perfDn))), 1e-4) + 0.5, 0.0, 1.0);',
      '  float perfWallA = clamp(perfDx / max(length(vec2(dFdx(perfDx), dFdy(perfDx))), 1e-4) + 0.5, 0.0, 1.0);',
      '  float perfSharp = perfFace + (1.0 - perfFace) * perfWallA;',
      '  float perfFoot = max(length(perfS0), length(perfS1));',
      `  float perfFarK = smoothstep(${f(0.45 * d)}, ${f(0.9 * d)}, perfFoot);`,
      '  float perfWall = (1.0 - perfFarK) * (1.0 - perfFace) * perfWallA / max(perfSharp, 1e-3);',
      '  vec2 perfRa = perfFarP - perfNear; vec2 perfRb = perfNear - perfC;',
      '  float perfAa = max(dot(perfRa, perfRa), 1e-6); float perfAb = dot(perfRa, perfRb);',
      `  float perfK = clamp((-perfAb + sqrt(max(perfAb * perfAb - perfAa * (dot(perfRb, perfRb) - ${f(r * r)}), 0.0))) / perfAa, 0.0, 1.0);`,
      '  vec2 perfHit = perfRb + perfRa * perfK;',
      '  vec2 perfDir = perfHit / max(length(perfHit), 1e-4);',
      '  vec3 perfWallN = normalize(-(perfTu * perfDir.x + perfTv * perfDir.y));',
      `  diffuseColor.a = mix(perfSharp, ${PERF_MEAN.toFixed(2)}, perfFarK);`,
      '  diffuseColor.rgb *= 1.0 - perfWall * (0.2 + 0.6 * perfK);',
      '  if (diffuseColor.a < 0.02) discard;',
      '#endif',
    ].join('\n')).replace('#include <normal_fragment_maps>', [
      '#include <normal_fragment_maps>',
      '#ifdef USE_ALPHAMAP',
      '  normal = normalize(mix(normal, perfWallN, perfWall));',
      '#endif',
    ].join('\n'));
  };
  m.customProgramCacheKey = () => 'perforated-sheet';
  return m;
}

function makeMat(name: MatName): THREE.Material {
  const t = tex();
  switch (name) {
    case 'powderBlack': return powder(0x28292e, 0.58, 0.14);
    case 'powderBlackInner': return powder(0x222327, 0.74, 0, 1e-5);
    // The socket panel is seen close up: an orange peel that reads at that range, which on the whole shell read as leather.
    case 'panelPowder': return physical({ color: 0x323439, metalness: 0, roughness: 0.42, roughnessMap: t.grain, bumpMap: t.peel, bumpScale: 2.4, clearcoat: 0.15, clearcoatRoughness: 0.45, specularIntensity: 0.6 });
    case 'powderPanel': return physical({ color: 0x34363c, metalness: 0, roughness: 0.5, roughnessMap: t.peel, bumpMap: t.grainFine, bumpScale: 0.22, clearcoat: 0.2, clearcoatRoughness: 0.45, specularIntensity: 0.6 });
    case 'powderWhite': return powder(0xe4e5e9, 0.42, 0.35);
    case 'powderWhiteInner': return powder(0xcfd1d6, 0.5, 0.2, 1e-5);
    case 'powderGunmetal': return physical({ color: 0x45484f, metalness: 0.55, roughness: 0.4, roughnessMap: t.grainFine, bumpMap: t.peel, bumpScale: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.22 });
    case 'powderGunmetalInner': return physical({ color: 0x2e3036, metalness: 0.45, roughness: 0.5, roughnessMap: t.grainFine, bumpMap: t.peel, bumpScale: 0.25, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    case 'steelBare': return metal(0xa6a9af, 0.34, t.grainFine);
    case 'steelZinc': return metal(0x9a9da2, 0.42, t.grain, { bumpMap: t.mottle, bumpScale: 0.2 });
    case 'aluBlack': return metal(0x34363b, 0.42, t.bead, { bumpMap: t.bead, bumpScale: 0.08 });
    case 'aluSilver': return metal(0xc4c7cd, 0.3, t.brushed, { anisotropy: 0.6 });
    case 'aluWhite': return physical({ color: 0xe8e9ec, metalness: 0.15, roughness: 0.38, roughnessMap: t.bead, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    case 'aluRaw': return metal(0xbabdc2, 0.5, t.bead, { bumpMap: t.bead, bumpScale: 0.1 });
    case 'aluBrushed': return metal(0xbfc2c8, 0.28, t.brushed, { anisotropy: 0.85, bumpMap: t.brushed, bumpScale: 0.08 });
    case 'aluBrushedDark': return metal(0x30333a, 0.3, t.brushed, { anisotropy: 0.8, bumpMap: t.brushed, bumpScale: 0.2 });
    case 'aluBrushedPlate': return metal(0x383b43, 0.68, t.brushedCoarse, { anisotropy: 0.3, bumpMap: t.brushedCoarse, bumpScale: 0.12 });
    // A dark coated casting: bare grey metal mirrored the key light as a lone hot point on the rounded corners.
    case 'aluCast': return metal(0x4a4d53, 0.64, t.grain);
    // Thin anodized fins are seen edge on, where a clearcoat and half metal turned them silver: matte and mostly dielectric.
    case 'finAnodized': return physical({ color: 0x18191c, metalness: 0.3, roughness: 0.64, roughnessMap: t.mottle });
    case 'capTop': return metal(0x9a9da3, 0.62, t.mottle);
    case 'capBody': return metal(0x2c2e33, 0.55, t.mottle);
    // Graphite cards: a darker fin grey, so fins seen through the backplate's vents read as fins and not as bright bars.
    case 'finGraphite': return metal(0x5e6168, 0.62, t.mottle);
    case 'aluAnodized': return physical({ color: 0x1c1d21, metalness: 0.5, roughness: 0.52, roughnessMap: t.grainFine, clearcoat: 0.2, clearcoatRoughness: 0.5 });
    case 'aluSatin': return metal(0xc4c7cc, 0.5, t.brushedCoarse);
    // A drive cover seen at the closest zoom: a fine brush, as the coarse one broke into dark streaks there.
    case 'aluLid': return metal(0xc4c7cc, 0.5, t.brushed);
    case 'aluStamp': return metal(0xc0c3c8, 0.44, t.mottle);
    case 'aluSatinDark': return metal(0x464950, 0.36, t.brushed, { anisotropy: 0.5 });
    case 'aluGunmetal': return metal(0x4b4e55, 0.38, t.brushed, { anisotropy: 0.6 });
    // Memory facets: satin anodized, rough enough that each tilted plane takes the softboxes from a wide angle.
    case 'aluFacet': return metal(0x5c6068, 0.5, t.brushed, { anisotropy: 0.35 });
    case 'nickel': return metal(0xcdced2, 0.22, t.grainFine);
    // Seen from above through a backplate cutout the pipes mirror the overhead softbox; capped so they stay metal grey.
    case 'pipeNickel': return capHighlights(metal(0x9c9fa5, 0.62, t.mottle), 0.3, 'pipe-nickel');
    // Bloom is for LEDs: the radiused spreader corner mirrored the key softbox above the bloom threshold and flared.
    case 'nickelLapped': return capHighlights(metal(0xaeb0b4, 0.52, t.lap, { bumpMap: t.lap, bumpScale: 0.01 }), 1.3, 'nickel-lapped');
    case 'aluLidStamp': return metal(0xc0c3c8, 0.5, spun(), { bumpMap: spun(), bumpScale: 0.02 });
    case 'copper': return metal(0xd38b5d, 0.28, t.grainFine);
    case 'gold': return metal(0xe3bc68, 0.22, null);
    case 'solder': return metal(0xb9bcc0, 0.3, null);
    case 'plasticMatte': return plastic(0x232428, 0.6);
    // A card shroud's textured molded finish, visible at the closest zoom.
    case 'plasticSatin': return worldBump(physical({ color: 0x222328, metalness: 0, roughness: 0.5, roughnessMap: t.bead, bumpMap: t.stipple, bumpScale: 2.8e-5, specularIntensity: 0.6 }));
    case 'plasticSoft': return plastic(0x25262b, 0.82, { sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x3a3d48) });
    case 'plasticGloss': return physical({ color: 0x0f0f12, metalness: 0, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.14 });
    case 'plasticWhite': return plastic(0xe1e2e6, 0.55);
    case 'plasticWhiteGloss': return physical({ color: 0xe9eaed, metalness: 0, roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    case 'plasticGrey': return plastic(0x55585f, 0.6);
    case 'plasticDark': return plastic(0x1b1c20, 0.5);
    case 'plasticNylon': return plastic(0xd8d4c8, 0.6);
    case 'rubber': return physical({ color: 0x18181b, metalness: 0, roughness: 0.94, roughnessMap: t.grainFine, specularIntensity: 0.3 });
    case 'rubberWhite': return physical({ color: 0xd6d7db, metalness: 0, roughness: 0.92, specularIntensity: 0.3 });
    case 'rubberPad': return physical({ color: 0x3a3c42, metalness: 0, roughness: 0.86, roughnessMap: t.grainFine, specularIntensity: 0.34, sheen: 0.25, sheenRoughness: 0.6, sheenColor: 0x5a5d66 });
    case 'pcbBlack': return physical({ color: 0x14181d, metalness: 0.05, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4, roughnessMap: t.grainFine });
    case 'pcbWhite': return physical({ color: 0xe6e7ea, metalness: 0.05, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2, roughnessMap: t.grainFine });
    case 'pcbGreen': return physical({ color: 0x0f3a24, metalness: 0.05, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    case 'pcbEdge': return physical({ color: 0x8b7f5c, metalness: 0, roughness: 0.75 });
    // Label stock rolled over chips: matte, so its rolled edge does not read as a polished rim.
    // A controller's molded top: matte with the faint mottling of the mold and a laser marked finish.
    case 'chipTop': return physical({ color: 0x1e1f23, metalness: 0, roughness: 0.62, roughnessMap: t.mottle, bumpMap: t.bead, bumpScale: 0.04 });
    case 'stickerMatte': return physical({ color: 0x17181c, metalness: 0, roughness: 0.78, roughnessMap: t.grainFine, specularIntensity: 0.45 });
    // Fiberglass core: lighter than the mask, so a board's edge separates from what it stands on, and not glossy.
    case 'pcbCore': return physical({ color: 0x625b48, metalness: 0, roughness: 0.62, roughnessMap: t.grainFine, specularIntensity: 0.5 });
    case 'chip': return physical({ color: 0x1e1f23, metalness: 0, roughness: 0.55, roughnessMap: t.grainFine });
    case 'chipWhite': return physical({ color: 0xcfd0d4, metalness: 0, roughness: 0.5 });
    // Ceramic chip capacitors a millimeter long: a duller tan, as a brighter one read as a lone sparkle a pixel wide.
    case 'ceramic': return physical({ color: 0x5f5444, metalness: 0, roughness: 0.78 });
    case 'ferrite': return physical({ color: 0x24252a, metalness: 0.2, roughness: 0.55, roughnessMap: t.grain });
    case 'glassTint': return new THREE.MeshPhysicalMaterial({ color: 0x0b0c12, metalness: 0, roughness: 1, transparent: true, opacity: 0.16, depthWrite: false, specularIntensity: 0 });
    case 'glassSpec': return clampGlass(physical({ color: 0x000000, metalness: 0, roughness: 0.03, ior: 1.52, specularIntensity: 1, envMapIntensity: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    case 'glassEdge': return physical({ color: 0x5f9a8c, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x0b1714 });
    // Ceramic black paint fired on the glass's inner face: matte itself, its gloss comes from the glass in front of it.
    case 'frit': return physical({ color: 0x050506, metalness: 0, roughness: 0.72, specularIntensity: 0.3 });
    case 'bladeSmoke': return physical({ color: 0x141519, metalness: 0, roughness: 0.4, roughnessMap: t.grainFine, specularIntensity: 0.45, transparent: true, opacity: 0.78, clearcoat: 0.1, clearcoatRoughness: 0.35, side: THREE.DoubleSide, emissive: 0x000000 });
    case 'bladeFrost': return physical({ color: 0xe9ebf0, metalness: 0, roughness: 0.55, transparent: true, opacity: 0.92, side: THREE.DoubleSide, emissive: 0x000000 });
    case 'bladeBlack': return physical({ color: 0x1f2024, metalness: 0, roughness: 0.42, side: THREE.DoubleSide, roughnessMap: t.grainFine });
    case 'bladeWhite': return physical({ color: 0xe2e3e7, metalness: 0, roughness: 0.5, side: THREE.DoubleSide });
    // Fins are thin and seen edge on, where a fine grain roughness map aliases into sparkles: they vary slowly instead.
    case 'finDark': return metal(0x33353b, 0.4, t.mottle);
    case 'finGrey': return metal(0x777a82, 0.62, t.mottle);
    case 'finSilver': return metal(0xb8bbc1, 0.32, t.mottle);
    case 'finNickel': return metal(0xc9cbcf, 0.24, t.mottle);
    case 'radCore': return physical({ color: 0x1f2024, metalness: 0.5, roughness: 0.55, roughnessMap: t.grain });
    case 'radCoreWhite': return physical({ color: 0xdcdde1, metalness: 0.2, roughness: 0.5, roughnessMap: t.grain });
    case 'meshBlack': return perforatedSheet(physical({ color: 0x26272c, metalness: 0, roughness: 0.6, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, bumpMap: t.peel, bumpScale: 0.05 }));
    case 'meshWhite': return perforatedSheet(physical({ color: 0xe1e2e6, metalness: 0, roughness: 0.45, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }));
    case 'meshGunmetal': return perforatedSheet(physical({ color: 0x45484f, metalness: 0.5, roughness: 0.42, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }));
    case 'meshRaw': return perforatedSheet(physical({ color: 0xb6b9be, metalness: 1, roughness: 0.48, alphaMap: t.perf, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide }));
    case 'labelPaper': return physical({ color: 0xc4c5c8, metalness: 0, roughness: 0.7, specularIntensity: 0.25 });
    case 'sticker': return worldBump(physical({ color: 0x1a1b1f, metalness: 0, roughness: 0.5, roughnessMap: t.grain, bumpMap: t.stipple, bumpScale: 6e-6, clearcoat: 0.25, clearcoatRoughness: 0.34 }));
    // Molded hub plastic with the fine texture an injection mold leaves.
    // Injection molded with a fine mold texture, held to scale up close.
    case 'plasticMolded': return worldBump(plastic(0x232428, 0.62, { roughnessMap: t.bead, bumpMap: t.stipple, bumpScale: 1.2e-5 }));
    case 'thermalPad': return physical({ color: 0x5f6670, metalness: 0, roughness: 0.8 });
    case 'diffuserOff': return physical({ color: 0x2a2b31, metalness: 0, roughness: 0.4, transmission: 0, clearcoat: 0.2 });
    case 'darkVoid': return new THREE.MeshBasicMaterial({ color: 0x050507 });
    case 'desk': return physical({ color: 0x17161f, metalness: 0, roughness: 1, specularIntensity: 0, map: t.mottle, transparent: true, opacity: 0.86 });
    case 'wall': return physical({ color: 0x1b1a26, metalness: 0, roughness: 1, specularIntensity: 0, map: t.soft });
  }
}

let glassEnv: THREE.Texture | null = null;

/** A studio card the room glass reflects: a soft edged rectangle at a real distance, in world meters. */
export type GlassCard = { pos: [number, number, number]; look: [number, number, number]; w: number; h: number; tilt?: number; k: number; edge?: number; grad?: number };
const MAX_CARDS = 10;
// Close to the glass the camera and the photographer block the studio cards, as in a real close up, so card
// reflections fade out between these distances in meters.
const GLASS_NEAR = [0.6, 1.1] as const;
const vecs = () => Array.from({ length: MAX_CARDS }, () => new THREE.Vector3());
const glassUniforms = {
  glassEnvWeight: { value: 1 },
  glassCardWeight: { value: 0 },
  glassClamp: { value: 0.3 },
  glassCardTint: { value: new THREE.Color(0xe8ecff) },
  glassCardP: { value: vecs() },
  glassCardN: { value: vecs() },
  glassCardU: { value: vecs() },
  glassCardV: { value: vecs() },
  glassCardS: { value: Array.from({ length: MAX_CARDS }, () => new THREE.Vector4(1, 1, 1, 0)) },
  glassCardK: { value: new Array<number>(MAX_CARDS).fill(0) },
};

export function setGlassCards(cards: GlassCard[]) {
  const up = new THREE.Vector3();
  glassUniforms.glassCardK.value.fill(0);
  cards.slice(0, MAX_CARDS).forEach((c, i) => {
    const p = new THREE.Vector3(...c.pos);
    const n = new THREE.Vector3(...c.look).sub(p).normalize();
    up.set(0, 1, 0); if (Math.abs(n.y) > 0.99) up.set(0, 0, -1);
    const u = up.clone().cross(n).normalize(); const v = n.clone().cross(u);
    const t = c.tilt ?? 0; const ct = Math.cos(t); const st = Math.sin(t);
    glassUniforms.glassCardP.value[i]!.copy(p);
    glassUniforms.glassCardN.value[i]!.copy(n);
    glassUniforms.glassCardU.value[i]!.copy(u).multiplyScalar(ct).addScaledVector(v, st);
    glassUniforms.glassCardV.value[i]!.copy(v).multiplyScalar(ct).addScaledVector(u, -st);
    glassUniforms.glassCardS.value[i]!.set(c.w / 2, c.h / 2, c.edge ?? 0.3, c.grad ?? 0);
    glassUniforms.glassCardK.value[i] = c.k;
  });
}

/** The room glass reflects studio cards at their real distance; the Inspector glass reflects its environment map. */
export function setGlassStage(stage: 'room' | 'studio', clamp = 0.3) {
  glassUniforms.glassEnvWeight.value = stage === 'room' ? 0 : 1;
  glassUniforms.glassCardWeight.value = stage === 'room' ? 1 : 0;
  glassUniforms.glassClamp.value = clamp;
}

const GLASS_VERT_HEAD = 'varying vec3 vGlassWorld;\nvarying vec3 vGlassNormal;\n';
const GLASS_FRAG_HEAD = `${GLASS_VERT_HEAD}uniform float glassEnvWeight;\nuniform float glassCardWeight;\nuniform float glassClamp;\nuniform vec3 glassCardTint;\nuniform vec3 glassCardP[${MAX_CARDS}];\nuniform vec3 glassCardN[${MAX_CARDS}];\nuniform vec3 glassCardU[${MAX_CARDS}];\nuniform vec3 glassCardV[${MAX_CARDS}];\nuniform vec4 glassCardS[${MAX_CARDS}];\nuniform float glassCardK[${MAX_CARDS}];\n`;
const GLASS_FRAG_BODY = `{
  vec3 gV = normalize(vGlassWorld - cameraPosition);
  vec3 gN = normalize(vGlassNormal);
  if (dot(gN, gV) > 0.0) gN = -gN;
  vec3 gR = reflect(gV, gN);
  float gF = 0.04 + 0.96 * pow(1.0 - clamp(-dot(gN, gV), 0.0, 1.0), 5.0);
  float gL = 0.0;
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    float den = dot(gR, glassCardN[i]);
    if (glassCardK[i] <= 0.0 || den > -1e-4) continue;
    float t = dot(glassCardP[i] - vGlassWorld, glassCardN[i]) / den;
    if (t <= 0.0) continue;
    vec3 h = vGlassWorld + gR * t - glassCardP[i];
    vec4 s = glassCardS[i];
    float a = abs(dot(h, glassCardU[i])) / s.x;
    float b = dot(h, glassCardV[i]) / s.y;
    float e = smoothstep(0.0, 1.0, (1.0 - a) / s.z) * smoothstep(0.0, 1.0, (1.0 - abs(b)) / s.z);
    gL += glassCardK[i] * e * (1.0 - s.w * (1.0 - b) * 0.5);
  }
  float gNear = smoothstep(${GLASS_NEAR[0].toFixed(2)}, ${GLASS_NEAR[1].toFixed(2)}, distance(vGlassWorld, cameraPosition));
  gl_FragColor.rgb = gl_FragColor.rgb * glassEnvWeight + glassCardTint * (gF * gL * glassCardWeight * gNear);
  gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(glassClamp));
}
`;

/** The glass layer adds light; its output is capped so a bright reflection never reaches bloom. */
/** Keeps a surface's highlights below the bloom threshold, so only LEDs bloom. */
function capHighlights(m: THREE.MeshPhysicalMaterial, cap: number, key: string): THREE.MeshPhysicalMaterial {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${cap.toFixed(2)}));\n#include <dithering_fragment>`); };
  m.customProgramCacheKey = () => `cap-${key}`;
  return m;
}

function clampGlass(m: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, glassUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLASS_VERT_HEAD}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGlassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGlassNormal = mat3(modelMatrix) * objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLASS_FRAG_HEAD}`)
      .replace('#include <dithering_fragment>', `${GLASS_FRAG_BODY}#include <dithering_fragment>`);
  };
  m.customProgramCacheKey = () => 'glass-cards';
  return m;
}

export function setGlassEnvironment(t: THREE.Texture) {
  glassEnv = t;
  const m = cache.get('glassSpec') as THREE.MeshPhysicalMaterial | undefined;
  if (m) { m.envMap = t; m.needsUpdate = true; }
}

export function mat(name: MatName): THREE.Material {
  let m = cache.get(name);
  if (!m) {
    m = makeMat(name);
    m.name = name;
    if (name === 'glassSpec' && glassEnv) (m as THREE.MeshPhysicalMaterial).envMap = glassEnv;
    cache.set(name, m);
  }
  return m;
}

const sleeveCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** Braided sleeve in any color. weave scales the braid: 1 on single wires, larger on thick tubes. */
export function sleeve(color: string, weave = 1): THREE.MeshPhysicalMaterial {
  const key = `${color}|${weave}`;
  // Thick tubes are seen from further away: a deeper weave tone keeps the braid readable at that size.
  let m = sleeveCache.get(key);
  if (!m) {
    const t = tex();
    const scaled = (src: THREE.Texture) => { if (weave === 1) return src; const c = src.clone(); c.repeat.set(1 / (TILE_MM.braid * weave), 1 / (TILE_MM.braid * weave)); c.needsUpdate = true; return c; };
    m = physical({ color: new THREE.Color(color), map: scaled(weave > 1 ? t.braidToneHi : t.braidTone), metalness: 0, roughness: 0.66, bumpMap: scaled(t.braid), bumpScale: 1.4, sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xc8c8d0), 0.35), specularIntensity: 0.5 });
    m.name = `sleeve-${color}-${weave}`;
    sleeveCache.set(key, m);
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
  graphite: { body: 'plasticMatte', metal: 'aluBrushedDark', pcb: 'pcbBlack', plastic: 'plasticMatte', fin: 'finGraphite', blade: 'bladeBlack' },
  frost: { body: 'plasticWhite', metal: 'aluBrushed', pcb: 'pcbWhite', plastic: 'plasticWhite', fin: 'finSilver', blade: 'bladeWhite' },
};

export function disposeMaterials() {
  for (const m of cache.values()) m.dispose();
  cache.clear();
  for (const m of sleeveCache.values()) m.dispose();
  sleeveCache.clear();
}
