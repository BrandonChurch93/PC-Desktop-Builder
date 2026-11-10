import { useEffect, useMemo, useRef, useState } from 'react';
import { LABELS, getCase, type MountGroup } from '../data/catalog';
import { socketsFor, type Socket } from '../engine/queries';
import { store } from '../state/store';
import { cancelPlacing, placeAt } from './activate';
import { useApp } from './hooks';
import { partName } from '../state/actions';
import { socketPoint } from './socketPoints';
import { getWorld } from './worldRef';
import s from './SocketLabels.module.css';

function socketName(caseId: string | undefined, sock: Socket): string {
  if (sock.opts.mount) {
    const c = getCase(caseId);
    const fm = c?.fanMounts.find((m) => m.id === sock.opts.mount);
    if (fm) return `${LABELS.mountGroup[fm.group as MountGroup]} ${sock.opts.mount.split('-')[1] ?? ''}`.trim();
    const rm = c?.radMounts.find((m) => m.id === sock.opts.mount);
    if (rm) return `${LABELS.mountGroup[rm.group]} radiator`;
  }
  if (sock.category === 'ram') return 'Next memory slots';
  if (sock.category === 'storage') return LABELS.storageType[sock.id as keyof typeof LABELS.storageType] ?? 'Drive';
  return LABELS.category[sock.category];
}

/**
 * The places a held part can go, as labels positioned from the scene. A tap or click installs at a valid place; a blocked
 * place shows its reason. With the keyboard, arrow keys move between places, Enter installs and Escape cancels.
 */
export function SocketLabels() {
  const held = useApp((st) => st.held);
  const build = useApp((st) => st.build);
  const sockets = useMemo(() => (held ? socketsFor(build, held.category, held.id) : []), [held, build]);
  const points = useMemo(() => sockets.map((x) => socketPoint(build, x)), [sockets, build]);
  const [pos, setPos] = useState<{ x: number; y: number; front: boolean }[]>([]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!held) return;
    let raf = 0;
    const tick = () => {
      const w = getWorld();
      if (w) {
        const next = points.map((p) => w.project(p));
        setPos((prev) => (prev.length === next.length && prev.every((q, i) => Math.abs(q.x - next[i]!.x) < 0.5 && Math.abs(q.y - next[i]!.y) < 0.5 && q.front === next[i]!.front) ? prev : next));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [held, points]);

  useEffect(() => {
    if (!held || held.socket === null) return;
    refs.current[held.socket]?.focus();
  }, [held]);

  useEffect(() => {
    if (!held) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelPlacing(); return; }
      if (held.how !== 'keys') return;
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (d) { e.preventDefault(); const n = ((held.socket ?? 0) + d + sockets.length) % sockets.length; store.setState({ held: { ...held, socket: n } }); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [held, sockets.length]);

  if (!held) return null;
  return (
    <div className={s.layer} role="group" aria-label={`Places for ${partName(held.category, held.id)}`}>
      <div className={s.banner} role="status">
        <span>{held.how === 'keys' ? 'Arrow keys pick a place. Enter installs. Escape cancels.' : 'Tap a place to install.'}</span>
        <button type="button" className={s.cancel} onClick={cancelPlacing}>Cancel</button>
      </div>
      {sockets.map((sock, i) => {
        const p = pos[i];
        if (!p || !p.front) return null;
        const active = held.socket === i;
        return (
          <button key={sock.key} ref={(el) => { refs.current[i] = el; }} type="button" data-socket={sock.key}
            className={[s.socket, sock.ok ? s.ok : s.blocked, active ? s.active : ''].join(' ')} style={{ left: p.x, top: p.y }}
            aria-label={sock.ok ? `${socketName(build.case?.id, sock)}${sock.replaces ? ', replaces the part there' : ''}` : `${socketName(build.case?.id, sock)}: ${sock.message ?? ''}`}
            tabIndex={held.how === 'keys' ? (active ? 0 : -1) : 0}
            onClick={() => placeAt(i)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); placeAt(i); } }}>
            <span className={s.ring} aria-hidden="true" />
            <span className={s.text}>{socketName(build.case?.id, sock)}</span>
            {!sock.ok && active && <span className={s.reason}>{sock.message}</span>}
          </button>
        );
      })}
    </div>
  );
}
