import assert from 'node:assert/strict';
import { dailyIntake, estimateTdee, forecastGoal, planStatus, suggestTarget, tooFast, trendSlope, weekSummary } from '../src/lib/coach';
import { Profile, macrosForCalories, suggestGoals } from '../src/lib/nutrition';
import { addDays } from '../src/lib/tracker';

const today = '2026-03-30';
const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ~${b}, got ${a}`);

// helpers: a window of days ending today
const weightsFrom = (n: number, f: (i: number) => number, every = 1) =>
  Array.from({ length: n }, (_, i) => i).filter((i) => i % every === 0).map((i) => ({ date: addDays(today, i - (n - 1)), kg: Math.round(f(i) * 100) / 100 }));
const intakeDays = (n: number, kcal: number, skip: (i: number) => boolean = () => false) => {
  const entries = Array.from({ length: n }, (_, i) => i)
    .filter((i) => !skip(i))
    .map((i) => ({ date: addDays(today, i - (n - 1)), kcal, protein: kcal * 0.06, carbs: kcal * 0.12, fat: kcal * 0.03 }));
  return dailyIntake(entries, n, today);
};

// --- dailyIntake ---
const di = dailyIntake([{ date: today, kcal: 500, protein: 20, carbs: 50, fat: 10 }, { date: today, kcal: 300, protein: 10, carbs: 30, fat: 5 }], 3, today);
assert.equal(di.length, 3);
assert.equal(di[2].kcal, 800);
assert.equal(di[2].logged, true);
assert.equal(di[0].logged, false);
assert.equal(di[0].date, addDays(today, -2));

// --- trend slope ---
const falling = weightsFrom(28, (i) => 70 - i * (0.5 / 7)); // -0.5 kg/week
near(trendSlope(falling, today)!.kgPerWeek, -0.5, 0.01, 'slope');
assert.equal(trendSlope(weightsFrom(28, () => 70, 7), today), null, 'too few weigh-ins');
assert.equal(trendSlope(weightsFrom(5, () => 70), today), null, 'too few points');

// --- TDEE from energy balance ---
// eating 2000/day while losing 0.5 kg/week → real use ≈ 2000 + 0.5*7700/7 = 2550
const t = estimateTdee(intakeDays(28, 2000), falling, today);
assert.ok(t.ok);
if (t.ok) {
  near(t.tdee, 2550, 20, 'tdee');
  assert.equal(t.confidence, 'high');
  near(t.kgPerWeek, -0.5, 0.05);
}
// gaining while eating 2500 → real use is lower than intake
const gaining = weightsFrom(28, (i) => 70 + i * (0.35 / 7));
const t2 = estimateTdee(intakeDays(28, 2500), gaining, today);
assert.ok(t2.ok && t2.tdee < 2500 && t2.tdee > 2000);
// not enough logging → refuses and explains
const sparse = estimateTdee(intakeDays(28, 2000, (i) => i % 2 === 0), falling, today);
assert.ok(!sparse.ok && /full food log/.test(sparse.reason));
// no weigh-ins at an end → refuses
const noLate = estimateTdee(intakeDays(28, 2000), falling.filter((w) => w.date < addDays(today, -12)), today);
assert.ok(!noLate.ok && /weigh-ins/.test(noLate.reason));
// absurd result → refuses
const absurd = estimateTdee(intakeDays(28, 900), weightsFrom(28, (i) => 70 + i * 0.3), today);
assert.ok(!absurd.ok);

// --- targets ---
const female: Profile = { sex: 'female', age: 30, heightCm: 165, weightKg: 60, activity: 'light', goal: 'lose' };
const fromLogs = suggestTarget(female, t);
assert.equal(fromLogs.basis, 'your logs');
near(fromLogs.kcal, 2150, 20); // 2550 − 400
const noData = suggestTarget(female, sparse);
assert.equal(noData.basis, 'formula');
// floor: a low-TDEE woman is never pushed under 1200
const tiny: Profile = { sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose' };
const lowT = suggestTarget(tiny, { ok: false, reason: 'x' });
assert.ok(lowT.kcal >= 1200);
assert.equal(lowT.floored, true);
assert.match(lowT.note, /doctor or dietitian/);
// consistent with the original calculator
assert.equal(suggestGoals(female).kcal, suggestTarget(female, { ok: false, reason: 'x' }).kcal);
const m = macrosForCalories(2000, 70, 'lose');
assert.equal(m.protein, 126);
near(m.protein * 4 + m.carbs * 4 + m.fat * 9, 2000, 20);

// --- plan status ---
assert.equal(planStatus('lose', { kgPerWeek: -0.5 }, 0.9), 'progressing');
assert.equal(planStatus('lose', { kgPerWeek: -0.08 }, 0.9), 'slow');
assert.equal(planStatus('lose', { kgPerWeek: 0.02 }, 0.9), 'plateau');
assert.equal(planStatus('lose', { kgPerWeek: 0.02 }, 0.3), 'unclear', "don't blame the plan if logging stopped");
assert.equal(planStatus('gain', { kgPerWeek: 0.3 }, 0.9), 'progressing');
assert.equal(planStatus('maintain', { kgPerWeek: 0.05 }, 0.9), 'stable');
assert.equal(planStatus('maintain', { kgPerWeek: -0.6 }, 0.9), 'drifting');
assert.equal(planStatus('lose', null, 1), 'insufficient');

// --- forecast ---
const f = forecastGoal(70, 65, { kgPerWeek: -0.5 }, today);
assert.ok(f.ok && f.weeks === 10 && f.date === addDays(today, 70));
assert.deepEqual(forecastGoal(70, null, { kgPerWeek: -0.5 }, today), { ok: false, reason: 'no_goal' });
assert.deepEqual(forecastGoal(70, 65, { kgPerWeek: 0.3 }, today), { ok: false, reason: 'wrong_direction' });
assert.deepEqual(forecastGoal(70, 65, { kgPerWeek: -0.02 }, today), { ok: false, reason: 'flat' });
assert.deepEqual(forecastGoal(70, 65, null, today), { ok: false, reason: 'insufficient' });
assert.deepEqual(forecastGoal(65.1, 65, { kgPerWeek: -0.5 }, today), { ok: false, reason: 'reached' });
assert.deepEqual(forecastGoal(100, 50, { kgPerWeek: -0.1 }, today), { ok: false, reason: 'too_far' });

// --- safety flag ---
assert.equal(tooFast({ kgPerWeek: -1.2 }, 70), true);
assert.equal(tooFast({ kgPerWeek: -0.5 }, 70), false);
assert.equal(tooFast({ kgPerWeek: 1.2 }, 70), false);

// --- week summary ---
const ws = weekSummary(intakeDays(14, 2000, (i) => i >= 11), { kcal: 2000, protein: 100 });
assert.equal(ws.loggedDays, 4); // only 4 of the last 7 days have food
assert.equal(ws.avgKcal, 2000);
assert.equal(ws.kcalGoalDays, 4);
assert.equal(weekSummary(intakeDays(7, 0, () => true), { kcal: 2000, protein: 100 }).loggedDays, 0);

console.log('Coach analytics tests passed.');
