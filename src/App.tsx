import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { ReasonLabel, ResetView, SelectionMenu, SwapHint } from './ui/Hands';
import { Tips } from './ui/Tips';
import { getWorld, setWorld } from './ui/worldRef';
import { World } from './world/World';
import styles from './App.module.css';

let world: World | null = null;

function UiLayer() {
  const hidden = useApp((s) => s.uiHidden);
  // With the interface hidden nothing covers the scene: the camera frames the whole window.
  useLayoutEffect(() => { if (hidden) getWorld()?.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); }, [hidden]);
  if (hidden) return <LiveRegion />;
  return (
    <>
      <Shell />
      <EmptyHint />
      <SharedBanner />
      <SocketLabels />
      <SelectionMenu />
      <ReasonLabel />
      <ResetView />
      <SwapHint />
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
    <main className={styles.stage}>
      <canvas ref={stage} className={styles.canvas} aria-label="A 3D view of the PC build on a desk. The full spec sheet lists every part." />
      <UiLayer />
    </main>
  );
}
