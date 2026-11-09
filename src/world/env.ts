import * as THREE from 'three';

/** A soft edged softbox texture: bright in the middle, falling off toward its border. */
function softbox(): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = Math.abs((x + 0.5) / S - 0.5) * 2; const v = Math.abs((y + 0.5) / S - 0.5) * 2;
    const e = Math.max(0, 1 - Math.pow(Math.max(u, v), 4));
    const k = Math.round(255 * Math.min(1, e * (1.05 - 0.2 * v)));
    const i = (y * S + x) * 4;
    img.data[i] = k; img.data[i + 1] = k; img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** A strip light with a crisp border, so a mirror smooth surface shows its outline. */
function stripbox(): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const edge = (t: number) => { const x = Math.min(1, Math.max(0, (1 - t) / 0.14)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = Math.abs((x + 0.5) / S - 0.5) * 2; const v = Math.abs((y + 0.5) / S - 0.5) * 2;
    const k = Math.round(255 * edge(u) * edge(v) * (1 - 0.25 * v));
    const i = (y * S + x) * 4;
    img.data[i] = k; img.data[i + 1] = k; img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * What the glass panels reflect: a few soft strips, and large dim softboxes placed where the side, front, top and rear
 * views look in the glass. Glass reflects about 4 percent straight on, so a softbox reads there as a faint sheen.
 * Wide bright panels laid a milky veil over the close views, and bright thin lines read as scratches; this sits between.
 */
export function glassEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010102);
  const strip = stripbox();
  const soft = softbox();
  const panel = (w: number, h: number, k: number, pos: [number, number, number], look: [number, number, number], tilt = 0, map = strip) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8ecff).multiplyScalar(k), map, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    m.rotateZ(tilt);
    scene.add(m);
  };
  panel(0.05, 4.2, 0.9, [-1.9, 0.4, 3.6], [0, 0.3, 0], 0.32);
  panel(0.025, 3.6, 0.7, [-2.7, 0.6, 2.9], [0, 0.3, 0], 0.32);
  panel(4.6, 0.06, 0.6, [0.4, 3.0, 3.4], [0, 0.4, 0]);
  panel(0.1, 3.0, 1.0, [2.6, 0.8, 3.2], [0, 0.3, 0], -0.2);
  panel(2.4, 1.8, 2.2, [0.25, 0.8, 4.4], [0, 0.3, 0], 0, soft);
  panel(1.6, 2.6, 1.2, [-3.0, 0.6, 1.0], [0, 0.3, 0], 0, soft);
  panel(2.4, 2.4, 1.0, [0.3, 3.6, 2.4], [0, 0.3, 0], 0, soft);
  panel(1.4, 2.2, 1.6, [2.9, 0.8, 2.0], [0, 0.3, 0], 0, soft);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0, 0.1, 100, { size: 1024 });
  pmrem.dispose();
  scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  strip.dispose(); soft.dispose();
  return rt.texture;
}

/** A dark studio with a few large softboxes and a dim horizon band, baked into an environment map for reflections. */
export function studioEnvironment(renderer: THREE.WebGLRenderer, variant: 'room' | 'inspector' = 'room'): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(variant === 'room' ? 0x05050a : 0x0a0a0e);
  const soft = softbox();
  const panel = (w: number, h: number, color: number, k: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), map: soft, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    scene.add(m);
  };
  const band = (k: number, color: number) => {
    const g = new THREE.CylinderGeometry(6, 6, 2.6, 48, 1, true);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const t = 1 - Math.abs(pos.getY(i)) / 1.3; col[i * 3] = t; col[i * 3 + 1] = t; col[i * 3 + 2] = t; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), vertexColors: true, side: THREE.BackSide }));
    m.position.y = 1.1;
    scene.add(m);
  };
  if (variant === 'room') {
    band(0.75, 0xaaa6cc);
    panel(6.0, 6.0, 0xb8b6cc, 0.45, [0, 4.4, 0], [0, 0, 0]);
    panel(2.8, 1.8, 0xfff0e2, 8, [2.2, 3.2, 3.2], [0, 0.3, 0]);
    panel(3.6, 0.8, 0xdfe6ff, 0.9, [-0.6, 4.2, 0.4], [0, 0, 0]);
    panel(0.7, 3.2, 0xc8d0ff, 3.5, [-3.4, 1.4, 1.8], [0, 0.4, 0]);
    panel(4.4, 0.4, 0xfff4ea, 5, [0.6, 1.8, 3.8], [0, 0.4, 0]);
    panel(1.4, 1.4, 0x7d6bff, 1.4, [0.4, 1.2, -3.6], [0, 0.4, 0]);
    panel(0.5, 2.2, 0xfff2e6, 2.0, [3.2, 0.1, 2.0], [0, 0.3, 0]);
    panel(5.0, 1.2, 0x8f8cb8, 0.55, [0, -1.4, 3.8], [0, 0.3, 0]);
  } else {
    band(0.95, 0xe4e6ee);
    panel(5.0, 4.0, 0xf4f4f8, 0.75, [0, 4.6, 0.4], [0, 0, 0]);
    panel(3.2, 2.4, 0xfffaf4, 4, [2.6, 2.4, 3.0], [0, 0, 0]);
    panel(2.6, 1.4, 0xeef2ff, 3.6, [-3.0, 2.2, 1.0], [0, 0, 0]);
    panel(0.9, 3.6, 0xf2f4ff, 4.5, [-2.4, 1.4, -3.0], [0, 0, 0]);
    panel(5.4, 0.5, 0xffffff, 1.5, [0, 0.3, 4.2], [0, 0.4, 0]);
    panel(6.0, 1.2, 0xeef0f6, 1.3, [0, 1.9, 4.6], [0, 0.8, 0]);
    panel(6.0, 1.2, 0xeef0f6, 1.3, [0, 0.9, 4.6], [0, 0.8, 0]);
    panel(7.0, 1.1, 0xe9ebf2, 1.5, [0, 2.6, -4.2], [0, 0.8, 0]);
    panel(7.0, 1.1, 0xe9ebf2, 0.85, [0, 1.7, -4.2], [0, 0.8, 0]);
    panel(7.0, 1.1, 0xe9ebf2, 0.35, [0, 0.8, -4.2], [0, 0.8, 0]);
    panel(6.5, 1.6, 0xeef0f6, 1.6, [0, -1.0, 4.4], [0, 0.4, 0]);
    panel(4.0, 1.4, 0xeef0f6, 1.0, [3.4, -1.4, 2.6], [0, 0.4, 0]);
    panel(4.0, 1.4, 0xeef0f6, 0.8, [-3.4, -1.4, 2.6], [0, 0.4, 0]);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  scene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  soft.dispose();
  return rt.texture;
}
