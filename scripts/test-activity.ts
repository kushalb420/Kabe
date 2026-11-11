import assert from 'node:assert/strict';
import { Activity, formatPace, isHardSession, kcalBurned, metFor, paceMinPerKm, personalBests, speedKmh, weekSeries, weekSummary } from '../src/lib/activity';
import { addDays } from '../src/lib/tracker';

const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ~${b}, got ${a}`);
const act = (type: Activity['type'], minutes: number, km?: number, date = '2026-03-10', effort?: number): Activity => ({ id: `${type}${minutes}${km}${date}`, date, type, minutes, km, effort });

// ---- pace & speed ----
near(paceMinPerKm(act('run', 30, 5))!, 6, 1e-9);
near(speedKmh(act('run', 30, 5))!, 10, 1e-9);
assert.equal(paceMinPerKm(act('run', 30)), null, 'no distance → no pace');
assert.equal(paceMinPerKm(act('run', 0, 5)), null);
assert.equal(formatPace(6), '6:00 /km');
assert.equal(formatPace(5.5), '5:30 /km');
assert.equal(formatPace(5.999), '6:00 /km', 'seconds roll over cleanly');
assert.equal(formatPace(null), '—');

// ---- MET by speed ----
assert.equal(metFor(act('run', 30, 5)), 9.8); // 10 km/h
assert.equal(metFor(act('run', 30, 3.9)), 7.0); // 7.8 km/h slow jog
assert.equal(metFor(act('run', 30, 4)), 8.3); // exactly 8.0 km/h starts the next band
assert.equal(metFor(act('run', 30, 4.4)), 8.3); // 8.8 km/h
assert.equal(metFor(act('run', 20, 5)), 14.5); // 15 km/h
assert.equal(metFor(act('run', 30)), 9.8, 'unknown distance → typical');
assert.equal(metFor(act('walk', 60, 4.8)), 3.5); // 4.8 km/h
assert.equal(metFor(act('walk', 60, 6.5)), 5.0); // brisk
assert.equal(metFor(act('walk', 60)), 3.5);
assert.equal(metFor(act('cycle', 60, 15)), 4.0); // easy
assert.equal(metFor(act('cycle', 60, 20)), 8.0);
assert.equal(metFor(act('cycle', 60, 30)), 12.0);
assert.equal(metFor(act('cardio', 30, undefined, '2026-03-10', 2)), 4.0);
assert.equal(metFor(act('cardio', 30, undefined, '2026-03-10', 5)), 6.0);
assert.equal(metFor(act('cardio', 30, undefined, '2026-03-10', 8)), 8.0);
assert.equal(metFor(act('cardio', 30, undefined, '2026-03-10', 10)), 10.0);
assert.equal(metFor(act('cardio', 30)), 6.0);
assert.equal(metFor(act('other', 30)), 4.0);
// faster is never "cheaper": MET never decreases with speed
for (const type of ['walk', 'run', 'cycle'] as const) {
  let prev = 0;
  for (let v = 2; v <= 32; v += 0.5) {
    const m = metFor(act(type, 60, v));
    assert.ok(m >= prev, `${type} MET dropped at ${v} km/h`);
    prev = m;
  }
}

// ---- calories: MET × kg × hours ----
assert.equal(kcalBurned(act('run', 30, 5), 70), Math.round(9.8 * 70 * 0.5)); // 343
assert.equal(kcalBurned(act('walk', 60, 4.8), 60), 210);
assert.equal(kcalBurned(act('run', 60, 10), 80) > kcalBurned(act('run', 60, 10), 60), true, 'heavier person burns more');
assert.equal(kcalBurned(act('run', 0, 0), 70), 0);

// ---- what counts as hard training ----
assert.equal(isHardSession(act('run', 25, 4)), true);
assert.equal(isHardSession(act('run', 15, 2)), false);
assert.equal(isHardSession(act('walk', 45, 4)), false, 'easy walk = active recovery');
assert.equal(isHardSession(act('walk', 100, 8)), true);
assert.equal(isHardSession(act('cardio', 30)), true);

// ---- week summary (only the 7 days ending today) ----
const today = '2026-03-10';
const list = [
  act('run', 30, 5, today), act('walk', 40, 3, addDays(today, -2)), act('cycle', 60, 20, addDays(today, -6)),
  act('run', 45, 7, addDays(today, -7)), // 8 days ago → excluded
];
const steps = { [today]: 9000, [addDays(today, -1)]: 6000, [addDays(today, -2)]: 0, [addDays(today, -9)]: 20000 };
const ws = weekSummary(list, steps, today, 70, 8000);
assert.equal(ws.activeMinutes, 190, "60 (9,000 steps beat a 30-min run), 30 (6,000 steps), 40 (logged walk), 60 (logged ride)");
assert.equal(ws.km, 34.3, "larger of logged km and steps-implied km each day: 6.8 + 4.5 + 3 + 20");
assert.equal(ws.sessions, 3);
assert.equal(ws.avgSteps, 7500); // 0 and out-of-range days ignored
assert.equal(ws.stepDays, 2);
assert.equal(ws.goalDays, 1);
assert.equal(ws.kcal, kcalBurned(list[0], 70) + kcalBurned(list[1], 70) + kcalBurned(list[2], 70));
const none = weekSummary([], {}, today, 70, 8000);
assert.deepEqual([none.activeMinutes, none.avgSteps, none.sessions], [0, null, 0]);
const series = weekSeries(list, steps, today);
assert.equal(series.length, 7);
assert.equal(series[6].minutes, 60);
assert.equal(series[6].steps, 9000);
assert.equal(series[0].date, addDays(today, -6));
assert.equal(series[0].minutes, 60);

// ---- personal bests ----
const b = personalBests([act('run', 20, 3), act('run', 60, 10), act('run', 10, 2), act('walk', 90, 7), act('cycle', 90, 35), act('run', 25, 3)]);
assert.equal(b.longestRunKm, 10);
near(b.fastestRunPace!, 6, 1e-9, 'best pace among runs ≥ 3 km (the 2 km sprint at 5:00 is ignored)'); // 20/3=6.67, 60/10=6.0, 25/3=8.33
assert.equal(b.longestWalkKm, 7);
assert.equal(b.longestRideKm, 35);
assert.deepEqual(personalBests([]), { longestRunKm: null, fastestRunPace: null, longestWalkKm: null, longestRideKm: null });
console.log('Activity tests passed.');

// ---- one shared definition of active minutes and km ----
import { STEP_BASELINE, activeMinuteItems, dayTotals, stepsKm, walkingMinutes, workoutSessions } from '../src/lib/activity';
assert.equal(walkingMinutes(STEP_BASELINE), 0, 'the first 3,000 steps are everyday movement');
assert.equal(walkingMinutes(10_595), 76);
assert.equal(walkingMinutes(0), 0);
assert.equal(stepsKm(10_000), 7.5);
const sess = [{ date: today, minutes: 20, km: 2 }, { date: today, minutes: 15 }];
assert.deepEqual(dayTotals(sess, {}, today), { minutes: 35, km: 2 }, 'logged sessions add up');
assert.deepEqual(dayTotals(sess, { [today]: 9000 }, today), { minutes: 60, km: 6.8 }, 'steps win when larger, never added on top');
assert.deepEqual(dayTotals([], { [today]: 2000 }, today), { minutes: 0, km: 1.5 });
const wk = workoutSessions([{ date: today, durationSec: 2700 }, { date: today, durationSec: 0 }, { date: today }]);
assert.deepEqual(wk, [{ date: today, minutes: 45 }], 'a workout is a session of its length; empty ones are ignored');
assert.equal(dayTotals(wk, {}, today).minutes, 45);
assert.equal(weekSummary([], {}, today, 70, 8000, [{ date: today, durationSec: 1800 }]).activeMinutes, 30, 'workouts count');
assert.equal(weekSummary([], {}, today, 70, 8000, [{ date: today, durationSec: 1800 }]).sessions, 1);
assert.deepEqual(activeMinuteItems(sess, { [addDays(today, -1)]: 6000 }).sort((a, b) => a.date.localeCompare(b.date)), [{ date: addDays(today, -1), value: 30 }, { date: today, value: 35 }]);
