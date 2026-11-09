import { useEffect, useRef } from 'react';
import { getPreset } from './data/catalog';
import { buildFromPreset, revalidate } from './engine/rules';
import { installHook } from './hook';
import { store } from './state/store';
import { World } from './world/World';
import styles from './App.module.css';

let world: World | null = null;

export function App() {
  const stage = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el || world) return;
    const hook = new URLSearchParams(location.search).get('hook') === '1';
    const p = getPreset('night-rig');
    if (p) store.setState({ build: revalidate(buildFromPreset(p)).build });
    world = new World(el, store);
    const api = hook ? installHook(world) : null;
    void world.init('high').then(() => { if (api) api.ready = true; });
  }, []);
  return (
    <div className={styles.stage}>
      <canvas ref={stage} className={styles.canvas} aria-label="A 3D view of the PC build on a desk" />
    </div>
  );
}
