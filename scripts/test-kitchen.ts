import assert from 'node:assert/strict';
import { DEFAULT_EQUIPMENT, EQUIPMENT_IDS, buildChatPrompt, buildSuggestPrompt, cleanServing, inPantry, isStaple, missing, missingNames, parseAnswer, parseDetail, parsePantryPhoto, parseSuggestions, sanitizeEquipment, suggestionToFood } from '../src/lib/kitchenAi';

const pantry = [
  { id: '1', name: 'Tomatoes', qty: '4' },
  { id: '2', name: 'Toor dal', qty: '500 g' },
  { id: '3', name: 'Eggs', qty: '6' },
  { id: '4', name: 'Rice', qty: '1 kg' },
];

// ---- equipment ----
assert.deepEqual(sanitizeEquipment(null), DEFAULT_EQUIPMENT);
assert.equal(sanitizeEquipment({ oven: true, stove: false, fridge: 'yes' }).oven, true);
assert.equal(sanitizeEquipment({ stove: false }).stove, false);
assert.equal(sanitizeEquipment({ fridge: 'yes' }).fridge, DEFAULT_EQUIPMENT.fridge, 'only real true/false counts');
assert.equal(Object.keys(sanitizeEquipment({})).length, EQUIPMENT_IDS.length);

// ---- what you have ----
assert.ok(inPantry('tomato', pantry), 'singular matches plural');
assert.ok(inPantry('dal', pantry), 'a part of the name matches');
assert.ok(inPantry('egg', pantry));
assert.ok(!inPantry('paneer', pantry));
assert.ok(!inPantry('', pantry));
assert.ok(isStaple('Salt') && isStaple(' water ') && !isStaple('paneer'));

// ---- numbers for one serving ----
assert.deepEqual(cleanServing({ kcal: 420, protein: 18, carbs: 55, fat: 14, saturated_fat: 4, free_sugar: 3, fiber: 8 }), { kcal: 420, protein: 18, carbs: 55, fat: 14, satFat: 4, sugar: 3, fiber: 8 });
assert.equal(cleanServing({ kcal: 2000, protein: 18, carbs: 55, fat: 14 })!.kcal, Math.round(72 + 220 + 126 - 0), 'calories that contradict the macros are corrected');
assert.equal(cleanServing({ kcal: 400, protein: 18, carbs: 55, fat: 14, saturated_fat: 30 })!.satFat, 14, 'saturated fat never above fat');
assert.equal(cleanServing({ kcal: 400, protein: 999, carbs: 5, fat: 1 }), null, 'impossible');
assert.equal(cleanServing({ kcal: 'x' }), null);
assert.equal(cleanServing(null), null);

// ---- suggestions ----
const eq = { ...DEFAULT_EQUIPMENT };
const opt = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  meal: 'lunch',
  minutes: 25,
  serving_grams: 300,
  nutrition: { kcal: 400, protein: 15, carbs: 55, fat: 12, saturated_fat: 3, free_sugar: 2, fiber: 6 },
  ingredients: [{ name: 'Toor dal', have: true, optional: false }, { name: 'Tomato', have: true, optional: false }, { name: 'Salt', have: true, optional: false }],
  equipment: ['stove'],
  why: 'Uses your dal.',
  ...extra,
});
const raw = {
  options: [
    opt('Dal tadka'),
    opt('Paneer curry', { ingredients: [{ name: 'Paneer', have: true, optional: false }, { name: 'Tomato', have: true, optional: false }, { name: 'Cream', have: false, optional: true }] }),
    opt('Baked dish', { equipment: ['oven'] }),
    opt('Dal tadka'),
    opt('Bad numbers', { nutrition: { kcal: 5, protein: 900, carbs: 1, fat: 1 } }),
    opt('No ingredients', { ingredients: [] }),
    opt('Egg rice', { ingredients: [{ name: 'Eggs', have: false, optional: false }, { name: 'Rice', have: true, optional: false }] }),
  ],
  buy: [{ item: 'Paneer', unlocks: ['Palak paneer', 'Paneer bhurji', 'Matar paneer', 'Extra'] }, { item: 'Tomatoes', unlocks: ['x'] }, { item: 'Salt', unlocks: ['x'] }, { item: '', unlocks: [] }],
};
const res = parseSuggestions(raw, { pantry, equipment: eq, remaining: null });
assert.deepEqual(res.options.map((o) => o.name).sort(), ['Dal tadka', 'Egg rice', 'Paneer curry'], 'oven dish dropped (no oven), duplicate, bad numbers and empty ingredients dropped');
const paneer = res.options.find((o) => o.name === 'Paneer curry')!;
assert.equal(paneer.uses.find((u) => u.name === 'Paneer')!.have, false, 'the AI said it was in the pantry, but it is not: the app corrects it');
assert.equal(paneer.uses.find((u) => u.name === 'Tomato')!.have, true);
assert.equal(paneer.uses.find((u) => u.name === 'Cream')!.optional, true);
assert.deepEqual(missingNames(paneer), ['Paneer'], 'optional ingredients are not "missing"');
const egg = res.options.find((o) => o.name === 'Egg rice')!;
assert.equal(egg.uses.find((u) => u.name === 'Eggs')!.have, true, 'you do have eggs even if the AI said not');
assert.equal(res.options[0].name, 'Dal tadka', 'dishes you can already make come first');
assert.equal(missing(res.options[0]), 0);
assert.ok(res.options.every((o) => o.minutes > 0 && o.servingG >= 30));
assert.deepEqual(res.buy.map((b) => b.item), ['Paneer'], 'buy ideas exclude what you have and staples');
assert.equal(res.buy[0].unlocks.length, 3, 'at most three examples');
assert.deepEqual(parseSuggestions(null, { pantry, equipment: eq, remaining: null }), { options: [], buy: [] });
// an oven owner can get the baked dish
assert.ok(parseSuggestions(raw, { pantry, equipment: { ...eq, oven: true }, remaining: null }).options.some((o) => o.name === 'Baked dish'));
// fit my remaining calories
const fit = parseSuggestions({ options: [opt('Light', { nutrition: { kcal: 250, protein: 10, carbs: 30, fat: 9, saturated_fat: 2, free_sugar: 1, fiber: 4 } }), opt('Heavy', { nutrition: { kcal: 700, protein: 25, carbs: 80, fat: 28, saturated_fat: 8, free_sugar: 2, fiber: 6 } })], buy: [] }, { pantry, equipment: eq, remaining: { kcal: 400, protein: 30 } });
assert.deepEqual(fit.options.map((o) => o.name), ['Light'], 'only dishes that fit what is left');

// ---- prompts ----
const prompt = buildSuggestPrompt({ pantry, equipment: { ...eq, oven: false, fridge: false }, diet: 'veg', meal: 'dinner', maxMinutes: 30, remaining: { kcal: 650, protein: 40 }, wish: 'something spicy', language: null });
assert.ok(prompt.includes('Tomatoes (4)') && prompt.includes('They do NOT have:') && prompt.includes('oven') && prompt.includes('refrigeration'));
assert.ok(prompt.includes('650 kcal') && prompt.includes('at most 30 minutes') && prompt.includes('vegetarian') && prompt.includes('something spicy'));
assert.ok(prompt.includes('still suggest it'), 'small amounts or missing ingredients do not drop a dish');
assert.ok(buildSuggestPrompt({ pantry: [], equipment: eq, diet: 'any', meal: 'any', maxMinutes: null, remaining: null, wish: '' }).includes('nothing listed'));

// ---- details, chat, photo ----
const d = parseDetail({ ingredients: [{ name: 'Toor dal', amount: '1/4 cup' }, { name: '', amount: 'x' }], steps: ['Wash the dal.', '  ', 'Boil.'], tips: ['Soak first.'], swaps: ['Masoor dal works.'] })!;
assert.equal(d.ingredients.length, 1);
assert.deepEqual(d.steps, ['Wash the dal.', 'Boil.']);
assert.equal(parseDetail({ ingredients: [], steps: ['x'] }), null);
assert.equal(parseDetail({ ingredients: [{ name: 'a', amount: '1' }], steps: [] }), null);
assert.equal(parseAnswer({ answer: '  Use less water.  ' }), 'Use less water.');
assert.equal(parseAnswer({ answer: '' }), null);
const chat = buildChatPrompt(res.options[0], d, [{ role: 'user', text: 'hi' }], 'Can I use masoor dal?');
assert.ok(chat.includes('Dal tadka') && chat.includes('masoor dal') && chat.includes('Earlier:'));
const photo = parsePantryPhoto({ items: [{ name: 'Onion', qty: '3' }, { name: 'tomato', qty: '2' }, { name: 'Onion', qty: '1' }, { name: '', qty: '' }] }, pantry);
assert.deepEqual(photo, [{ name: 'Onion', qty: '3' }], 'duplicates and things already in the pantry are skipped');

// ---- logging a dish ----
const food = suggestionToFood({ ...res.options[0], servingG: 250, nutrition: { kcal: 500, protein: 20, carbs: 60, fat: 15, satFat: 5, sugar: 4, fiber: 10 } });
assert.equal(food.kcal, 200);
assert.equal(food.protein, 8);
assert.equal(food.satFat, 2);
assert.equal(food.servingG, 250);
console.log('Kitchen tests passed.');

// ---- fit my remaining calories: the day's leftovers are split over the meals still to eat
import { mealsLeftFor, perMealShare } from '../src/lib/kitchenAi';
{
  assert.equal(mealsLeftFor('breakfast', 8), 3);
  assert.equal(mealsLeftFor('lunch', 13), 2);
  assert.equal(mealsLeftFor('dinner', 20), 1);
  assert.equal(mealsLeftFor('snack', 11), 2);
  assert.equal(mealsLeftFor('snack', 18), 1);
  const lunch = perMealShare({ kcal: 1200, protein: 90 }, 2);
  assert.equal(lunch.kcal, 600);
  assert.equal(lunch.protein, 45);
  assert.equal(lunch.dayKcal, 1200);
  assert.equal(perMealShare({ kcal: 500, protein: 30 }, 1).kcal, 500, 'the last meal may use everything that is left');
  assert.equal(perMealShare({ kcal: 500, protein: 30 }, 0).mealsLeft, 1);
  const p = buildSuggestPrompt({ pantry, equipment: eq, diet: 'any', meal: 'lunch', maxMinutes: null, remaining: lunch, wish: '' });
  assert.match(p, /2 meals are still to eat/);
  assert.match(p, /about 600 kcal/);
  const last = buildSuggestPrompt({ pantry, equipment: eq, diet: 'any', meal: 'dinner', maxMinutes: null, remaining: perMealShare({ kcal: 500, protein: 30 }, 1), wish: '' });
  assert.match(last, /last meal/);
  console.log('Meal split tests passed.');
}
