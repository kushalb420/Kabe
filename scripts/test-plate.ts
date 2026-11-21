import assert from 'node:assert/strict';
import { PHOTO_MODELS, RawItem, buildPrompt, mergeDuplicates, parseResponse } from '../src/lib/photo';

const item = (name: string, grams: number, includes: string[] = []): RawItem => ({ name, databaseName: null, searchTerm: name, grams, confidence: 'medium', includes });
const names = (r: { items: RawItem[] }) => r.items.map((i) => i.name);

// the reported bug: biryani with its chicken listed again
let r = mergeDuplicates([item('Chicken biryani', 300), item('Chicken pieces', 150)]);
assert.deepEqual(names(r), ['Chicken biryani']);
assert.equal(r.items[0].grams, 300, 'the dish keeps its own weight; the ingredient is not added');
assert.ok(r.merged.length === 1);

// rice listed next to biryani is also part of it
r = mergeDuplicates([item('Chicken biryani', 320), item('Rice', 120), item('Raita', 100)]);
assert.deepEqual(names(r), ['Chicken biryani', 'Raita'], 'raita is a separate dish and stays');

// the model says what is inside
r = mergeDuplicates([item('Dum special', 300, ['rice', 'mutton']), item('Mutton', 100)]);
assert.deepEqual(names(r), ['Dum special']);

// the same food twice is added together
r = mergeDuplicates([item('Roti', 40), item('Roti', 40)]);
assert.equal(r.items.length, 1);
assert.equal(r.items[0].grams, 80);

// separate things on a plate are kept
r = mergeDuplicates([item('Dal tadka', 180), item('Roti x2', 70), item('Rice', 150), item('Chicken curry', 200)]);
assert.equal(r.items.length, 4);
assert.equal(r.merged.length, 0);
// a bigger ingredient is not swallowed by a smaller item
r = mergeDuplicates([item('Chicken', 200), item('Chicken biryani', 150)]);
assert.equal(r.items.length, 2, 'an item heavier than the dish is not treated as part of it');

// the full pipeline: parseResponse applies it and says so in the notes
const wrap = (o: unknown) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(o) }] }] });
const parsed = parseResponse(
  wrap({
    scale_reference: 'steel plate about 26 cm',
    items: [
      { name: 'Chicken biryani', includes: ['rice', 'chicken'], search_term: 'chicken biryani', grams: 300, confidence: 'medium' },
      { name: 'Chicken pieces', search_term: 'chicken', grams: 150, confidence: 'medium' },
    ],
    notes: 'ok',
  }),
);
assert.deepEqual(names(parsed), ['Chicken biryani']);
assert.ok(/Not counted twice/.test(parsed.notes));
assert.deepEqual(parsed.items[0].includes, ['rice', 'chicken']);

// the prompt now teaches scale and single entries, and the strongest model goes first
const p = buildPrompt(['Egg, boiled']);
for (const w of ['SCALE', 'katori', 'ONE ENTRY PER DISH', 'chicken biryani', 'scale_reference', 'includes']) assert.ok(p.includes(w), w);
assert.ok(PHOTO_MODELS[0] === 'gemini-3.5-flash');
console.log('Plate tests passed.');
