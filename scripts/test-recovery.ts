import assert from 'node:assert/strict';
import { Activity } from '../src/lib/activity';
import { Checkin, isRestDay, levelFor, musclesTrained, readiness, recommend, restDaysThisWeek, sleepHoursScore, sleepScore, sleepStats, trainingDay, trainingStreakBefore } from '../src/lib/recovery';
import { addDays } from '../src/lib/tracker';
import type { Workout } from '../src/lib/workout';

const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ~${b}, got ${a}`);
const today = '2026-03-10';

// ---- sleep hours score: peaks at 7.5–9 h, lower for too little or too much, never decreasing before the peak ----
assert.equal(sleepHoursScore(0), 0);
assert.equal(sleepHoursScore(7.5), 100);
assert.equal(sleepHoursScore(8), 100);
assert.equal(sleepHoursScore(9), 100);
near(sleepHoursScore(6), 65, 1e-9);
near(sleepHoursScore(6.5), 77.5, 1e-9);
assert.ok(sleepHoursScore(5) < sleepHoursScore(6) && sleepHoursScore(6) < sleepHoursScore(7));
assert.ok(sleepHoursScore(10) < 100 && sleepHoursScore(10) > sleepHoursScore(12 - 0.1) - 1);
assert.equal(sleepHoursScore(14), 60);
let prev = -1;
for (let h = 0; h <= 7.5; h += 0.25) {
  const s = sleepHoursScore(h);
  assert.ok(s >= prev, 'monotonic up to 7.5 h');
  prev = s;
}
// quality moves it by at most 30 points
near(sleepScore(8, 5), 100, 1e-9);
near(sleepScore(8, 1), 70, 1e-9);
near(sleepScore(6, 3), 0.7 * 65 + 15, 1e-9);

// ---- readiness ----
const great: Checkin = { sleepH: 8, sleepQ: 5, soreness: 1, fatigue: 1, stress: 1 };
const awful: Checkin = { sleepH: 3, sleepQ: 1, soreness: 5, fatigue: 5, stress: 5 };
assert.equal(readiness(great, 0).score, 100);
assert.equal(readiness(awful, 0).score, 3); // 3 h sleep still earns a few points: 0.4 × (0.7×11.25 + 0)
const mid: Checkin = { sleepH: 7, sleepQ: 3, soreness: 3, fatigue: 3, stress: 2 };
// sleep 0.7*90+15=78; soreness 50; fatigue 50; stress 75 → 0.4*78+0.2*(50+50+75)=31.2+35=66.2
assert.equal(readiness(mid, 0).score, 66);
// load penalty
assert.equal(readiness(great, 3).loadPenalty, 0);
assert.equal(readiness(great, 4).score, 90);
assert.equal(readiness(great, 6).score, 80);
assert.equal(readiness(awful, 9).score, 0, 'never below 0');
// each factor matters
assert.ok(readiness({ ...great, soreness: 5 }, 0).score < readiness(great, 0).score);
assert.ok(readiness({ ...great, stress: 5 }, 0).score < readiness(great, 0).score);
assert.ok(readiness({ ...great, sleepH: 5 }, 0).score < readiness(great, 0).score);
// out-of-range inputs are clamped, not exploded
assert.ok(readiness({ sleepH: 8, sleepQ: 9, soreness: 0, fatigue: -2, stress: 99 }, 0).score <= 100);

// ---- levels & recommendations ----
assert.deepEqual([100, 75, 74, 55, 54, 35, 34, 0].map(levelFor), ['push', 'push', 'moderate', 'moderate', 'light', 'light', 'rest', 'rest']);
const rec = recommend(90, great, { streak: 0, musclesYesterday: [] });
assert.equal(rec.level, 'push');
assert.ok(rec.tips.length >= 1);
const sore = recommend(60, { ...mid, soreness: 5, sleepH: 5.5 }, { streak: 5, musclesYesterday: ['Legs', 'Back'] });
assert.ok(sore.tips.some((t) => /legs, back/.test(t)), 'names the sore muscle groups');
assert.ok(sore.tips.some((t) => /slept 5.5 h/.test(t)));
assert.ok(sore.tips.some((t) => /5 days in a row/.test(t)));
assert.ok(recommend(60, { ...mid, soreness: 4 }, { streak: 0, musclesYesterday: [] }).tips.some((t) => /mobility/.test(t)));
const rest = recommend(10, awful, { streak: 0, musclesYesterday: [] });
assert.equal(rest.level, 'rest');
assert.ok(rest.tips.some((t) => /see a doctor/.test(t)), 'rest advice includes a safety note');
assert.ok(recommend(80, { ...great, stress: 5 }, { streak: 0, musclesYesterday: [] }).tips.some((t) => /Stress is high/.test(t)));

// ---- sleep stats ----
const ck = (h: number): Checkin => ({ ...great, sleepH: h });
const log: Record<string, Checkin> = { [today]: ck(6), [addDays(today, -1)]: ck(8), [addDays(today, -2)]: ck(5), [addDays(today, -9)]: ck(2) /* out of range */ };
const st = sleepStats(log, today, 8);
assert.equal(st.daysLogged, 3);
near(st.avg7!, 6.3, 1e-9); // (6+8+5)/3 = 6.33
assert.equal(st.debtH, 5); // (8-6)+(0)+(8-5)
assert.equal(st.bestH, 8);
assert.equal(st.worstH, 5);
assert.deepEqual(sleepStats({}, today, 8), { avg7: null, daysLogged: 0, debtH: 0, bestH: null, worstH: null });

// ---- training days, streaks, rest days ----
const workout = (date: string, ids: string[], sets = 3): Workout => ({ id: date, name: 'W', date, startedAt: 0, durationSec: 1800, exercises: ids.map((id) => ({ exerciseId: id, name: id, sets: Array.from({ length: sets }, (_, i) => ({ id: `${id}${i}`, weight: 50, reps: 8, done: true })) })) });
const act = (date: string, type: Activity['type'], minutes: number): Activity => ({ id: date + type, date, type, minutes });

const workouts = [workout(addDays(today, -1), ['squat', 'bench-press']), workout(addDays(today, -2), ['deadlift']), workout(addDays(today, -4), ['squat'])];
const acts = [act(addDays(today, -3), 'run', 30), act(addDays(today, -5), 'walk', 40), act(addDays(today, -6), 'cardio', 15)];
assert.equal(trainingDay(addDays(today, -1), workouts, acts), true);
assert.equal(trainingDay(addDays(today, -3), workouts, acts), true, 'a 30 min run counts');
assert.equal(trainingDay(addDays(today, -5), workouts, acts), false, 'an easy 40 min walk does not');
assert.equal(trainingDay(addDays(today, -6), workouts, acts), false, 'a 15 min session is too short');
assert.equal(trainingDay(today, [workout(today, ['squat'], 0)], []), false, 'workout with no completed sets is not training');
// streak counts back from yesterday: -1 (workout), -2 (workout), -3 (run), -4 (workout), -5 rest → 4
assert.equal(trainingStreakBefore(today, workouts, acts, []), 4);
// a manual rest day breaks the run
assert.equal(trainingStreakBefore(today, workouts, acts, [addDays(today, -3)]), 2);
assert.equal(trainingStreakBefore(today, [], [], []), 0);
assert.equal(isRestDay(addDays(today, -5), workouts, acts, []), true);
assert.equal(isRestDay(addDays(today, -1), workouts, acts, []), false);
assert.equal(isRestDay(addDays(today, -1), workouts, acts, [addDays(today, -1)]), true, 'you can declare a rest day');
// rest days in the last 7 days: -6 (short cardio), -5 (walk), today, and ... training on -1,-2,-3,-4 → rest: -6,-5,0 = 3
assert.equal(restDaysThisWeek(today, workouts, acts, []), 3);
assert.equal(restDaysThisWeek(today, [], [], []), 7);

// ---- muscles trained yesterday ----
assert.deepEqual(musclesTrained(addDays(today, -1), workouts).sort(), ['Chest', 'Legs']);
assert.deepEqual(musclesTrained(addDays(today, -2), workouts), ['Back']);
assert.deepEqual(musclesTrained(today, workouts), []);
assert.deepEqual(musclesTrained(addDays(today, -1), workouts, (id) => (id === 'squat' ? 'Core' : undefined)), ['Core'], 'custom exercise lookup is honoured');
console.log('Recovery tests passed.');
