import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { installHook } from './hook';
import { flushAutosave } from './state/actions';
import { boot } from './state/boot';
import { store } from './state/store';
import { Dialogs } from './ui/Dialogs';
import { DemoMenu } from './ui/DemoMenu';
import { useApp } from './ui/hooks';
import { Notice } from './ui/Notice';
import { EmptyHint, InspectorBar, Intro, LiveRegion, SharedBanner, StartOverlay } from './ui/Overlays';
import { Shell } from './ui/Shell';
import { installShortcuts } from './ui/shortcuts';
import { SocketLabels } from './ui/SocketLabels';
import { ExplodedLabels } from './ui/ExplodedLabels';
import { ReasonLabel, ResetView, SelectionMenu, SwapHint } from './ui/Hands';
import { Tips } from './ui/Tips';
import { hasWebGL2, NoWebGL } from './ui/NoWebGL';
import { hidePreloaderNow, runPreloader, stopPreloader, TuningScrim } from './ui/Preloader';
import { getWorld, setWorld } from './ui/worldRef';
import { World } from './world/World';
import styles from './App.module.css';

let world: World | null = null;

function UiLayer() {
  const hidden = useApp((s) => s.uiHidden);
  // With the interface hidden nothing covers the scene: the camera frames the whole window.
  useLayoutEffect(() => { if (hidden) getWorld()?.setInsets({ left: 0, right: 0, top: 0, bottom: 0 }); }, [hidden]);
  // Scene labels belong to the view, not the interface: the exploded labels stay when the interface is hidden.
  if (hidden) return <><ExplodedLabels /><LiveRegion /></>;
  return (
    <>
      <Shell />
      <EmptyHint />
      <SharedBanner />
      <ExplodedLabels />
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
      <TuningScrim />
      <LiveRegion />
    </>
  );
}

export function App() {
  const stage = useRef<HTMLCanvasElement | null>(null);
  const [gl] = useState(hasWebGL2);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el || world || !gl) return;
    const params = new URLSearchParams(location.search);
    const hook = params.get('hook') === '1';
    // The warm-up runs for every visitor; under the test hook only when asked, so the named shots keep their meaning.
    const warm = !hook || params.get('warm') === '1';
    boot(hook);
    // A lost context keeps the build: it is saved now, and the page reloads by itself if the browser gives the context back.
    el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); flushAutosave(); stopPreloader(); setLost(true); });
    el.addEventListener('webglcontextrestored', () => { flushAutosave(); location.reload(); });
    world = new World(el, store);
    setWorld(world);
    const api = hook ? installHook(world) : null;
    world.autoTier = !hook;
    world.prepareAhead = warm;
    const q = store.getState().quality;
    void world.initCore(q === 'auto' ? 'high' : q).then(() => { if (api) api.ready = true; });
    if (warm) {
      const s = store.getState();
      const next = s.ui.overlay;
      // A returning visitor's build is restored behind the preloader: its name shows in the status.
      const restored = next === null && s.ui.shared === null && s.build.case ? s.build.name || 'Untitled build' : null;
      store.setState({ ui: { ...s.ui, overlay: 'preload' } });
      const w = world;
      w.onRetier = () => {
        store.setState({ tuning: true });
        void w.warm(() => {}, new AbortController().signal).catch((e: unknown) => console.error(e)).finally(() => store.setState({ tuning: false }));
      };
      void runPreloader(w, next, restored);
    } else hidePreloaderNow();
    const off = installShortcuts();
    window.addEventListener('pagehide', flushAutosave);
    return () => { off(); window.removeEventListener('pagehide', flushAutosave); };
  }, [gl]);
  useEffect(() => { if (!gl) hidePreloaderNow(); }, [gl]);
  if (!gl) return <main className={styles.stage}><NoWebGL /></main>;
  return (
    <main className={styles.stage}>
      <canvas ref={stage} className={styles.canvas} aria-label="A 3D view of the PC build on a desk. The full spec sheet lists every part." />
      {lost ? <NoWebGL lost /> : <><UiLayer /><DemoMenu /></>}
    </main>
  );
}
