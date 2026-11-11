import assert from 'node:assert/strict';
import { applyFilling, extrasOf, nameKey, needsFilling } from '../src/lib/enrich';

assert.equal(nameKey('  Roti  '), 'roti');
assert.equal(nameKey('Toor   DAL'), 'toor dal');

const e = (id: string, name: string, grams: number, date: string, extra: { sugar?: number; satFat?: number } = {}) => ({ id, name, grams, date, ...extra });
const list = [
  e('1', 'Roti', 80, '2026-11-08'),
  e('2', 'roti', 40, '2026-11-09'), // same food, newer
  e('3', 'Dal', 150, '2026-11-09', { sugar: 0.3, satFat: 1 }), // complete: left alone
  e('4', 'Paneer', 100, '2026-11-07', { sugar: 1 }), // only one of two
  e('5', 'Water', 0, '2026-11-09'), // no grams
  e('6', 'Curd', 100, '2026-11-06'),
];
assert.deepEqual(needsFilling(list, {}, new Set()), ['roti', 'Paneer', 'Curd'], 'newest first, one per food, complete and zero-gram entries skipped');
assert.deepEqual(needsFilling(list, {}, new Set(), 2), ['roti', 'Paneer'], 'a small batch each time');
assert.deepEqual(needsFilling(list, { roti: { sugar: 0, satFat: 0.5 } }, new Set()), ['Paneer', 'Curd'], 'known foods are not asked again');
assert.deepEqual(needsFilling(list, { roti: null }, new Set()), ['Paneer', 'Curd'], 'a food that could not be looked up is not retried');
assert.deepEqual(needsFilling(list, {}, new Set(['paneer'])), ['roti', 'Curd'], 'foods tried this session are skipped');

const known = { roti: { sugar: 0.5, satFat: 1.1 }, paneer: { sugar: 1.2, satFat: 14 } };
const filled = applyFilling(list, known);
assert.equal(filled[0].sugar, 0.4, '80 g of roti');
assert.equal(filled[0].satFat, 0.9);
assert.equal(filled[1].satFat, 0.4);
assert.equal(filled[2], list[2], 'a complete entry is the very same object');
assert.equal(filled[3].sugar, 1, 'a number already there is never replaced');
assert.equal(filled[3].satFat, 14, 'but the missing one is filled');
assert.equal(filled[4].satFat, undefined, 'no grams, nothing to scale');
assert.equal(filled[5].satFat, undefined, 'unknown food stays unknown');
assert.equal(applyFilling(list, {}), list, 'nothing to apply returns the same array');
assert.equal(applyFilling(list, { roti: null }), list, 'a failed lookup changes nothing');

assert.deepEqual(extrasOf({ id: 'x', name: 'x', category: 'x', kcal: 1, protein: 0, carbs: 0, fat: 0, servingG: 100, servingLabel: '100 g', sugar: 2, satFat: 3 }), { sugar: 2, satFat: 3 });
assert.deepEqual(extrasOf({ id: 'x', name: 'x', category: 'x', kcal: 1, protein: 0, carbs: 0, fat: 0, servingG: 100, servingLabel: '100 g' }), { sugar: 0, satFat: 0 }, 'a food with none is zero');
assert.equal(extrasOf(null), null);

console.log('Enrich tests passed.');
