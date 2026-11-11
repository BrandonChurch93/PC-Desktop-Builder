import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, hsvToRgb255, parseHex, type Hsv } from './color';
import s from './ColorPicker.module.css';

const FIELD_W = 96;
const FIELD_H = 48;

/** The saturation and value field for one hue, drawn from the same math as the hex it returns. */
function drawField(c: HTMLCanvasElement, h: number) {
  const g = c.getContext('2d');
  if (!g) return;
  const img = g.createImageData(FIELD_W, FIELD_H);
  for (let y = 0; y < FIELD_H; y++) for (let x = 0; x < FIELD_W; x++) {
    const [r, gg, b] = hsvToRgb255({ h, s: x / (FIELD_W - 1), v: 1 - y / (FIELD_H - 1) });
    const i = (y * FIELD_W + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function drawHue(c: HTMLCanvasElement) {
  const g = c.getContext('2d');
  if (!g) return;
  const W = 180;
  const img = g.createImageData(W, 1);
  for (let x = 0; x < W; x++) {
    const [r, gg, b] = hsvToRgb255({ h: x / W, s: 1, v: 1 });
    img.data[x * 4] = r; img.data[x * 4 + 1] = gg; img.data[x * 4 + 2] = b; img.data[x * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Props = {
  value: string;
  recent: string[];
  /** live while dragging; commit once when the pick is done */
  onChange: (hex: string, commit: boolean) => void;
  label: string;
};

/** Built in the app, not the browser's picker: a hue strip, a saturation and value square, a hex field and recent colors. */
export function ColorPicker({ value, recent, onChange, label }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [text, setText] = useState(value);
  const field = useRef<HTMLCanvasElement | null>(null);
  const hue = useRef<HTMLCanvasElement | null>(null);
  const last = useRef(value);

  // A new value from outside (another stop, undo) resets the picker. Our own edits come back as the hex we sent.
  useEffect(() => {
    if (value !== last.current) { last.current = value; setHsv((cur) => (hsvToHex(cur) === value ? cur : hexToHsv(value))); }
    setText(value);
  }, [value]);
  useEffect(() => { if (field.current) drawField(field.current, hsv.h); }, [hsv.h]);
  useEffect(() => { if (hue.current) drawHue(hue.current); }, []);

  const send = (next: Hsv, commit: boolean) => {
    setHsv(next);
    const hex = hsvToHex(next);
    last.current = hex;
    setText(hex);
    onChange(hex, commit);
  };

  const drag = (read: (x: number, y: number) => Hsv) => (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (e.button > 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.focus();
    const at = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return read(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
    };
    let cur = at(e);
    send(cur, false);
    const move = (ev: globalThis.PointerEvent) => { cur = at(ev); send(cur, false); };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); send(cur, true); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const keyField = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    send({ ...hsv, s: clamp01(hsv.s + d[0]!), v: clamp01(hsv.v + d[1]!) }, true);
  };
  const keyHue = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 / 360 : 1 / 360;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
    if (!d) return;
    e.preventDefault();
    send({ ...hsv, h: (((hsv.h + d) % 1) + 1) % 1 }, true);
  };
  const commitText = () => {
    const hex = parseHex(text);
    if (!hex) { setText(value); return; }
    if (hex !== value) { const next = hexToHsv(hex); setHsv(next); last.current = hex; onChange(hex, true); }
    setText(hex);
  };

  const huePct = `${(hsv.h * 100).toFixed(2)}%`;
  return (
    <div className={s.picker} role="group" aria-label={label}>
      <div className={s.field} tabIndex={0} role="slider" aria-label="Saturation and brightness"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)} percent, brightness ${Math.round(hsv.v * 100)} percent`}
        onPointerDown={drag((x, y) => ({ h: hsv.h, s: x, v: 1 - y }))} onKeyDown={keyField}>
        <canvas ref={field} width={FIELD_W} height={FIELD_H} className={s.canvas} aria-hidden="true" />
        <span className={s.thumb} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }} aria-hidden="true" />
      </div>
      <div className={s.hue} tabIndex={0} role="slider" aria-label="Hue" aria-valuemin={0} aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h * 360) % 360} aria-valuetext={`Hue ${Math.round(hsv.h * 360) % 360} degrees`}
        onPointerDown={drag((x) => ({ ...hsv, h: Math.min(x, 0.9999) }))} onKeyDown={keyHue}>
        <canvas ref={hue} width={180} height={1} className={s.canvas} aria-hidden="true" />
        <span className={s.hueThumb} style={{ left: huePct, background: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }} aria-hidden="true" />
      </div>
      <div className={s.row}>
        <span className={s.swatch} style={{ background: value }} aria-hidden="true" />
        <label className={s.hexLabel}>
          <span className="sr-only">Hex color</span>
          <input className={s.hex} value={text} maxLength={7} spellCheck={false} autoComplete="off"
            onChange={(e) => setText(e.target.value)} onBlur={commitText}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } if (e.key === 'Escape') { setText(value); } }} />
        </label>
      </div>
      {recent.length > 0 && (
        <div className={s.recent} role="group" aria-label="Recent colors">
          {recent.map((c) => (
            <button key={c} type="button" className={[s.chip, c === value ? s.chipOn : ''].join(' ')} style={{ background: c }} aria-label={`Use ${c}`}
              onClick={() => { const next = hexToHsv(c); setHsv(next); last.current = c; setText(c); onChange(c, true); }} />
          ))}
        </div>
      )}
    </div>
  );
}
