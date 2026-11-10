import { useEffect, useRef } from 'react';
import { installHook } from './hook';
import { flushAutosave } from './state/actions';
import { boot } from './state/boot';
import { store } from './state/store';
import { Dialogs } from './ui/Dialogs';
import { useApp } from './ui/hooks';
import { Notice } from './ui/Notice';
import { EmptyHint, InspectorBar, Intro, LiveRegion, SharedBanner, StartOverlay } from './ui/Overlays';
import { Shell } from './ui/Shell';
import { installShortcuts } from './ui/shortcuts';
import { SocketLabels } from './ui/SocketLabels';
import { Tips } from './ui/Tips';
import { setWorld } from './ui/worldRef';
import { World } from './world/World';
import styles from './App.module.css';

let world: World | null = null;

function UiLayer() {
  const hidden = useApp((s) => s.uiHidden);
  if (hidden) return <LiveRegion />;
  return (
    <>
      <Shell />
      <EmptyHint />
      <SharedBanner />
      <SocketLabels />
      <InspectorBar />
      <Notice />
      <Intro />
      <StartOverlay />
      <Dialogs />
      <Tips />
      <LiveRegion />
    </>
  );
}

export function App() {
  const stage = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el || world) return;
    const hook = new URLSearchParams(location.search).get('hook') === '1';
    boot(hook);
    world = new World(el, store);
    setWorld(world);
    const api = hook ? installHook(world) : null;
    void world.init('high').then(() => { if (api) api.ready = true; });
    const off = installShortcuts();
    window.addEventListener('pagehide', flushAutosave);
    return () => { off(); window.removeEventListener('pagehide', flushAutosave); };
  }, []);
  return (
    <div className={styles.stage}>
      <canvas ref={stage} className={styles.canvas} aria-label="A 3D view of the PC build on a desk. The full spec sheet lists every part." />
      <UiLayer />
    </div>
  );
}
