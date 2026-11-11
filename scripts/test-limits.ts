import assert from 'node:assert/strict';
import { exceedSummary, limitGoals, limitTotals, overLimits } from '../src/lib/limits';

const goals = { kcal: 2000, protein: 100, carbs: 250, fat: 70, fiber: 30 };

// ---- the daily limits
const g = limitGoals(goals);
assert.equal(g.sugar, 50, '10% of 2000 kcal as sugar = 200 kcal = 50 g');
assert.equal(Math.round(g.satFat), 22, '10% of 2000 kcal as saturated fat = 200 kcal = about 22 g');
assert.equal(g.carbs, 250);
assert.equal(g.fat, 70);

// ---- totals: an amount never recorded is nothing, not a guess
assert.deepEqual(limitTotals([{ carbs: 10, fat: 5 }, { carbs: 20, fat: 1, sugar: 4, satFat: 2 }]), { sugar: 4, carbs: 30, fat: 6, satFat: 2 });

// ---- what is over (protein and fibre are never in the list)
assert.deepEqual(overLimits({ sugar: 10, carbs: 100, fat: 20, satFat: 5 }, goals), []);
assert.deepEqual(overLimits({ sugar: 60, carbs: 251, fat: 80, satFat: 30 }, goals).map((o) => o.key), ['sugar', 'fat', 'satFat'], '251 g of 250 is within the 1% margin');
assert.deepEqual(overLimits({ sugar: 60, carbs: 300, fat: 70, satFat: 0 }, goals), [{ key: 'sugar', overG: 10 }, { key: 'carbs', overG: 50 }]);

// ---- the coach summary
const e = (date: string, carbs: number, fat: number, sugar?: number) => ({ date, carbs, fat, sugar });
const s = exceedSummary([e('2026-11-10', 300, 10, 60), e('2026-11-11', 100, 80), e('2026-11-11', 10, 5)], goals, '2026-11-11', ['2026-11-09', '2026-11-10', '2026-11-11']);
assert.deepEqual(s.overToday, [{ nutrient: 'fat', overByG: 15 }]);
assert.deepEqual(s.daysOverInLast7, { 'free sugar': 1, carbs: 1, fat: 1 });
assert.equal(s.daysLoggedInLast7, 2, 'a day with nothing logged is not counted');
console.log('limits: ok');

// ---- the person's own free sugar limit
import { sugarLimit } from '../src/lib/limits';
assert.equal(sugarLimit(goals, null), 50, 'default: 10% of calories');
assert.equal(sugarLimit(goals, 30), 30, 'own number wins');
assert.equal(sugarLimit(goals, 0), 50, 'zero or nothing means the default');
assert.equal(limitGoals(goals, 25).sugar, 25);
assert.deepEqual(overLimits({ sugar: 40, carbs: 0, fat: 0, satFat: 0 }, goals, 30), [{ key: 'sugar', overG: 10 }]);
assert.deepEqual(overLimits({ sugar: 40, carbs: 0, fat: 0, satFat: 0 }, goals), [], 'under the default 50 g');
const own = exceedSummary([{ date: '2026-11-11', carbs: 10, fat: 5, sugar: 35 }], goals, '2026-11-11', ['2026-11-11'], 30);
assert.deepEqual(own.overToday, [{ nutrient: 'free sugar', overByG: 5 }]);
console.log('limits (own sugar): ok');
