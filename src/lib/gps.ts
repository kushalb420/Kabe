// GPS route tracking maths (pure, tested in scripts/test-gps.ts). The phone's location is read in app/track.tsx.
// Bad GPS fixes are the main problem on a phone, so every fix is checked before it is counted.

export type Fix = { lat: number; lon: number; t: number; acc?: number | null }; // t = milliseconds since epoch
export type TrackKind = 'walk' | 'run' | 'cycle';

export const MAX_ACCURACY_M = 35; // fixes less accurate than this are ignored
export const MIN_STEP_M = 3; // standing still jitters by a few metres; smaller moves are not counted
export const MAX_SPEED_MS: Record<TrackKind, number> = { walk: 4, run: 8, cycle: 20 }; // faster than this is a GPS jump, not movement

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance between two points on the earth, in metres (haversine). */
export function haversineM(a: Pick<Fix, 'lat' | 'lon'>, b: Pick<Fix, 'lat' | 'lon'>): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Track = { last: Fix | null; meters: number; counted: number; rejected: number };
export const EMPTY_TRACK: Track = { last: null, meters: 0, counted: 0, rejected: 0 };

/** Adds one GPS fix. Inaccurate fixes and impossible jumps are rejected; tiny moves are ignored; the rest add to the distance. */
export function addFix(track: Track, fix: Fix, kind: TrackKind): Track {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) || Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) return { ...track, rejected: track.rejected + 1 };
  if (fix.acc != null && fix.acc > MAX_ACCURACY_M) return { ...track, rejected: track.rejected + 1 };
  if (!track.last) return { ...track, last: fix, counted: 1 };
  const dt = (fix.t - track.last.t) / 1000;
  if (!(dt > 0)) return { ...track, rejected: track.rejected + 1 };
  const d = haversineM(track.last, fix);
  if (d < MIN_STEP_M) return track;
  if (d / dt > MAX_SPEED_MS[kind]) return { ...track, rejected: track.rejected + 1 };
  return { last: fix, meters: track.meters + d, counted: track.counted + 1, rejected: track.rejected };
}

export type TrackSummary = { km: number; minutes: number; avgKmh: number | null; paceMinPerKm: number | null };

/** Totals for a finished route. Speed and pace are left out when the distance is too small to mean anything. */
export function summarize(track: Track, startMs: number, endMs: number): TrackSummary {
  const km = Math.round((track.meters / 1000) * 100) / 100;
  const elapsedMin = Math.max(0, (endMs - startMs) / 60000);
  const minutes = Math.max(1, Math.round(elapsedMin));
  const ok = km >= 0.05 && elapsedMin > 0;
  return {
    km,
    minutes,
    avgKmh: ok ? Math.round((km / (elapsedMin / 60)) * 10) / 10 : null,
    paceMinPerKm: ok ? elapsedMin / km : null,
  };
}

/** "5:30" from minutes per km. */
export function formatPaceMin(p: number | null): string {
  if (p === null || !Number.isFinite(p) || p <= 0 || p > 99) return '–';
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "12:05" or "1:02:03" from milliseconds. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}
