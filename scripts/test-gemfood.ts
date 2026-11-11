import assert from 'node:assert/strict';
import { MealItem, amountsStated, cleanPer100, hasAmount, withStatedAmounts, itemGrams, itemNutrients, mealTotals, parseFood, parseMeal, setCount, setGrams, stepFor } from '../src/lib/gemFood';
import { analyzeMealPhoto, analyzeMealText, lookupFood } from '../src/lib/mealAi';

const good = { kcal: 170, protein: 6, carbs: 28, fat: 3.5, saturated_fat: 1, free_sugar: 0.5, fiber: 4 };

// ---- one food's numbers are made trustworthy ----
assert.deepEqual(cleanPer100(good), { kcal: 170, protein: 6, carbs: 28, fat: 3.5, satFat: 1, sugar: 0.5, fiber: 4 });
assert.equal(cleanPer100({ ...good, kcal: 900 })!.kcal, Math.round(4 * 6 + 4 * 28 + 9 * 3.5 - 8), 'calories that contradict the macros are replaced by what the macros give');
assert.equal(cleanPer100({ ...good, kcal: 175 })!.kcal, 175, 'a small difference is left alone');
assert.equal(cleanPer100({ ...good, saturated_fat: 9 })!.satFat, 3.5, 'saturated fat can never exceed total fat');
assert.equal(cleanPer100({ ...good, free_sugar: 90 })!.sugar, 28, 'free sugar can never exceed carbs');
assert.equal(cleanPer100({ ...good, fiber: 90 })!.fiber, 28, 'fibre can never exceed carbs');
assert.equal(cleanPer100({ ...good, protein: 60, carbs: 60 }), null, 'more than 100 g of nutrients in 100 g is impossible');
assert.equal(cleanPer100({ ...good, protein: -1 }), null);
assert.equal(cleanPer100({ ...good, kcal: 'many' }), null);
assert.equal(cleanPer100(null), null);
assert.equal(cleanPer100({ kcal: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0, free_sugar: 0, fiber: 0 })!.kcal, 0, 'water has no calories');
assert.deepEqual(cleanPer100({ kcal: 100, protein: 5, carbs: 10, fat: 4 }), { kcal: 100, protein: 5, carbs: 10, fat: 4, satFat: 0, sugar: 0, fiber: 0 }, 'missing small parts count as zero');

// ---- a meal from the AI ----
const roti = { name: 'Roti', unit: 'roti', unit_grams: 40, count: 2, quantity_stated: true, per100: { kcal: 297, protein: 9.8, carbs: 55, fat: 4.5, saturated_fat: 1.1, free_sugar: 0.5, fiber: 5 } };
const dal = { name: 'Toor dal', unit: 'katori', unit_grams: 150, count: 1, quantity_stated: false, per100: { kcal: 104, protein: 6, carbs: 14, fat: 3, saturated_fat: 0.8, free_sugar: 0.3, fiber: 3 } };
const meal = parseMeal({ meal: 'lunch', items: [roti, dal, { name: '', unit: 'g' }, { ...roti, name: 'Ghost', unit_grams: 0 }, { ...roti, name: 'Huge', count: 400 }, { ...roti, name: 'Bad', per100: { kcal: 1 } }] });
assert.equal(meal.meal, 'lunch');
assert.deepEqual(meal.items.map((i) => i.name), ['Roti', 'Toor dal'], 'broken items are dropped');
assert.equal(meal.items[0].stated, true);
assert.equal(meal.items[1].stated, false);
assert.equal(parseMeal({ items: 'no' }).items.length, 0);
assert.equal(parseMeal({ meal: 'brunch', items: [] }).meal, null);

// ---- amounts and totals ----
const [r, d] = meal.items;
assert.equal(itemGrams(r), 80);
assert.deepEqual(itemNutrients(r), { kcal: 238, protein: 7.8, carbs: 44, fat: 3.6, satFat: 0.9, sugar: 0.4, fiber: 4 });
const tot = mealTotals(meal.items);
assert.equal(tot.kcal, 238 + 156, 'totals add the items');
assert.equal(tot.satFat, 0.9 + 1.2);
const more = setCount(r, 3);
assert.equal(itemGrams(more), 120);
assert.equal(more.stated, true, 'choosing an amount makes it the person\'s amount');
assert.equal(setCount(r, -5).count, 0.25, 'never below a quarter');
const g = setGrams(d, 200);
assert.deepEqual([g.unit, itemGrams(g), g.stated], ['g', 200, true]);
assert.equal(itemNutrients(g).kcal, 208);
assert.equal(setGrams(d, 99999).count, 5000);
assert.equal(stepFor(r), 1);
assert.equal(stepFor(d), 0.5);
assert.equal(mealTotals([]).kcal, 0);
const none: MealItem[] = [];
assert.equal(mealTotals(none).protein, 0);

// ---- did the person already say how much? (their words decide, not only the AI) ----
assert.ok(hasAmount('2 rotis') && hasAmount('a bowl of dal') && hasAmount('half a cup curd') && hasAmount('200g rice') && hasAmount('एक कटोरी दाल') && hasAmount('రెండు ఇడ్లీ') && hasAmount('2 சப்பாத்தி'));
assert.ok(!hasAmount('dal') && !hasAmount('rice and curd'.split(' and ')[0]) && !hasAmount('curd'));
assert.deepEqual(amountsStated('2 rotis, dal, curd, 1 banana', ['roti', 'dal', 'curd', 'banana']), [true, false, false, true], 'each food gets its own answer');
assert.deepEqual(amountsStated('two idlis and sambar with a glass of buttermilk', ['idli', 'sambar', 'buttermilk']), [true, false, true]);
assert.deepEqual(amountsStated('3 chapati', ['roti']), [true], 'a Hindi word the AI renamed still matches by position');
assert.deepEqual(amountsStated('rice 150 g' + String.fromCharCode(10) + 'dal', ['rice', 'dal']), [true, false], 'new lines split items too');
assert.deepEqual(amountsStated('paneer butter masala', ['paneer butter masala']), [false]);
assert.deepEqual(amountsStated('', ['x']), [false]);
const ai: MealItem[] = [
  { id: '1', name: 'Roti', unit: 'roti', unitGrams: 40, count: 2, stated: false, per100: { kcal: 300, protein: 10, carbs: 55, fat: 4, satFat: 1, sugar: 0, fiber: 5 } },
  { id: '2', name: 'Dal', unit: 'katori', unitGrams: 150, count: 1, stated: false, per100: { kcal: 100, protein: 6, carbs: 14, fat: 3, satFat: 1, sugar: 0, fiber: 3 } },
];
assert.deepEqual(withStatedAmounts(ai, '2 rotis and dal').map((i) => i.stated), [true, false], 'the AI said false for roti; the typed 2 wins');
assert.deepEqual(withStatedAmounts([{ ...ai[0], stated: true }], 'roti').map((i) => i.stated), [true], 'never turned off');

// ---- one food ----
const food = parseFood({ found: true, name: ' Paneer butter masala ', serving_label: '1 katori (150 g)', serving_grams: 150, per100: { kcal: 190, protein: 7, carbs: 7, fat: 15, saturated_fat: 7, free_sugar: 3, fiber: 1 } }, 'pbm')!;
assert.equal(food.name, 'Paneer butter masala');
assert.equal(food.servingG, 150);
assert.equal(food.satFat, 7);
assert.equal(food.sugar, 3);
assert.equal(parseFood({ found: false }, 'x'), null);
assert.equal(parseFood({ found: true, name: 'x', per100: { kcal: 1 } }, 'x'), null);

// ---- the calls (with a fake AI) ----
(async () => {
  const seen: unknown[] = [];
  const ask = async (_k: string, input: unknown) => {
    seen.push(input);
    return { meal: null, items: [roti] };
  };
  const t = await analyzeMealText('k', 'two rotis', ask);
  assert.equal(t.items.length, 1);
  assert.ok(String(seen[0]).includes('two rotis'));
  const p = await analyzeMealPhoto('k', 'AAAA', 'image/jpeg', ask);
  assert.equal(p.items.length, 1);
  assert.ok(Array.isArray(seen[1]) && (seen[1] as { type: string }[])[1].type === 'image');
  assert.equal(await lookupFood('k', 'x'), null, 'too short to search');
  const f = await lookupFood('k', 'dal tadka', async () => ({ found: true, name: 'Dal tadka', serving_label: '1 katori', serving_grams: 150, per100: roti.per100 }));
  assert.equal(f!.name, 'Dal tadka');
  console.log('Gemini food tests passed.');
})();
