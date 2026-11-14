// Run with: npm test
import assert from 'node:assert/strict';
import { FOODS } from '../src/data/foods';
import { macrosFor, scaleToGrams, suggestGoals, sumMacros, toDateKey } from '../src/lib/nutrition';

const egg = FOODS.find((x) => x.id === 'egg')!;
const m = macrosFor(egg, 100);
assert.equal(m.kcal, 155);
assert.equal(macrosFor(egg, 50).protein, 6.3);

assert.equal(sumMacros([macrosFor(egg, 50), macrosFor(egg, 50)]).kcal, 155);

const goals = suggestGoals({ sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'light', goal: 'maintain' });
assert.ok(goals.kcal > 2200 && goals.kcal < 2800, `kcal ${goals.kcal}`);

// Editing an entry's grams rescales macros proportionally
const entry = { ...macrosFor(egg, 50), grams: 50, name: 'Egg' };
const doubled = scaleToGrams(entry, 100);
assert.equal(doubled.kcal, 155);
assert.equal(doubled.grams, 100);
assert.equal(scaleToGrams(entry, 0), entry); // invalid amount is ignored

// Unknown sugar/sodium stay unknown through scaling and multiplication
const unk = macrosFor({ ...egg, sugar: undefined, sodium: 124 }, 100);
assert.equal(unk.sugar, undefined);
assert.equal(unk.sodium, 124);
assert.equal(scaleToGrams({ ...unk, grams: 100 }, 50).sodium, 62);
assert.equal(scaleToGrams({ ...unk, grams: 100 }, 50).sugar, undefined);

assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05');

// Sanity: energy from macros should be within ~25% of listed kcal (catches typos in food data)
for (const f of FOODS) {
  const est = f.protein * 4 + f.carbs * 4 + f.fat * 9;
  assert.ok(Math.abs(est - f.kcal) <= f.kcal * 0.25 + 15, `${f.id}: macros ${est} vs kcal ${f.kcal}`);
}
console.log(`All nutrition tests passed (${FOODS.length} foods checked).`);

// ---- goals from a target weight and a carb level ----
import { goalFor, weeksToTarget, CARB_SHARE } from '../src/lib/nutrition';
const base = { sex: 'female', age: 30, heightCm: 165, weightKg: 70, activity: 'light', goal: 'maintain' } as const;
assert.equal(goalFor({ ...base, targetKg: 62 }), 'lose');
assert.equal(goalFor({ ...base, targetKg: 75 }), 'gain');
assert.equal(goalFor({ ...base, targetKg: 70.5 }), 'maintain');
assert.equal(goalFor({ ...base, goal: 'gain' }), 'gain', 'no target: the chosen goal stays');
assert.equal(weeksToTarget({ ...base, targetKg: 62 }), 18, '8 kg at about 0.45 kg a week');
assert.equal(weeksToTarget({ ...base, targetKg: 70.5 }), null);
assert.equal(weeksToTarget(base), null);
const lose = suggestGoals({ ...base, targetKg: 62 });
assert.ok(lose.kcal < suggestGoals(base).kcal, 'a lower target means fewer calories');
assert.ok(lose.kcal >= 1200, 'never below the safe floor');
for (const level of ['low', 'mid', 'high'] as const) {
  const m = suggestGoals({ ...base, carbLevel: level });
  const share = (m.carbs * 4) / m.kcal;
  assert.ok(Math.abs(share - CARB_SHARE[level]) < 0.04, level + ' carb share ' + share);
  assert.ok(Math.abs(m.protein * 4 + m.carbs * 4 + m.fat * 9 - m.kcal) < 25, level + ' macros add up to the calories');
  assert.ok((m.fat * 9) / m.kcal >= 0.19, 'fat is never below a fifth of calories');
}
const lo = suggestGoals({ ...base, carbLevel: 'low' });
const hi = suggestGoals({ ...base, carbLevel: 'high' });
assert.ok(lo.carbs < hi.carbs && lo.fat > hi.fat, 'low carb means more fat, high carb means less');
console.log('Goal planning tests passed.');
