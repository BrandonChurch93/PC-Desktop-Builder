import type { ReactElement } from 'react';

/** Inline stroke icons drawn for this app: one weight, 20 px, currentColor. */
const P: Record<string, ReactElement> = {
  undo: <><path d="M7.5 6.5 4 10l3.5 3.5" /><path d="M4.5 10H12a4 4 0 0 1 0 8h-2" /></>,
  redo: <><path d="M12.5 6.5 16 10l-3.5 3.5" /><path d="M15.5 10H8a4 4 0 0 0 0 8h2" /></>,
  glass: <><rect x="4.5" y="3.5" width="11" height="13" rx="1.5" /><path d="m7.5 12 4-4.5" /><path d="m9.5 13.5 2.5-2.8" /></>,
  power: <><path d="M10 3v6.5" /><path d="M6.2 5.8a6 6 0 1 0 7.6 0" /></>,
  airflow: <><path d="M3 7.5h9.5a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 12.5h11.5a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 10h6" /></>,
  share: <><circle cx="14.5" cy="5" r="2" /><circle cx="5.5" cy="10" r="2" /><circle cx="14.5" cy="15" r="2" /><path d="m7.3 9 5.4-3" /><path d="m7.3 11 5.4 3" /></>,
  menu: <><path d="M4 6h12" /><path d="M4 10h12" /><path d="M4 14h12" /></>,
  close: <><path d="m5.5 5.5 9 9" /><path d="m14.5 5.5-9 9" /></>,
  lighting: <><circle cx="10" cy="10" r="3" /><path d="M10 2.5v2" /><path d="M10 15.5v2" /><path d="M2.5 10h2" /><path d="M15.5 10h2" /><path d="m4.7 4.7 1.4 1.4" /><path d="m13.9 13.9 1.4 1.4" /><path d="m4.7 15.3 1.4-1.4" /><path d="m13.9 6.1 1.4-1.4" /></>,
  spec: <><rect x="4" y="3" width="12" height="14" rx="1.5" /><path d="M7 7h6" /><path d="M7 10h6" /><path d="M7 13h4" /></>,
  minus: <path d="M5 10h10" />,
  plus: <><path d="M5 10h10" /><path d="M10 5v10" /></>,
  check: <path d="m5 10.5 3 3 7-7" />,
  edit: <><path d="m12.5 4.5 3 3-8 8H4.5v-3z" /><path d="m11 6 3 3" /></>,
  chevronUp: <path d="m6 12 4-4 4 4" />,
  chevronDown: <path d="m6 8 4 4 4-4" />,
  inspect: <><circle cx="9" cy="9" r="4.5" /><path d="m12.5 12.5 4 4" /></>,
  fill: <><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1" /></>,
  clear: <><path d="M5 6h10" /><path d="M8 6V4.5h4V6" /><path d="M6.5 6 7 16h6l.5-10" /></>,
  copy: <><rect x="7" y="7" width="9" height="9" rx="1.5" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" /></>,
  arrowLeft: <><path d="M15.5 10h-11" /><path d="m8.5 6-4 4 4 4" /></>,
  arrowRight: <><path d="M4.5 10h11" /><path d="m11.5 6 4 4-4 4" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
