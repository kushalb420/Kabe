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
