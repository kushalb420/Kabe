import assert from 'node:assert/strict';
import type { Food } from '../src/data/foods';
import { DEFAULT_PORTION_G, MenuItem, RESTAURANT_MIN_UNCERTAINTY, allowedByDiet, buildMenuPrompt, dishUncertainty, forDishes, isRawIngredient, buildMenuRequest, dishToItem, dishesFromText, mealBudget, orderName, orderTotals, parseMenuResponse, rankMenu, tagFor, toSavedItems, typicalPortionG } from '../src/lib/menu';

const reply = (obj: unknown) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(obj) }] }] });
const food = (id: string, kcal: number, protein: number): Food => ({ id, name: id, category: 'x', kcal, protein, carbs: 10, fat: 5, servingG: 100, servingLabel: '100 g' });

// ---- the AI is told to read names only, never to produce nutrition ----
const prompt = buildMenuPrompt();
assert.match(prompt, /Only calories per serving are wanted/);
assert.ok(!/"calories"|kcal:/i.test(JSON.stringify(buildMenuRequest('m', 'AAAA', 'image/jpeg').response_format)), 'schema has no calorie field');
const req = buildMenuRequest('gemini-x', 'AAAA', 'image/png');
assert.equal(req.model, 'gemini-x');
assert.equal((req.input[1] as { mime_type: string }).mime_type, 'image/png');

// ---- parsing the model's answer ----
const ok = parseMenuResponse(
  reply({
    restaurant: ' Spice Hub ',
    dishes: [
      { name: 'Paneer Butter Masala', search_term: 'paneer butter masala', grams: 280, veg: 'veg', price: 320, confidence: 'high' },
      { name: 'Butter Naan', search_term: 'naan', grams: 90, veg: 'veg', price: 60.5, confidence: 'medium' },
      { name: 'paneer butter masala', search_term: 'dup', grams: 100 }, // duplicate (case-insensitive) dropped
      { name: 'Mystery', search_term: '', grams: 'lots', veg: 'tasty', price: -5 }, // bad values fall back, never trusted
      { name: '', search_term: 'x', grams: 100 }, // no name → dropped
      { name: 'Huge', search_term: 'huge', grams: 99999 }, // absurd serving → typical serving, low confidence
    ],
  }),
);
assert.equal(ok.restaurant, 'Spice Hub');
assert.deepEqual(ok.dishes.map((d) => d.name), ['Paneer Butter Masala', 'Butter Naan', 'Mystery', 'Huge']);
assert.equal(ok.dishes[0].grams, 280);
assert.equal(ok.dishes[0].confidence, 'high');
assert.equal(ok.dishes[1].price, 60.5);
const mystery = ok.dishes[2];
assert.equal(mystery.grams, DEFAULT_PORTION_G);
assert.equal(mystery.confidence, 'low');
assert.equal(mystery.veg, 'unknown');
assert.equal(mystery.price, null);
assert.equal(mystery.searchTerm, 'Mystery', 'empty search term falls back to the name');
assert.equal(ok.dishes[3].grams, DEFAULT_PORTION_G);
assert.equal(ok.dishes[3].confidence, 'low');
assert.deepEqual(parseMenuResponse(reply({ dishes: [] })).dishes, []);
assert.equal(parseMenuResponse(reply({ dishes: [] })).restaurant, '');
assert.equal(parseMenuResponse(reply({ restaurant: null, dishes: [{ name: 'A', search_term: 'a', grams: 100 }] })).restaurant, '');
assert.throws(() => parseMenuResponse(reply({ nope: 1 })), /missing the dish list/);
assert.throws(() => parseMenuResponse({ status: 'failed', steps: [] }), /did not finish/);
assert.throws(() => parseMenuResponse({ status: 'completed', steps: [] }), /no answer/);
assert.throws(() => parseMenuResponse({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'not json' }] }] }), /not valid JSON/);
assert.throws(() => parseMenuResponse(null), /unreadable/);
const fenced = parseMenuResponse({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '```json\n{"dishes":[{"name":"Dosa","search_term":"dosa","grams":120}]}\n```' }] }] });
assert.equal(fenced.dishes[0].name, 'Dosa');
const many = parseMenuResponse(reply({ dishes: Array.from({ length: 200 }, (_, i) => ({ name: `Dish ${i}`, search_term: 'd', grams: 100 })) }));
assert.equal(many.dishes.length, 60, 'a menu is capped');

// ---- typing what you ordered ----
assert.equal(typicalPortionG('butter chicken'), DEFAULT_PORTION_G);
assert.equal(typicalPortionG('Garlic Naan'), 80);
assert.equal(typicalPortionG('Chicken Biryani'), 320);
assert.equal(typicalPortionG('Mango Lassi'), 250);
assert.equal(typicalPortionG('Gulab Jamun'), 110);
assert.equal(typicalPortionG('रोटी'), 80, 'Hindi script works');
const typed = dishesFromText('2 naan, butter chicken; mango lassi\n3x idli & sambar');
assert.deepEqual(typed.map((d) => d.name), ['naan', 'butter chicken', 'mango lassi', 'idli', 'sambar']);
assert.deepEqual(typed.map((d) => d.grams), [160, 250, 250, 240, 250]);
assert.ok(typed.every((d) => d.confidence === 'low' && d.veg === 'unknown' && d.price === null));
assert.equal(dishesFromText('100 naan')[0].grams, 80 * 20, 'quantity is capped at 20');
assert.deepEqual(dishesFromText('  ,  ;  \n'), []);
assert.deepEqual(dishesFromText('a'), [], 'one-letter lines are ignored');
assert.equal(dishesFromText('0 naan')[0].grams, 40, 'zero becomes half a serving, never a zero-gram dish');

// ---- items ----
const dish = ok.dishes[0];
const base = dishToItem(dish, 'x1');
assert.equal(base.lookup, undefined);
assert.equal(base.picked, false);
assert.equal(base.confidence, 'medium', 'a restaurant serving is never "high" confidence');
assert.equal(dishToItem({ ...dish, confidence: 'low' }, 'x').confidence, 'low');
const withFood = (id: string, f: Food | null, over: Partial<MenuItem> = {}): MenuItem => ({ ...dishToItem({ ...dish, name: id, searchTerm: id, grams: 100 }, id), food: f, lookup: undefined, ...over });

// ---- diets ----
assert.ok(allowedByDiet('nonveg', 'any') && allowedByDiet('egg', 'any'));
assert.ok(allowedByDiet('veg', 'veg') && allowedByDiet('unknown', 'veg'));
assert.ok(!allowedByDiet('nonveg', 'veg') && !allowedByDiet('egg', 'veg'));
assert.ok(allowedByDiet('egg', 'egg') && allowedByDiet('veg', 'egg') && !allowedByDiet('nonveg', 'egg'));

// ---- ranking ----
assert.equal(tagFor({ kcal: 500, protein: 40, carbs: 20, fat: 15 }, 600), 'highProtein');
assert.equal(tagFor({ kcal: 200, protein: 5, carbs: 20, fat: 15 }, 600), 'light');
assert.equal(tagFor({ kcal: 900, protein: 20, carbs: 80, fat: 50 }, 600), 'heavy');
assert.equal(tagFor({ kcal: 500, protein: 10, carbs: 60, fat: 20 }, 600), 'fits');
const items: MenuItem[] = [
  withFood('heavy-fry', food('a', 300, 5), { grams: 300 }), // 900 kcal
  withFood('grilled-chicken', food('b', 160, 31), { grams: 300 }), // 480 kcal, 93 g protein
  withFood('plain-rice', food('c', 130, 3), { grams: 400 }), // 520 kcal, low protein
  withFood('mystery', null),
  withFood('lamb', food('d', 200, 20), { veg: 'nonveg', grams: 250 }),
];
const ranked = rankMenu(items, 600);
assert.equal(ranked[0].item.name, 'grilled-chicken', 'high-protein dish near the target comes first');
assert.equal(ranked[0].tag, 'highProtein');
assert.equal(ranked[ranked.length - 1].item.name, 'mystery', 'a dish without numbers goes last');
assert.equal(ranked[ranked.length - 1].tag, 'noData');
assert.ok(ranked.findIndex((r) => r.item.name === 'heavy-fry') > ranked.findIndex((r) => r.item.name === 'plain-rice'), 'a dish far over the target ranks below one near it');
assert.equal(ranked.find((r) => r.item.name === 'heavy-fry')!.tag, 'heavy');
assert.ok(!rankMenu(items, 600, 'veg').some((r) => r.item.name === 'lamb'), 'veg filter hides meat dishes');
assert.equal(rankMenu(items, 600, 'veg').length, 4);
assert.equal(rankMenu([], 600).length, 0);
assert.deepEqual(rankMenu([withFood('m1', null), withFood('m2', null)], 600).map((r) => r.item.name), ['m1', 'm2'], 'dishes without data keep menu order');
// hand-typed numbers win over database values in ranking
const edited = withFood('edited', food('e', 500, 1), { grams: 100, manual: { kcal: 400, protein: 38, carbs: 10, fat: 8 } });
assert.equal(rankMenu([edited], 600)[0].tag, 'highProtein');
// a tiny target is raised so a normal dish is not always "heavy"
assert.notEqual(rankMenu([withFood('x', food('x', 150, 10), { grams: 200 })], 0)[0].tag, 'heavy');

assert.equal(mealBudget(1500, 3), 500);
assert.equal(mealBudget(1500, 1), 900, 'one meal is never ranked against more than 900 kcal');
assert.equal(mealBudget(700, 1), 700);
assert.equal(mealBudget(1500, 0), 900, 'at least one meal');
assert.equal(mealBudget(1500, 9), 500, 'at most three meals');
assert.equal(mealBudget(-200, 2), 0);

// ---- the order ----
const picked = [
  withFood('p1', food('a', 200, 10), { grams: 100, picked: true, price: 250 }),
  withFood('p2', food('b', 100, 5), { grams: 200, picked: true, price: null }),
  withFood('p3', null, { picked: true, price: null }),
  withFood('p4', food('c', 999, 99), { picked: false, price: 999 }),
];
const tot = orderTotals(picked);
assert.equal(tot.dishes, 3);
assert.equal(tot.missing, 1);
assert.equal(tot.kcal, 400);
assert.equal(tot.protein, 20);
assert.equal(tot.price, 250);
assert.equal(tot.unpriced, 2);
assert.ok(tot.kcalLow < tot.kcal && tot.kcalHigh > tot.kcal, 'always a range');
assert.ok(tot.kcalLow > 0);
assert.equal(orderTotals([]).dishes, 0);
const saved = toSavedItems(picked);
assert.equal(saved.length, 2, 'only dishes with numbers can be saved');
assert.deepEqual(saved.map((s) => s.source), ['restaurant', 'restaurant']);
assert.equal(saved[0].kcal, 200);
assert.equal(saved[1].grams, 200);
assert.equal(orderName('Spice Hub', picked, 'Order'), 'Spice Hub · p1 +2');
assert.equal(orderName('', picked, 'Order'), 'p1 +2');
assert.equal(orderName('  ', [withFood('only', null, { picked: true })], 'Order'), 'only');
assert.equal(orderName('', [], 'Order'), 'Order');

// ---- a dish is never matched to a DRY ingredient (that made dal look 3x too heavy) ----
for (const bad of ['Lentils, raw', 'Wheat flour, whole grain', 'Rice, white, uncooked', 'Chickpeas, dried', 'Milk powder', 'Protein powder', 'Pancake mix', 'Sesame seeds']) assert.ok(isRawIngredient({ name: bad }), bad);
for (const good of ['Dal', 'Lentils, cooked', 'Rice, cooked, NFS', 'Chicken fillet, grilled', 'Biryani with chicken', 'Bread, naan', 'Yogurt, NFS', 'Chickpeas, boiled', 'Beans, dry, cooked']) assert.ok(!isRawIngredient({ name: good }), good);
(async () => {
  const search = forDishes(async () => [food('Lentils, raw', 352, 25), food('Dal', 145, 7), food('Wheat flour', 360, 12)].map((f) => ({ ...f, name: f.id })));
  assert.deepEqual((await search('dal')).map((f) => f.name), ['Dal'], 'only the cooked dish survives');
  // restaurant dishes are never more certain than ±35%; hand-typed numbers are the exception
  const sure = withFood('sure', food('s', 100, 5), { confidence: 'high' });
  assert.equal(dishUncertainty(sure), RESTAURANT_MIN_UNCERTAINTY);
  assert.ok(dishUncertainty(withFood('ai', { ...food('ai', 100, 5), source: 'ai' as const }, { confidence: 'high' })) >= 0.5, 'AI estimates stay wide');
  assert.equal(dishUncertainty(withFood('mine', food('m', 100, 5), { manual: { kcal: 100, protein: 5, carbs: 10, fat: 2 } })), 0.1);
  const one = orderTotals([withFood('one', food('o', 100, 5), { grams: 200, picked: true, confidence: 'high' })]);
  assert.ok(Math.abs(one.kcalLow - 200 * (1 - RESTAURANT_MIN_UNCERTAINTY)) < 1e-9 && Math.abs(one.kcalHigh - 200 * (1 + RESTAURANT_MIN_UNCERTAINTY)) < 1e-9);
  console.log('Menu tests passed.');
})();

// ---- instant ranking by the calories of one basic serving ----
import { rankByCalories, cleanKcal } from '../src/lib/menu';
{
  const q = (name: string, kcal: number | null, over: Partial<MenuItem> = {}) => ({ ...dishToItem({ ...dish, name, searchTerm: name, kcal }, name), ...over });
  const list = [q('heavy', 900), q('none', null), q('light', 150), q('mid', 400, { veg: 'nonveg' })];
  assert.deepEqual(rankByCalories(list, 600).map((r) => r.item.name), ['light', 'mid', 'heavy', 'none'], 'lightest first, unknown last');
  assert.deepEqual(rankByCalories(list, 600, 'any', true).map((r) => r.item.name), ['heavy', 'mid', 'light', 'none']);
  assert.ok(!rankByCalories(list, 600, 'veg').some((r) => r.item.name === 'mid'), 'diet filter still applies');
  assert.equal(rankByCalories(list, 600)[0].tag, 'light');
  assert.equal(rankByCalories(list, 600)[2].tag, 'heavy');
  assert.equal(cleanKcal(5), null);
  assert.equal(cleanKcal(99999), null);
  assert.equal(cleanKcal(451.4), 451);
  assert.equal(cleanKcal('x'), null);
  console.log('Instant ranking tests passed.');
}
