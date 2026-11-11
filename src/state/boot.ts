import { getPreset } from '../data/catalog';
import { codeFromHash, decode } from '../engine/codec';
import { DROPPED_PARTS, linkMessage } from '../engine/messages';
import { buildFromPreset, revalidate } from '../engine/rules';
import { sheet } from '../engine/sheet';
import type { Build } from '../engine/types';
import { notify, systemReducedMotion } from './actions';
import { KEYS, loadProfiles, loadSaved, loadSettings, read } from './persist';
import { DEFAULT_UI, store } from './store';

const house = (): Build => revalidate(buildFromPreset(getPreset('night-rig')!)).build;

/**
 * Arriving on a shared link: the build in Showcase with its banner, powered when it can be, and a notice when parts were left
 * out. A bad or newer link keeps the house build and offers the empty bench.
 */
export function landOnLink(code: string) {
  const d = decode(code);
  if ('error' in d) {
    store.setState({ build: house(), instant: true, mode: 'build', ui: DEFAULT_UI });
    notify({ kind: 'link', title: linkMessage(d.error), lines: [], action: 'empty' });
    return;
  }
  const b = d.build;
  store.setState({ build: b, instant: true, mode: 'showcase', power: sheet(b).canPowerOn, ui: { ...DEFAULT_UI, shared: b.name || 'Untitled build' } });
  if (d.removed.some((r) => r.code === 'UNKNOWN_PART')) notify({ kind: 'info', title: DROPPED_PARTS, lines: [], action: null });
}

/**
 * Where the app starts. A shared link lands in Showcase with its banner; a returning visitor gets their last build back with
 * no intro; a first visit sees the intro over the house build, then the start overlay. The test hook starts on the house
 * build with no intro or overlay, and drives everything else itself.
 */
export function boot(hook: boolean) {
  const settings = loadSettings();
  const reducedMotion = settings.reducedMotion === 'on' || systemReducedMotion();
  store.setState({ settings, quality: settings.quality, reducedMotion, saved: loadSaved(), profiles: loadProfiles(), ui: DEFAULT_UI });
  if (hook) {
    // A fresh context has nothing saved, so harness frames always start on the house build; a reload in a test restores.
    const saved = read(KEYS.current);
    const d = saved ? decode(saved) : null;
    store.setState({ build: d && !('error' in d) ? d.build : house(), instant: true });
    return;
  }

  const code = codeFromHash(location.hash);
  if (code) {
    history.replaceState(null, '', location.pathname + location.search);
    landOnLink(code);
    return;
  }

  const saved = read(KEYS.current);
  if (saved) {
    const d = decode(saved);
    if (!('error' in d)) { store.setState({ build: d.build, instant: true }); return; }
  }
  store.setState({ build: house(), instant: true, ui: { ...DEFAULT_UI, overlay: settings.introSeen ? 'start' : 'intro' } });
}
