import { sheet } from '../engine/sheet';
import { redo, removePart, setGlass, setPower, undo } from '../state/actions';
import { store, type Mode } from '../state/store';
import { cancelPlacing } from './activate';
import { setUi } from './uiActions';
import { getWorld } from './worldRef';

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
const setMode = (mode: Mode) => store.setState({ mode, selected: null, held: null });

/**
 * Shortcuts, active only when focus is not in a text field: undo and redo, G glass, P power, A airflow, B, S and E for the
 * modes, I for the Inspector on the selected part, Delete removes the selected part, Escape closes or deselects.
 */
export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || typing(e.target)) return;
    const s = store.getState();
    if (s.ui.overlay) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod || e.altKey) return;
    if (s.ui.dialog) return;
    switch (e.key) {
      case 'Escape':
        if (s.held) { if (getWorld()?.hands.dragging) getWorld()?.hands.cancelDrag(); else cancelPlacing(); return; }
        if (s.ui.swap) { setUi({ swap: null }); return; }
        if (s.focus) { getWorld()?.resetView(); return; }
        if (s.ui.menu) { setUi({ menu: false }); return; }
        if (s.inspect) { store.setState({ inspect: null }); return; }
        if (s.ui.side) { setUi({ side: null }); return; }
        if (s.selected) { store.setState({ selected: null }); return; }
        return;
      case 'Delete': case 'Backspace':
        if (s.selected) { e.preventDefault(); removePart(s.selected.category, s.selected.opts as never); store.setState({ selected: null }); }
        return;
    }
    switch (e.key.toLowerCase()) {
      case 'g': if (s.build.case) setGlass(!s.build.glass); break;
      case 'p': if (s.power) setPower(false); else if (sheet(s.build).canPowerOn) setPower(true); break;
      case 'a': if (s.build.case) store.setState({ airflow: !s.airflow }); break;
      case 'b': setMode('build'); break;
      case 's': setMode('showcase'); break;
      case 'e': setMode('exploded'); break;
      case 'i': {
        const sel = s.selected;
        if (s.inspect) store.setState({ inspect: null });
        else if (sel) {
          const b = s.build;
          const id = sel.category === 'case' ? b.case?.id : sel.category === 'cooler' ? b.cooler?.id : sel.category === 'ram' ? b.ram[sel.opts.index ?? 0] : sel.category === 'fan' ? b.fans[sel.opts.mount ?? ''] : sel.category === 'storage' ? sel.opts.type : (b as unknown as Record<string, string | null>)[sel.category];
          if (id) store.setState({ inspect: { category: sel.category, id, angle: 0, zoom: 0 } });
        }
        break;
      }
      default: return;
    }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
