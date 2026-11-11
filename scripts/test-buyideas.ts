import assert from 'node:assert/strict';
import { buyIdeas } from '../src/lib/buyIdeas';
import { DEFAULT_EQUIPMENT } from '../src/lib/kitchenAi';

const base = { equipment: { ...DEFAULT_EQUIPMENT }, diet: 'any' as const, pantry: [], shopping: [] };
const names = (o: Parameters<typeof buyIdeas>[0]) => buyIdeas({ ...o, limit: 100 }).map((x) => x.name);

assert.ok(names(base).includes('Milk'));
assert.ok(!names({ ...base, equipment: { ...base.equipment, fridge: false } }).includes('Milk'), 'no fridge -> nothing that needs one');
assert.ok(!names(base).includes('Whole-wheat bread'), 'no sandwich maker -> no bread for it');
assert.ok(names({ ...base, equipment: { ...base.equipment, sandwichMaker: true } }).includes('Whole-wheat bread'));
assert.ok(!names({ ...base, diet: 'veg' }).includes('Eggs'));
assert.ok(!names({ ...base, diet: 'vegan' }).includes('Milk'));
assert.ok(!names({ ...base, diet: 'egg' }).includes('Chicken breast'));
assert.ok(!names({ ...base, pantry: [{ id: '1', name: 'rice', qty: '' }] }).includes('Rice'), 'already in the pantry');
assert.ok(!names({ ...base, shopping: [{ name: 'Milk' }] }).includes('Milk'), 'already on the list');
assert.equal(buyIdeas({ ...base, limit: 12 }).length, 12);
assert.ok(buyIdeas({ ...base }).length >= 60 && buyIdeas({ ...base }).length <= 100, 'up to 100 ideas');
assert.ok(buyIdeas({ ...base, cat: 'spice' }).every((x) => x.cat === 'spice'));
assert.ok(buyIdeas({ ...base, cat: 'veg' }).some((x) => x.name === 'Onions') && buyIdeas({ ...base, cat: 'fruit' }).some((x) => x.name === 'Bananas'));
assert.ok(!names({ ...base, equipment: { ...base.equipment, fridge: false } }).includes('Spinach (palak)'), 'soft vegetables need a fridge');
assert.ok(names({ ...base, equipment: { ...base.equipment, fridge: false } }).includes('Onions'), 'hardy vegetables do not');
console.log('Buy-idea tests passed.');
