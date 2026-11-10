/** Brand wordmark treatments, set in the two app faces on a canvas. One record per brand, used on every part of it. */
export type TextStyle = {
  family: 'display' | 'body';
  weight: number;
  /** extra space between letters, in em */
  spacing: number;
  /** horizontal stretch: below 1 condenses, above 1 extends */
  scaleX: number;
  upper: boolean;
  /** forward slant, as a tangent */
  skew?: number;
  /** a stencil: a horizontal bridge cut through every letter */
  stencil?: boolean;
  italic?: boolean;
};

export const FAMILY = { display: '"Unbounded Variable", "Unbounded"', body: '"DM Sans Variable", "DM Sans"' } as const;

export const BRAND_TYPE: Record<string, TextStyle> = {
  mirevale: { family: 'body', weight: 500, spacing: 0.46, scaleX: 1.04, upper: true },
  skarn: { family: 'display', weight: 800, spacing: 0.1, scaleX: 1.12, upper: true, stencil: true },
  paleforge: { family: 'body', weight: 600, spacing: 0.32, scaleX: 0.96, upper: true },
  korrin: { family: 'display', weight: 700, spacing: 0.06, scaleX: 0.84, upper: true, skew: -0.14 },
  cindervane: { family: 'body', weight: 300, spacing: 0.24, scaleX: 1, upper: true },
  hadronbay: { family: 'body', weight: 450, spacing: 0.14, scaleX: 1.08, upper: true },
  kestrane: { family: 'display', weight: 600, spacing: 0.03, scaleX: 0.88, upper: true },
  lumenfold: { family: 'body', weight: 300, spacing: 0.05, scaleX: 1, upper: false },
  calyra: { family: 'body', weight: 700, spacing: 0.22, scaleX: 1, upper: true },
  veltrin: { family: 'display', weight: 700, spacing: 0.15, scaleX: 1.04, upper: true, skew: -0.2 },
  dravik: { family: 'display', weight: 900, spacing: -0.01, scaleX: 1.26, upper: true },
  pellam: { family: 'body', weight: 500, spacing: 0.01, scaleX: 1, upper: false },
  thessic: { family: 'body', weight: 800, spacing: 0.04, scaleX: 0.78, upper: true },
  wyrmglass: { family: 'body', weight: 600, spacing: 0.12, scaleX: 1, upper: false, skew: -0.18 },
};

export const SPEC_TYPE: TextStyle = { family: 'body', weight: 500, spacing: 0.04, scaleX: 1, upper: true };
export const MODEL_TYPE: TextStyle = { family: 'body', weight: 600, spacing: 0.08, scaleX: 1, upper: true };
export const TINY_TYPE: TextStyle = { family: 'body', weight: 500, spacing: 0.02, scaleX: 0.94, upper: true };

/** Upper case that keeps the casing a standard name or unit is written in: 12V-2x6, NVMe, Hz. */
function caps(text: string): string {
  return text.toUpperCase().replace(/12V-2X6/g, '12V-2x6').replace(/NVME/g, 'NVMe').replace(/(\d)\s?HZ\b/g, (m) => m.replace('HZ', 'Hz'));
}

export function fontString(s: TextStyle, px: number) {
  return `${s.italic ? 'italic ' : ''}${s.weight} ${px}px ${FAMILY[s.family]}`;
}

/** Width in px of text set in a style at a px size, with its letter spacing and stretch. */
export function measure(g: CanvasRenderingContext2D, text: string, s: TextStyle, px: number): number {
  const t = s.upper ? caps(text) : text;
  g.font = fontString(s, px);
  let w = 0;
  for (const ch of t) w += g.measureText(ch).width + s.spacing * px;
  w -= s.spacing * px;
  return Math.max(1, w * s.scaleX + Math.abs(s.skew ?? 0) * px);
}

/** Draws text with its left edge at x and vertical middle at y. */
export function drawText(g: CanvasRenderingContext2D, text: string, s: TextStyle, x: number, y: number, px: number, fill: string) {
  const t = s.upper ? caps(text) : text;
  g.save();
  g.font = fontString(s, px);
  g.textBaseline = 'middle';
  g.fillStyle = fill;
  g.translate(x + (s.skew ? Math.abs(s.skew) * px * 0.5 : 0), y);
  g.transform(s.scaleX, 0, s.skew ?? 0, 1, 0, 0);
  let cx = 0;
  for (const ch of t) { g.fillText(ch, cx, 0); cx += g.measureText(ch).width + s.spacing * px; }
  g.restore();
  if (s.stencil) {
    const w = measure(g, text, s, px);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,1)';
    g.fillRect(x - 2, y - px * 0.035, w + 4, px * 0.07);
    g.restore();
  }
}

export const FONT_SPECS = [
  '400 32px "Unbounded Variable"', '900 32px "Unbounded Variable"', '400 32px "DM Sans Variable"',
];

export async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(FONT_SPECS.map((f) => document.fonts.load(f, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ·°×').catch(() => [])));
  await document.fonts.ready;
}
