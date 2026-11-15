// Turns a recorded route into drawing coordinates for the share card (pure, tested in scripts/test-routecard.ts).
import { Fix, haversineM } from './gps';

export type Pt = { x: number; y: number };
export type Projected = { path: string; start: Pt; end: Pt } | null;
export type LL = { lat: number; lon: number };
/** A route is one or more unbroken stretches. A new stretch starts after a long pause or a GPS jump, so no stray line joins them. */
export type Route = LL[][];

/** At most `max` points, spread evenly, always keeping the first and the last. */
export function thin<T>(list: T[], max = 400): T[] {
  if (list.length <= max) return list;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out;
}

const lengthM = (seg: LL[]) => seg.reduce((s, p, i) => (i ? s + haversineM(seg[i - 1], p) : 0), 0);

/**
 * The drawn route from the accepted GPS fixes: split wherever there was a long pause or a jump, with lone spikes (one point that
 * wanders off and comes straight back) removed, and thinned to about `maxPoints`. Stretches too short to mean anything are dropped.
 */
export function buildRoute(fixes: Fix[], gapMs = 90_000, maxPoints = 300): Route {
  const segs: Fix[][] = [];
  for (const f of fixes) {
    const cur = segs[segs.length - 1];
    if (!cur || f.brk || f.t - cur[cur.length - 1].t > gapMs) segs.push([f]);
    else cur.push(f);
  }
  const cleaned = segs.map((seg) => {
    const out: Fix[] = [];
    for (let i = 0; i < seg.length; i++) {
      const b = seg[i];
      const a = out[out.length - 1];
      const c = seg[i + 1];
      if (a && c) {
        const ab = haversineM(a, b);
        const bc = haversineM(b, c);
        const ac = haversineM(a, c);
        if (ab > 20 && bc > 20 && ac < 0.6 * Math.min(ab, bc)) continue; // out and straight back: a spike
      }
      out.push(b);
    }
    return out.map((p) => ({ lat: p.lat, lon: p.lon }));
  });
  const kept = cleaned.filter((s) => s.length >= 2 && lengthM(s) >= 10);
  const total = kept.reduce((n, s) => n + s.length, 0);
  if (total <= maxPoints) return kept;
  return kept.map((s) => thin(s, Math.max(2, Math.round((maxPoints * s.length) / total))));
}

const flat = (r: Route | LL[]): Route => (r.length && Array.isArray(r[0]) ? (r as Route) : [r as LL[]]);

/**
 * Fits the route inside a w x h box (with `pad` around it), keeping its true shape. North is up. Returns null when the route is
 * too short to draw (everything within a few metres).
 */
export function projectRoute(route: Route | LL[], w: number, h: number, pad = 12): Projected {
  const segs = flat(route).filter((s) => s.length >= 2);
  const all = segs.flat();
  if (all.length < 2) return null;
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180); // a degree of longitude is shorter away from the equator
  const xs = all.map((p) => p.lon * k);
  const ys = all.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanM = haversineM({ lat: -minY, lon: minX / (k || 1) }, { lat: -maxY, lon: maxX / (k || 1) });
  if (!(spanM >= 5) || !Number.isFinite(spanM)) return null;
  const dx = maxX - minX || 1e-9;
  const dy = maxY - minY || 1e-9;
  const scale = Math.min((w - 2 * pad) / dx, (h - 2 * pad) / dy);
  const ox = (w - dx * scale) / 2;
  const oy = (h - dy * scale) / 2;
  const pos = (p: LL): Pt => ({ x: Math.round((ox + (p.lon * k - minX) * scale) * 10) / 10, y: Math.round((oy + (-p.lat - minY) * scale) * 10) / 10 });
  const parts = segs.map((s) => s.map(pos));
  return {
    path: parts.map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')).join(' '),
    start: parts[0][0],
    end: parts[parts.length - 1][parts[parts.length - 1].length - 1],
  };
}

// ---------------------------------------------------------------- a short text form of a route (about 4 characters a point)
const enc = (n: number): string => {
  let v = n < 0 ? ~(n << 1) : n << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
};

/** Stretches joined by a space; each stretch is a Google-style encoded polyline with 5 decimals (about a metre). */
export function encodeRoute(route: Route): string {
  return route
    .map((seg) => {
      let pl = 0;
      let pn = 0;
      return seg
        .map((p) => {
          const la = Math.round(p.lat * 1e5);
          const lo = Math.round(p.lon * 1e5);
          const r = enc(la - pl) + enc(lo - pn);
          pl = la;
          pn = lo;
          return r;
        })
        .join('');
    })
    .join(' ');
}

/** The reverse. Anything odd (bad characters, too many points, impossible coordinates) gives an empty or shorter route. */
export function decodeRoute(text: string, maxPoints = 2000): Route {
  const out: Route = [];
  let count = 0;
  for (const part of text.slice(0, 20000).split(' ')) {
    const seg: LL[] = [];
    let i = 0;
    let la = 0;
    let lo = 0;
    const next = (): number | null => {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        if (i >= part.length) return null;
        b = part.charCodeAt(i++) - 63;
        if (b < 0 || b > 63) return null;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && shift < 32);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    while (i < part.length && count < maxPoints) {
      const dla = next();
      const dlo = next();
      if (dla === null || dlo === null) break;
      la += dla;
      lo += dlo;
      if (Math.abs(la) > 9e6 || Math.abs(lo) > 18e6) break;
      seg.push({ lat: la / 1e5, lon: lo / 1e5 });
      count++;
    }
    if (seg.length) out.push(seg);
  }
  return out;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 text to bytes (the picture comes back from the drawing as base64). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = ALPHABET.indexOf(clean[i]);
    const b = ALPHABET.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? ALPHABET.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? ALPHABET.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.slice(0, o);
}
