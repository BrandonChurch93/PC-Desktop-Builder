import type { ShowcaseSpec } from '../data/showcase';
import { loadShowcase, partName } from '../state/actions';
import s from './PartCard.module.css';

const BASE = import.meta.env.BASE_URL;

/** A showcase build in the tray: its picture lit, the case it lives in, its name and one line. The whole card loads it. */
export function BuildCard({ spec, on }: { spec: ShowcaseSpec; on: boolean }) {
  const status = `status-build-${spec.id}`;
  return (
    <article className={[s.card, on ? s.cardOn : ''].join(' ')} data-build={spec.id}>
      <span className={[s.thumb, s.thumbStill].join(' ')} aria-hidden="true">
        <img src={`${BASE}thumbs/build-${spec.id}.jpg`} alt="" width={120} height={120} draggable={false} loading="lazy" decoding="async" />
      </span>
      <button type="button" className={s.main} onClick={() => loadShowcase(spec.id)} aria-describedby={status} aria-pressed={on}>
        <span className={s.brand}>{spec.build.case ? partName('case', spec.build.case.id) : ''}</span>
        <span className={s.name}>{spec.name}</span>
        <span className={s.numbers}>{spec.tagline}</span>
      </button>
      <div className={s.foot}>
        <span id={status} className={[s.status, on ? s.installed : s.fits].join(' ')}>{on ? 'On the bench' : 'Tap to load'}</span>
      </div>
    </article>
  );
}
