import assert from 'node:assert/strict';
import { MAX_FIXES, appendFixes, foldSession, sanitizeSession } from '../src/lib/gpsSession';
import { EMPTY_TRACK, Fix, addFix, formatClock, formatPaceMin, haversineM, summarize } from '../src/lib/gps';

const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ~${b}, got ${a}`);

// ---- distance ----
near(haversineM({ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 }), 111.19, 0.5, '0.001° of latitude');
near(haversineM({ lat: 17.385, lon: 78.4867 }, { lat: 17.385, lon: 78.4867 }), 0, 1e-6);
near(haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 111195, 50, 'one degree of longitude at the equator');
near(haversineM({ lat: 51.5007, lon: -0.1246 }, { lat: 48.8584, lon: 2.2945 }), 340000, 3000, 'Big Ben to the Eiffel Tower, about 340 km');

// ---- a steady run north: a fix every 10 s, 0.0003° (about 33 m) apart = 3.3 m/s ----
const fix = (i: number, over: Partial<Fix> = {}): Fix => ({ lat: 17 + i * 0.0003, lon: 78, t: 1_000_000 + i * 10_000, acc: 8, ...over });
let tr = EMPTY_TRACK;
for (let i = 0; i < 10; i++) tr = addFix(tr, fix(i), 'run');
near(tr.meters, 9 * 33.36, 1, 'nine steps of about 33 m');
assert.equal(tr.counted, 10);
assert.equal(tr.rejected, 0);

// ---- bad fixes never count ----
let bad = addFix(EMPTY_TRACK, fix(0), 'run');
bad = addFix(bad, fix(1, { acc: 120 }), 'run');
assert.equal(bad.rejected, 1, 'an inaccurate fix is rejected');
assert.equal(bad.meters, 0);
bad = addFix(bad, { lat: 18, lon: 78, t: fix(1).t, acc: 8 }, 'run');
assert.equal(bad.rejected, 2, 'a 111 km jump in 10 seconds is a GPS error');
assert.equal(bad.meters, 0);
bad = addFix(bad, fix(2, { t: fix(0).t }), 'run');
assert.equal(bad.rejected, 3, 'a fix with no time passing is rejected');
const still = addFix(addFix(EMPTY_TRACK, fix(0), 'walk'), { ...fix(0), t: fix(1).t, lat: 17 + 0.00001 }, 'walk');
assert.equal(still.meters, 0, 'standing still (1 m of jitter) adds nothing');
assert.equal(still.rejected, 0, 'jitter is ignored, not an error');
assert.equal(addFix(EMPTY_TRACK, { lat: NaN, lon: 0, t: 1 }, 'walk').rejected, 1);
assert.equal(addFix(EMPTY_TRACK, { lat: 95, lon: 0, t: 1 }, 'walk').rejected, 1, 'impossible latitude');
assert.equal(addFix(EMPTY_TRACK, { lat: 17, lon: 78, t: 1, acc: null }, 'walk').counted, 1, 'a missing accuracy is accepted');

// ---- the same moves are fine on a bike but a jump on foot ----
const fast = (kind: 'walk' | 'cycle') => addFix(addFix(EMPTY_TRACK, { lat: 17, lon: 78, t: 0, acc: 5 }, kind), { lat: 17.0001, lon: 78, t: 1000, acc: 5 }, kind); // 11 m in 1 s
assert.equal(fast('walk').rejected, 1, '11 m/s is too fast to walk');
assert.equal(fast('cycle').rejected, 0, '11 m/s is normal on a bike');

// ---- summary ----
const s = summarize(tr, 1_000_000, 1_000_000 + 90_000);
near(s.km, 0.3, 0.01);
assert.equal(s.minutes, 2, '1.5 minutes rounds up to 2');
near(s.avgKmh!, 12, 0.5);
near(s.paceMinPerKm!, 5, 0.3);
const tiny = summarize({ ...EMPTY_TRACK, meters: 20 }, 0, 60_000);
assert.equal(tiny.avgKmh, null, 'under 50 m: no speed or pace');
assert.equal(tiny.paceMinPerKm, null);
assert.equal(summarize(EMPTY_TRACK, 5, 5).minutes, 1, 'at least one minute');

// ---- formatting ----
assert.equal(formatPaceMin(5.5), '5:30');
assert.equal(formatPaceMin(5.999), '6:00', 'rounding never shows :60');
assert.equal(formatPaceMin(null), '–');
assert.equal(formatPaceMin(0), '–');
assert.equal(formatClock(125_000), '2:05');
assert.equal(formatClock(3_723_000), '1:02:03');
assert.equal(formatClock(-5), '0:00');

// ---- a route recorded in the background ----
{
  const fx = (i: number, over: Partial<Fix> = {}): Fix => ({ lat: 17 + i * 0.0003, lon: 78, t: 1_000_000 + i * 10_000, acc: 8, ...over });
  const s0 = { kind: 'run' as const, startedAt: 1_000_000, fixes: [] as Fix[] };
  const s1 = appendFixes(s0, [fx(0), fx(1), fx(2)]);
  assert.equal(s1.fixes.length, 3);
  assert.equal(appendFixes(s1, [fx(1), fx(2)]), s1, 'fixes that are not newer are ignored (the same object comes back)');
  const s2 = appendFixes(s1, [fx(4), fx(3)]);
  assert.deepEqual(s2.fixes.map((f) => f.t), [0, 1, 2, 3, 4].map((i) => 1_000_000 + i * 10_000), 'new fixes are put in time order');
  let direct = EMPTY_TRACK;
  for (const f of s2.fixes) direct = addFix(direct, f, 'run');
  assert.deepEqual(foldSession(s2), direct, 'folding the session equals adding the fixes one by one');
  near(foldSession(s2).meters, 4 * 33.36, 1, 'four steps of about 33 m');
  const noisy = appendFixes(s0, [fx(0), fx(1, { acc: 200 }), fx(2, { lat: 40 }), fx(3)]);
  assert.equal(foldSession(noisy).rejected, 2, 'the bad fixes are rejected at folding time');
  const many = appendFixes(s0, Array.from({ length: MAX_FIXES + 50 }, (_, i) => ({ lat: 17, lon: 78, t: 2_000_000 + i * 1000, acc: 5 })));
  assert.equal(many.fixes.length, MAX_FIXES, 'bounded');
  assert.equal(many.fixes[many.fixes.length - 1].t, 2_000_000 + (MAX_FIXES + 49) * 1000, 'the newest are kept');
  assert.deepEqual(sanitizeSession(JSON.parse(JSON.stringify(s2))), s2);
  assert.equal(sanitizeSession(null), null);
  assert.equal(sanitizeSession({ kind: 'swim', startedAt: 1, fixes: [] }), null, 'unknown kind');
  assert.equal(sanitizeSession({ kind: 'walk', startedAt: 'x', fixes: [] }), null);
  assert.equal(sanitizeSession({ kind: 'walk', startedAt: 1, fixes: 'no' }), null);
  assert.equal(sanitizeSession({ kind: 'walk', startedAt: 1, fixes: [{ lat: 1, lon: 2, t: 3 }, null, { lat: 'x' }] })!.fixes.length, 1, 'broken fixes are dropped');
}

console.log('GPS tests passed.');
