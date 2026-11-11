import { K } from '../data/catalog';
import s from './NoWebGL.module.css';

const BASE = import.meta.env.BASE_URL;

/** True when this browser can draw the scene: it needs WebGL 2. */
export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

/** The plain fallback: what the app needs, and a still of the house build. lost: the 3D view stopped working while running. */
export function NoWebGL({ lost }: { lost?: boolean }) {
  return (
    <div className={s.wrap} role="alert">
      <img className={s.still} src={`${BASE}still/night-rig.jpg`} alt="The Night Rig: a glass tower lit in pink, violet and cyan, liquid cooled." width={1440} height={900} />
      <div className={s.card}>
        <h1 className={s.title}>{K.productName}</h1>
        {lost
          ? <p className={s.text}>The 3D view stopped working. Your build is saved. Reload to pick up where you left off.</p>
          : <p className={s.text}>This app draws its 3D scene with WebGL 2, which this browser does not offer. Try a current version of Chrome, Edge, Firefox or Safari.</p>}
        {lost && <button type="button" className={s.button} onClick={() => location.reload()}>Reload</button>}
      </div>
    </div>
  );
}
