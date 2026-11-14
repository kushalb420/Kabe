// Turns a recorded route into drawing coordinates for the share card (pure, tested in scripts/test-routecard.ts).
import { Fix, haversineM } from './gps';

export type Pt = { x: number; y: number };
export type Projected = { path: string; start: Pt; end: Pt } | null;

/** At most `max` points, spread evenly, always keeping the first and the last. */
export function thin<T>(list: T[], max = 400): T[] {
  if (list.length <= max) return list;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(list[Math.round((i * (list.length - 1)) / (max - 1))]);
  return out;
}

/**
 * Fits the route inside a w x h box (with `pad` around it), keeping its true shape. North is up. Returns null when the route is
 * too short to draw (fewer than two points, or everything within a few metres).
 */
export function projectRoute(fixes: Pick<Fix, 'lat' | 'lon'>[], w: number, h: number, pad = 12): Projected {
  const pts = thin(fixes);
  if (pts.length < 2) return null;
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180); // a degree of longitude is shorter away from the equator
  const raw = pts.map((p) => ({ x: p.lon * k, y: -p.lat }));
  const minX = Math.min(...raw.map((p) => p.x));
  const maxX = Math.max(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const maxY = Math.max(...raw.map((p) => p.y));
  const spanM = haversineM({ lat: -minY, lon: minX / (k || 1) }, { lat: -maxY, lon: maxX / (k || 1) });
  if (!(spanM >= 5) || !Number.isFinite(spanM)) return null;
  const dx = maxX - minX || 1e-9;
  const dy = maxY - minY || 1e-9;
  const scale = Math.min((w - 2 * pad) / dx, (h - 2 * pad) / dy);
  const ox = (w - dx * scale) / 2;
  const oy = (h - dy * scale) / 2;
  const pos = raw.map((p) => ({ x: Math.round((ox + (p.x - minX) * scale) * 10) / 10, y: Math.round((oy + (p.y - minY) * scale) * 10) / 10 }));
  return { path: pos.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '), start: pos[0], end: pos[pos.length - 1] };
}
