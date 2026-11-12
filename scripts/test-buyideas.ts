import assert from 'node:assert/strict';
import { sameItem, BUILTIN_NAMES, BUY_CATEGORIES, buildMoreIdeasPrompt, buyIdeas, parseMoreIdeas } from '../src/lib/buyIdeas';
import { DEFAULT_EQUIPMENT } from '../src/lib/kitchenAi';

const base = { equipment: { ...DEFAULT_EQUIPMENT }, diet: 'any' as const, pantry: [], shopping: [] };
const names = (o: Parameters<typeof buyIdeas>[0]) => buyIdeas({ ...o, limit: 1000 }).map((x) => x.name);

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
assert.ok(buyIdeas({ ...base }).length >= 200, 'a wide list: basics, spices, sauces, snacks');
assert.ok(buyIdeas({ ...base, cat: 'spice' }).every((x) => x.cat === 'spice'));
assert.ok(buyIdeas({ ...base, cat: 'veg' }).some((x) => x.name === 'Onions') && buyIdeas({ ...base, cat: 'fruit' }).some((x) => x.name === 'Bananas'));
assert.ok(!names({ ...base, equipment: { ...base.equipment, fridge: false } }).includes('Spinach (palak)'), 'soft vegetables need a fridge');
assert.ok(names({ ...base, equipment: { ...base.equipment, fridge: false } }).includes('Onions'), 'hardy vegetables do not');

// ---- every group has things to suggest, and the groups people asked about are well stocked
for (const c of BUY_CATEGORIES) assert.ok(buyIdeas({ ...base, cat: c }).length >= 8, c + ' has ideas');
assert.ok(buyIdeas({ ...base, cat: 'spice' }).length >= 40, 'many spices and basics');
assert.ok(names(base).includes('Chaat masala') && names(base).includes('Soy sauce') && names(base).includes('Makhana (fox nuts)'));
assert.ok(buyIdeas({ ...base, diet: 'vegan', cat: 'dairy' }).every((x) => /milk|coconut|almond/i.test(x.name)), 'vegan dairy group keeps only plant milks');
assert.ok(names({ ...base, diet: 'vegan' }).includes('Almond milk'));
assert.ok(!names({ ...base, diet: 'veg' }).includes('Prawns') && !names({ ...base, diet: 'egg' }).includes('Mutton'));
assert.ok(!names({ ...base, diet: 'vegan' }).includes('Whey protein') && names({ ...base }).includes('Whey protein'));
assert.equal(new Set(BUILTIN_NAMES).size, BUILTIN_NAMES.length, 'no duplicate names');

// ---- Refresh ideas: the AI's list is cleaned
const ctx = { diet: 'veg' as const, pantry: [{ id: '1', name: 'Toor dal', qty: '' }], shopping: [{ name: 'Lemons' }], known: ['Onions'] };
const raw = { items: [
  { name: 'Sambar powder', category: 'spice' }, { name: 'Toor dal', category: 'staple' }, { name: 'onions', category: 'veg' }, { name: 'Lemons', category: 'veg' },
  { name: 'Chicken wings', category: 'protein' }, { name: 'Eggs', category: 'protein' }, { name: 'Eggplant', category: 'veg' }, { name: 'Drumstick leaves', category: 'weird' }, { name: 'x', category: 'veg' }, { name: 'Sambar powder', category: 'spice' },
] };
const got = parseMoreIdeas(raw, ctx);
assert.deepEqual(got.map((x) => x.name), ['Sambar powder', 'Eggplant', 'Drumstick leaves'], 'owned, listed, repeated, non-vegetarian and tiny names are dropped; eggplant is not an egg');
assert.equal(got[2].cat, 'staple', 'an unknown category falls back');
assert.ok(got.every((x) => x.why === 'pantry'));
assert.deepEqual(parseMoreIdeas({ items: [{ name: 'Eggs', category: 'protein' }, { name: 'Fish', category: 'protein' }] }, { ...ctx, diet: 'egg' as const }).map((x) => x.name), ['Eggs'], 'egg diet: eggs yes, fish no');
assert.deepEqual(parseMoreIdeas(null, ctx), []);
assert.deepEqual(parseMoreIdeas({ items: 'no' }, ctx), []);
assert.match(buildMoreIdeasPrompt({ equipment: base.equipment, diet: 'vegan', pantry: ctx.pantry, shopping: ctx.shopping, known: ['Onions'] }), /Toor dal[\s\S]*vegan[\s\S]*Onions/);

// ---- the same thing under another name is not new
assert.ok(sameItem('Curd', 'Curd (dahi)') && sameItem('Lemon', 'Lemons') && sameItem('Ghee', 'Butter or ghee') && sameItem('Cumin seeds', 'Cumin seeds (jeera)'));
assert.ok(!sameItem('Sambar powder', 'Rasam powder') && !sameItem('Rice', 'Poha') && !sameItem('', 'Salt'));
assert.deepEqual(parseMoreIdeas({ items: [{ name: 'Atta', category: 'staple' }, { name: 'Ghee', category: 'dairy' }, { name: 'Sambar powder', category: 'spice' }] }, { diet: 'any' as const, pantry: [], shopping: [], known: BUILTIN_NAMES }).map((x) => x.name), ['Sambar powder'].filter((n) => !BUILTIN_NAMES.some((k) => sameItem(k, n))), 'built-in items under another name are dropped');
console.log('Buy-idea tests passed.');
