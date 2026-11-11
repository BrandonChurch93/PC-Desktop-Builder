import { useState, type KeyboardEvent } from 'react';
import { K } from '../data/catalog';
import { decode, encode, shareUrl } from '../engine/codec';
import { emptyBench, loadBuild, say, updateSettings } from '../state/actions';
import { newId, resetAll, saveSaved, type SavedBuild } from '../state/persist';
import { DEFAULT_UI, store } from '../state/store';
import { closeDialog } from './uiActions';
import { useApp } from './hooks';
import { Button, Chip } from './kit/Button';
import { Segmented } from './kit/Controls';
import { Dialog } from './kit/Dialog';
import { SheetDialog } from './SheetDialog';
import { downloadCanvas, makePoster, POSTER_SIZE, posterFileName, posterSize, type PosterFormat } from './poster';
import { getWorld } from './worldRef';
import s from './Dialogs.module.css';

export const ABOUT_COPY = `${K.productName} is a portfolio project by Brandon Church. Every brand and part here is invented. It runs entirely in your browser. No accounts, no tracking, no AI.`;

function SettingsDialog() {
  const settings = useApp((st) => st.settings);
  const [confirm, setConfirm] = useState(false);
  return (
    <Dialog title="Settings" onClose={closeDialog}>
      <div className={s.stack}>
        <div className={s.field}>
          <span className={s.label} id="quality-label">Quality</span>
          <Segmented label="Quality" block value={settings.quality} onChange={(q) => updateSettings({ quality: q })}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
        </div>
        <div className={s.fieldRow}>
          <span className={s.label}>Reduce motion</span>
          <Chip on={settings.reducedMotion === 'on'} onChange={(on) => updateSettings({ reducedMotion: on ? 'on' : 'system' })}>{settings.reducedMotion === 'on' ? 'On' : 'Follows the system'}</Chip>
        </div>
        <div className={s.field}>
          {confirm ? (
            <div className={s.confirm}>
              <p className={s.text}>This removes your current build, saved builds, lighting profiles and settings from this browser.</p>
              <div className={s.buttons}>
                <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => { resetAll(); store.setState({ saved: [], profiles: [], settings: { quality: 'auto', reducedMotion: 'system', introSeen: false }, quality: 'auto', ui: DEFAULT_UI }); emptyBench(); say('Saved data reset.'); }}>Reset saved data</Button>
              </div>
            </div>
          ) : <Button variant="ghost" onClick={() => setConfirm(true)}>Reset saved data</Button>}
        </div>
      </div>
    </Dialog>
  );
}

function AboutDialog() {
  return (
    <Dialog title="About" onClose={closeDialog}>
      <p className={s.text}>{ABOUT_COPY}</p>
    </Dialog>
  );
}

function ShareDialog() {
  const build = useApp((st) => st.build);
  const [copied, setCopied] = useState(false);
  const url = shareUrl(location.origin, location.pathname, encode(build));
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); say('Link copied.'); }
    catch { say('Copying is not available here. Select the link and copy it.'); }
  };
  return (
    <Dialog title="Share this build" onClose={closeDialog}>
      <div className={s.stack}>
        <p className={s.text}>Anyone with this link gets this exact build.</p>
        <input className={s.link} readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
        <div className={s.buttons}>
          <span className={s.status} role="status">{copied ? 'Link copied.' : ''}</span>
          <Button variant="primary" icon={copied ? 'check' : 'copy'} data-autofocus onClick={copy}>Copy link</Button>
        </div>
      </div>
    </Dialog>
  );
}

function SavedDialog() {
  const saved = useApp((st) => st.saved);
  const build = useApp((st) => st.build);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [full, setFull] = useState(false);
  const put = (list: SavedBuild[]) => { store.setState({ saved: list }); saveSaved(list); };
  const entry = (): SavedBuild => ({ id: newId(), name: build.name || 'Untitled build', code: encode(build), savedAt: Date.now() });
  const save = () => {
    if (saved.length >= K.maxSavedBuilds) { setFull(true); return; }
    put([entry(), ...saved]); say(`${build.name || 'Untitled build'} saved.`);
  };
  const replaceOldest = () => { put([entry(), ...saved.slice(0, K.maxSavedBuilds - 1)]); setFull(false); say('Saved over the oldest build.'); };
  const load = (e: SavedBuild) => {
    const d = decode(e.code);
    if ('error' in d) { say('This saved build could not be read.'); return; }
    loadBuild({ ...d.build, name: e.name }, `${e.name} loaded.`); closeDialog();
  };
  const rename = (id: string) => {
    const name = draft.replace(/\s+/g, ' ').trim().slice(0, K.maxBuildNameLength) || 'Untitled build';
    put(saved.map((x) => (x.id === id ? { ...x, name } : x))); setRenaming(null); say(`Renamed to ${name}.`);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') { e.preventDefault(); rename(id); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(null); }
  };
  return (
    <Dialog title="Saved builds" onClose={closeDialog}>
      <div className={s.stack}>
        {full ? (
          <div className={s.confirm} role="alert">
            <p className={s.text}>You have {K.maxSavedBuilds} saved builds, the most this keeps. Replace the oldest?</p>
            <div className={s.buttons}>
              <Button variant="ghost" onClick={() => setFull(false)}>Cancel</Button>
              <Button variant="primary" onClick={replaceOldest}>Replace the oldest</Button>
            </div>
          </div>
        ) : <Button variant="primary" icon="plus" onClick={save} disabled={!build.case}>Save this build</Button>}
        {saved.length === 0 ? <p className={s.text}>No saved builds yet.</p> : (
          <ul className={s.list}>
            {saved.map((e) => (
              <li key={e.id} className={s.item}>
                {renaming === e.id
                  ? <input className={s.rename} autoFocus value={draft} maxLength={K.maxBuildNameLength} aria-label="New name" onChange={(x) => setDraft(x.target.value)} onKeyDown={(x) => onKey(x, e.id)} onBlur={() => rename(e.id)} />
                  : <div className={s.itemText}><span className={s.itemName}>{e.name}</span><span className={s.meta}>{new Date(e.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>}
                <div className={s.itemActions}>
                  <Button variant="ghost" onClick={() => load(e)}>Load</Button>
                  <Button variant="quiet" onClick={() => { setRenaming(e.id); setDraft(e.name); }}>Rename</Button>
                  <Button variant="quiet" onClick={() => { put(saved.filter((x) => x.id !== e.id)); say(`${e.name} deleted.`); }}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function PosterDialog() {
  const build = useApp((st) => st.build);
  const [format, setFormat] = useState<PosterFormat>('portrait');
  const [busy, setBusy] = useState(false);
  const world = getWorld();
  const size = world ? posterSize(world, format, world.tier) : { ...POSTER_SIZE[format], half: false };
  const go = async () => {
    if (!world || busy) return;
    setBusy(true);
    try {
      const canvas = await makePoster(world, build, format, size);
      await downloadCanvas(canvas, posterFileName(build.name));
      say('Poster exported.');
    } catch { say('The poster could not be made on this device.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog title="Export poster" onClose={closeDialog}>
      <div className={s.stack}>
        <Segmented label="Format" block value={format} onChange={setFormat} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
        <p className={s.text}>{size.w} × {size.h} pixels, PNG.{size.half ? ' This device draws the poster at half size.' : ''}</p>
        <div className={s.buttons}>
          <span className={s.status} role="status">{busy ? 'Rendering the poster.' : ''}</span>
          <Button variant="primary" data-autofocus disabled={busy || !build.case} onClick={() => { void go(); }}>Export poster</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Whichever dialog is open. */
export function Dialogs() {
  const d = useApp((st) => st.ui.dialog);
  switch (d) {
    case 'sheet': return <SheetDialog />;
    case 'settings': return <SettingsDialog />;
    case 'about': return <AboutDialog />;
    case 'share': return <ShareDialog />;
    case 'saved': return <SavedDialog />;
    case 'poster': return <PosterDialog />;
    default: return null;
  }
}
