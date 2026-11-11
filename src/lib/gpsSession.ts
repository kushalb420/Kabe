// A GPS route recorded while the app may be in the background (pure, tested in scripts/test-gps.ts).
// The background task only appends raw fixes to storage; the route is worked out afterwards with the same checks as
// foreground tracking, so bad fixes are rejected the same way.
import { EMPTY_TRACK, Fix, Track, TrackKind, addFix } from './gps';

export type Session = { kind: TrackKind; startedAt: number; fixes: Fix[] };

export const MAX_FIXES = 20000; // roughly ten hours at one fix every 2 seconds

const KINDS: TrackKind[] = ['walk', 'run', 'cycle'];

/** Adds new fixes in time order, ignoring any that are not newer than what is stored, and keeps the list bounded. */
export function appendFixes(s: Session, fixes: Fix[]): Session {
  let lastT = s.fixes.length ? s.fixes[s.fixes.length - 1].t : -Infinity;
  const add: Fix[] = [];
  for (const f of [...fixes].sort((a, b) => a.t - b.t)) {
    if (f.t > lastT) {
      add.push(f);
      lastT = f.t;
    }
  }
  if (!add.length) return s;
  return { ...s, fixes: [...s.fixes, ...add].slice(-MAX_FIXES) };
}

/** The route so far, from the stored fixes. */
export function foldSession(s: Session): Track {
  return s.fixes.reduce<Track>((tr, f) => addFix(tr, f, s.kind), EMPTY_TRACK);
}

/** Anything read back from storage is checked before use. */
export function sanitizeSession(raw: unknown): Session | null {
  const o = raw as Partial<Session> | null;
  if (!o || typeof o !== 'object' || !KINDS.includes(o.kind as TrackKind) || typeof o.startedAt !== 'number' || !Array.isArray(o.fixes)) return null;
  const fixes = o.fixes.filter((f): f is Fix => !!f && typeof f.lat === 'number' && typeof f.lon === 'number' && typeof f.t === 'number');
  return { kind: o.kind as TrackKind, startedAt: o.startedAt, fixes: fixes.slice(-MAX_FIXES) };
}
