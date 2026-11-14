import assert from 'node:assert/strict';
import type { MealItem } from '../src/lib/gemFood';
import { applyPortions, foodKey, itemUtensil, learnPortions, sanitizePortions, utensilOf } from '../src/lib/portionMemory';

const per100 = { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, satFat: 0.1, sugar: 0, fiber: 0.4 };
const item = (name: string, o: Partial<MealItem> = {}): MealItem => ({ id: 'a', name, unit: 'katori', unitGrams: 150, count: 1, note: '', stated: false, per100, ...o });

assert.equal(utensilOf('a katori of rice'), 'katori');
assert.equal(utensilOf('one cup tea'), 'cup');
assert.equal(utensilOf('2 rotis'), null);
assert.equal(foodKey('Cooked Rice (white)'), 'rice');
assert.equal(foodKey('250 g Idlis'), 'idli');
assert.equal(foodKey('Grass'), 'grass', 'a double s is not a plural');

// the utensil comes from the AI note or from the clause that mentions the food
assert.equal(itemUtensil({ name: 'rice', note: 'about 1.5 katori' }, ''), 'katori');
assert.equal(itemUtensil({ name: 'dal', note: '' }, 'rice on a plate, dal in a small bowl'), 'katori');
assert.equal(itemUtensil({ name: 'rice', note: '' }, 'rice on a plate, dal in a small bowl'), 'plate');
assert.equal(itemUtensil({ name: 'curd', note: '' }, 'rice on a plate'), null);

// learning: one meal teaches, two meals are trusted, the average leans to recent ones
let mem = learnPortions({}, [{ item: { name: 'Rice', note: '' }, grams: 300 }], 'rice on a plate', 1000);
assert.deepEqual(mem['rice|plate'], { grams: 300, n: 1, at: 1000 });
const once = applyPortions(mem, [item('rice')], 'rice on a plate');
assert.equal(once[0].count, 1, 'one meal is not enough to override the estimate');
mem = learnPortions(mem, [{ item: { name: 'rice', note: '' }, grams: 200 }], 'rice on a plate', 2000);
assert.equal(mem['rice|plate'].n, 2);
assert.ok(mem['rice|plate'].grams > 200 && mem['rice|plate'].grams < 300);
const used = applyPortions(mem, [item('rice', { unit: 'g', unitGrams: 1, count: 180 })], 'rice on a plate');
assert.equal(used[0].count, mem['rice|plate'].grams, 'starts from the usual amount');
assert.match(used[0].note, /your usual/);
// an amount the person stated is never changed, and other utensils or foods are left alone
assert.equal(applyPortions(mem, [item('rice', { stated: true, count: 2 })], 'rice on a plate')[0].count, 2);
assert.equal(applyPortions(mem, [item('rice')], 'rice in a katori')[0].count, 1);
assert.equal(applyPortions(mem, [item('dal')], 'dal on a plate')[0].count, 1);
// nothing is learned without a utensil, or from nonsense grams
assert.deepEqual(learnPortions({}, [{ item: { name: 'rice', note: '' }, grams: 200 }], 'rice', 1), {});
assert.deepEqual(learnPortions({}, [{ item: { name: 'rice', note: 'katori' }, grams: 0 }], '', 1), {});
// memory stays small
let big = {};
for (let i = 0; i < 350; i++) big = learnPortions(big, [{ item: { name: `food${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, note: 'cup' }, grams: 100 }], '', i);
assert.equal(Object.keys(big).length, 300);
assert.deepEqual(sanitizePortions({ 'a|b': { grams: 5, n: 1, at: 1 }, bad: { grams: -1 }, 'c|d': 'x' }), { 'a|b': { grams: 5, n: 1, at: 1 } });
assert.deepEqual(sanitizePortions(null), {});
console.log('Portion memory tests passed.');
