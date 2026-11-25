import assert from 'node:assert/strict';
import { buildMealPhotoPrompt, itemGrams, itemNutrients, mergeMealItems, setNutrient, type MealItem } from '../src/lib/gemFood';
import { analyzeMealPhoto } from '../src/lib/mealAi';
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
// the real scan path (gemFood): the same checks on meal items
const P = { kcal: 200, protein: 10, carbs: 20, fat: 8, satFat: 2, sugar: 1, fiber: 2 };
const mi = (name: string, unit: string, unitGrams: number, count: number, includes?: string[]): MealItem => ({ id: name, name, unit, unitGrams, count, note: '', stated: false, per100: P, includes });
const m = mergeMealItems([mi('chicken biryani', 'g', 1, 300, ['rice', 'chicken']), mi('chicken pieces', 'g', 1, 150), mi('raita', 'katori', 120, 1), mi('roti', 'roti', 40, 1), mi('roti', 'roti', 40, 2)]);
assert.deepEqual(m.items.map((i) => i.name), ['chicken biryani', 'raita', 'roti']);
assert.equal(itemGrams(m.items[2]), 120, 'two entries of roti become one item of 3 rotis');
const photoPrompt = buildMealPhotoPrompt('chicken biryani with raita');
for (const w of ['STEP 1. SCALE', 'ONE ENTRY PER DISH', 'katori', 'chicken biryani', 'includes', 'chicken biryani with raita']) assert.ok(photoPrompt.includes(w), w);
let askedKey = '';
const fake = async (_k: string, _i: unknown, _s: object) => {
  askedKey = 'asked';
  return { meal: null, items: [
    { name: 'chicken biryani', unit: 'g', unit_grams: 1, count: 300, quantity_stated: false, note: '', includes: ['rice', 'chicken'], per100: { kcal: 180, protein: 9, carbs: 22, fat: 6, satFat: 2, sugar: 1, fiber: 1 } },
    { name: 'chicken pieces', unit: 'g', unit_grams: 1, count: 150, quantity_stated: false, note: '', per100: { kcal: 190, protein: 25, carbs: 0, fat: 9, satFat: 2, sugar: 0, fiber: 0 } },
  ] };
};
void (async () => {
  const scanned = await analyzeMealPhoto('k', 'b64', 'image/jpeg', fake);
  assert.equal(askedKey, 'asked');
  assert.deepEqual(scanned.items.map((i) => i.name), ['chicken biryani']);
  console.log('Plate tests passed.');
})();

// the person's own nutrition numbers, before adding to the diary
{
  const item = mi('dal', 'g', 1, 200);
  const edited = setNutrient(item, 'protein', 30);
  assert.equal(edited.per100.protein, 15, 'stored per 100 g');
  assert.equal(itemNutrients(edited).protein, 30, 'shows the number typed for this amount');
  assert.equal(itemNutrients(setNutrient(item, 'kcal', 333)).kcal, 333);
  assert.equal(setNutrient(mi('x', 'g', 1, 0), 'fat', 5).per100.fat, 8, 'no amount: nothing changes');
  assert.equal(setNutrient(item, 'fat', -1), item);
}
