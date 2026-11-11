import assert from 'node:assert/strict';
import { foodsFromEntries, searchMine } from '../src/lib/myFoods';

const e = (id: string, date: string, name: string, grams: number, kcal: number, extra: object = {}) => ({ id, date, name, grams, kcal, protein: kcal / 20, carbs: kcal / 8, fat: kcal / 40, ...extra });
const foods = foodsFromEntries([
  e('1', '2026-11-08', 'Roti', 80, 238, { satFat: 0.9, sugar: 0.4, fiber: 4 }),
  e('2', '2026-11-09', 'roti', 40, 120),
  e('3', '2026-11-07', 'Dal', 150, 135, { foodId: 'gem-dal' }),
  e('4', '2026-11-09', 'Water', 0, 0),
  e('5', '2026-11-06', 'Paneer butter masala', 200, 380),
  e('6', '2026-11-05', '   ', 100, 50),
]);
assert.deepEqual(foods.map((f) => f.name), ['roti', 'Dal', 'Paneer butter masala'], 'one per food, newest first; empty names and zero grams skipped');
assert.equal(foods[0].kcal, 300, 'per 100 g from the latest log (120 kcal for 40 g)');
assert.equal(foods[0].servingG, 40, "the serving is the latest amount");
assert.equal(foods[0].satFat, undefined, 'unknown stays unknown, never zero');
assert.equal(foods[1].id, 'gem-dal', 'a known food id is kept');
assert.equal(foods[2].protein, 9.5);
assert.deepEqual(foodsFromEntries([]), []);
const withExtras = foodsFromEntries([e('9', '2026-11-09', 'Idli', 100, 150, { satFat: 0.3, sugar: 0.1, fiber: 2 })])[0];
assert.deepEqual([withExtras.satFat, withExtras.sugar, withExtras.fiber], [0.3, 0.1, 2]);

assert.deepEqual(searchMine(foods, '').length, 3, 'empty search shows everything');
assert.deepEqual(searchMine(foods, 'pan').map((f) => f.name), ['Paneer butter masala'], 'prefix of a word');
assert.deepEqual(searchMine(foods, 'butter pan').map((f) => f.name), ['Paneer butter masala'], 'every word must match, in any order');
assert.deepEqual(searchMine(foods, 'ROT').map((f) => f.name), ['roti'], 'case does not matter');
assert.deepEqual(searchMine(foods, 'xyz'), [], 'nothing matches');
console.log('My foods tests passed.');

// ---- a saved meal's item kept as a food on its own
import { foodFromMealItem } from '../src/lib/myFoods';
{
  const f = foodFromMealItem({ name: 'Curd', grams: 150, kcal: 90, protein: 5, carbs: 7, fat: 5 })!;
  assert.equal(f.kcal, 60, 'per 100 g');
  assert.equal(f.servingG, 150);
  assert.equal(foodFromMealItem({ name: 'x', grams: 0, kcal: 1, protein: 0, carbs: 0, fat: 0 }), null);
  assert.equal(foodFromMealItem({ name: 'Curd', grams: 100, kcal: 1, protein: 0, carbs: 0, fat: 0, foodId: 'gem-curd' })!.id, 'gem-curd');
}
