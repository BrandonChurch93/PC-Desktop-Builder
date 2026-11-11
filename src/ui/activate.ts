import { getCooler, type Category } from '../data/catalog';
import { firstPlace, fitOf, isSinglePlace, placeCount, socketsFor, usableFanMounts } from '../engine/queries';
import { installPart, removePart, say, setCables, swapPart } from '../state/actions';
import { store } from '../state/store';
import type { ActionOpts } from '../engine/types';

/** Start placing a part: its sockets show, and a tap, a click or Enter on one installs it. */
export function startPlacing(category: Category, id: string, how: 'tap' | 'keys' | 'drag') {
  const b = store.getState().build;
  const sockets = socketsFor(b, category, id);
  const first = Math.max(0, sockets.findIndex((s) => s.ok));
  store.setState({ held: { category, id, how, socket: how === 'keys' ? first : null }, selected: null });
  say(`Placing. ${sockets.filter((s) => s.ok).length} of ${sockets.length} places are free. ${how === 'keys' ? 'Arrow keys move between them, Enter installs, Escape cancels.' : 'Tap a place to install.'}`);
}

export const cancelPlacing = () => { if (store.getState().held) { store.setState({ held: null }); say('Placing cancelled.'); } };

/** Install the held part at one of its sockets. A blocked socket says why and keeps the part held. */
export function placeAt(index: number) {
  const s = store.getState();
  const h = s.held;
  if (!h) return;
  const sock = socketsFor(s.build, h.category, h.id)[index];
  if (!sock) return;
  if (!sock.ok) { say(sock.message ?? ''); return; }
  store.setState({ held: null });
  installPart(h.category, h.id, sock.opts);
}

/**
 * A card was activated by a tap, a click or Enter. Installed single place parts come out; a blocked part says why; a part
 * with one possible place goes in there; a fan or a liquid cooler with several places shows its sockets on a tap, and Enter
 * puts it in the first free place.
 */
export function activateCard(category: Category, id: string, how: 'tap' | 'enter') {
  const b = store.getState().build;
  const swap = store.getState().ui.swap;
  if (swap && swap.category === category) {
    const r = swapPart(category, swap.opts as ActionOpts, id);
    store.setState({ ui: { ...store.getState().ui, swap: null } });
    if (!r.ok) say(fitOf(b, category, id).message ?? '');
    return;
  }
  if (category === 'cables') { setCables(id); return; }
  const fit = fitOf(b, category, id);
  if (fit.status === 'installed' && isSinglePlace(category)) { removePart(category); return; }
  if (fit.status === 'blocked') { say(fit.message ?? ''); return; }
  if (category === 'fan') {
    if (how === 'enter') {
      const at = firstPlace(b, 'fan', id);
      if (at?.mount) installPart('fan', id, at);
      else startPlacing('fan', id, 'keys');
      return;
    }
    if (usableFanMounts(b).length === 1) { const at = firstPlace(b, 'fan', id); if (at?.mount) { installPart('fan', id, at); return; } }
    startPlacing('fan', id, 'tap');
    return;
  }
  const k = category === 'cooler' ? getCooler(id) : undefined;
  if (k?.type === 'aio' && how === 'tap' && placeCount(b, 'cooler', id) > 1) { startPlacing('cooler', id, 'tap'); return; }
  const at = firstPlace(b, category, id) ?? {};
  const r = installPart(category, id, at);
  if (!r.ok) say(fitOf(b, category, id).message ?? '');
}
