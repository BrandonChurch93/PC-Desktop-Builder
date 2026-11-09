import { getCase, K, LIGHT_TARGETS } from '../data/catalog';
import { revalidate } from './rules';
import type { Build, Lighting, Profile, Removed } from './types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  t['+'.charCodeAt(0)] = 62;
  t['/'.charCodeAt(0)] = 63;
  return t;
})();

export function bytesToBase64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]!;
  }
  return out;
}

export function base64urlToBytes(text: string): Uint8Array | null {
  const s = text.replace(/\s+/g, '').replace(/=+$/, '');
  if (s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let buf = 0; let bits = 0; let o = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const v = code < 128 ? (LOOKUP[code] ?? -1) : -1;
    if (v < 0) return null;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, o);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

type ProfileTuple = [string, number, number, number, string[]];
const profileOut = (p: Profile): ProfileTuple => [p.effect, p.speed, p.brightness, p.direction, p.stops.map((s) => s.slice(1))];

function profileIn(a: unknown): Record<string, unknown> {
  const x = Array.isArray(a) ? a : [];
  const stops = Array.isArray(x[4]) ? x[4].map((s: unknown) => `#${String(s)}`) : [];
  return { effect: x[0], speed: x[1], brightness: x[2], direction: x[3], stops };
}

export function payload(b: Build): unknown[] {
  const c = b.case ? getCase(b.case.id) : undefined;
  const order = c ? c.fanMounts.map((m) => m.id) : [];
  const fans = Object.keys(b.fans).sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((m) => [m, b.fans[m]]);
  const ov: unknown[] = [];
  for (const t of LIGHT_TARGETS) {
    const o = b.lighting.overrides[t];
    if (o === undefined) continue;
    ov.push([t, o === 'off' ? 0 : profileOut(o)]);
  }
  return [
    K.shareVersion,
    b.case ? b.case.id : 0,
    b.case ? b.case.finish : 0,
    b.board || 0,
    b.cpu || 0,
    b.cooler ? b.cooler.id : 0,
    b.cooler && b.cooler.mount ? b.cooler.mount : 0,
    b.ram,
    b.gpu || 0,
    [b.storage.nvme, b.storage.ssd, b.storage.hdd],
    b.psu || 0,
    fans,
    b.cables,
    b.glass ? 1 : 0,
    [...profileOut(b.lighting), ov],
    b.name,
  ];
}

export function encode(b: Build): string {
  return bytesToBase64url(encoder.encode(JSON.stringify(payload(b))));
}

export type DecodeResult = { error: 'BAD_LINK' | 'NEWER_LINK' } | { build: Build; removed: Removed[] };

export function decode(code: string): DecodeResult {
  let a: unknown;
  try {
    const bytes = base64urlToBytes(String(code));
    if (!bytes) return { error: 'BAD_LINK' };
    a = JSON.parse(decoder.decode(bytes));
  } catch {
    return { error: 'BAD_LINK' };
  }
  if (!Array.isArray(a) || !Number.isInteger(a[0]) || (a[0] as number) < 1) return { error: 'BAD_LINK' };
  if ((a[0] as number) > K.shareVersion) return { error: 'NEWER_LINK' };
  try {
    const L = Array.isArray(a[14]) ? a[14] : [];
    const lighting = { ...profileIn(L), overrides: {} as Record<string, unknown> };
    const ovs = L[5];
    if (ovs !== undefined && ovs !== null) {
      if (!Array.isArray(ovs)) throw new Error('overrides');
      for (const pair of ovs) {
        if (!Array.isArray(pair)) throw new Error('override');
        const [t, v] = pair as [unknown, unknown];
        if (typeof t === 'string' && (LIGHT_TARGETS as readonly string[]).includes(t)) lighting.overrides[t] = v === 0 ? 'off' : profileIn(v);
      }
    }
    const st = Array.isArray(a[9]) ? a[9] : [];
    const fanEntries = a[11] ?? [];
    if (!Array.isArray(fanEntries)) throw new Error('fans');
    const fans: Record<string, unknown> = {};
    for (const e of fanEntries) {
      if (!Array.isArray(e)) throw new Error('fan');
      Object.defineProperty(fans, String(e[0]), { value: e[1], enumerable: true, writable: true, configurable: true });
    }
    const loose = {
      v: a[0],
      case: a[1] ? { id: a[1], finish: a[2] } : null,
      board: a[3] || null,
      cpu: a[4] || null,
      cooler: a[5] ? { id: a[5], mount: a[6] || null } : null,
      ram: Array.isArray(a[7]) ? a[7] : [],
      gpu: a[8] || null,
      storage: { nvme: st[0], ssd: st[1], hdd: st[2] },
      psu: a[10] || null,
      fans,
      cables: a[12],
      glass: a[13] !== 0,
      lighting: lighting as unknown as Lighting,
      name: a[15],
    };
    return revalidate(loose as unknown as Build);
  } catch {
    return { error: 'BAD_LINK' };
  }
}

export const shareUrl = (origin: string, path: string, code: string) => `${origin}${path}#b=${code}`;

export function codeFromHash(hash: string): string | null {
  const m = /(?:^#|&)b=([^&]*)/.exec(hash);
  return m && m[1] !== undefined ? decodeURIComponent(m[1]) : null;
}
