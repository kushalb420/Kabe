import assert from 'node:assert/strict';
import { MealItem } from '../src/lib/gemFood';
import { analyzeMealTextSmart } from '../src/lib/mealAi';
import { FoodMemory, itemFromMemory, learnFoods, memKey, parseClause, resolveText, sanitizeMemory, splitClauses } from '../src/lib/foodMemory';
import { getSharedFoods, getSharedMicros, putSharedFood } from '../src/lib/sharedCache';

const per100 = { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, satFat: 0.1, sugar: 0, fiber: 0.4 };
const item = (name: string, o: Partial<MealItem> = {}): MealItem => ({ id: 'a', name, unit: 'katori', unitGrams: 150, count: 1, note: '', stated: false, per100, ...o });

assert.deepEqual(splitClauses('2 roti, dal (thin, no oil)\n150 g curd and 1 banana'), ['2 roti', 'dal (thin, no oil)', '150 g curd', '1 banana']);
assert.equal(memKey('250 g White Rice (cooked)'), 'white rice');
assert.equal(memKey('Idlis'), 'idli');
assert.notEqual(memKey('fried egg'), memKey('boiled egg'), 'descriptors matter');
assert.deepEqual(parseClause('250 g rice'), { name: 'rice', amount: { kind: 'g', value: 250 }, detail: false });
assert.deepEqual(parseClause('2 rotis').amount, { kind: 'count', value: 2 });
assert.deepEqual(parseClause('0.5 l milk').amount, { kind: 'ml', value: 500 });
assert.equal(parseClause('curd (loose)').detail, true);

// learning from a saved meal
let mem: FoodMemory = learnFoods({}, [item('rice'), item('roti', { unit: 'roti', unitGrams: 40 }), item('curd (loose)', { note: 'loose' })], 1);
assert.deepEqual(Object.keys(mem).sort(), ['rice', 'roti'].sort(), 'an item with a note is not learned');
// using it
const two = itemFromMemory('2 roti', mem)!;
assert.equal(two.count, 2); assert.equal(two.unit, 'roti'); assert.equal(two.stated, true);
const grams = itemFromMemory('250 g rice', mem)!;
assert.equal(grams.unit, 'g'); assert.equal(grams.count, 250); assert.equal(grams.unitGrams, 1);
const bare = itemFromMemory('rice', mem)!;
assert.equal(bare.stated, false); assert.equal(bare.count, 1);
assert.equal(itemFromMemory('rice (fried)', mem), null, 'a detail goes to the AI');
assert.equal(itemFromMemory('pizza', mem), null);
assert.equal(itemFromMemory('99999 g rice', mem), null);
const r = resolveText('2 roti, pizza, 100 g rice', mem);
assert.equal(r.known.length, 2); assert.deepEqual(r.unknown, ['pizza']);
// numbers average over the times a food was worked out
mem = learnFoods(mem, [item('rice', { per100: { ...per100, kcal: 150 } })], 2);
assert.equal(mem.rice.n, 2); assert.equal(mem.rice.per100.kcal, 140);
assert.deepEqual(sanitizeMemory({ rice: { ...mem.rice }, bad: { name: 1 }, x: { name: 'x', unit: 'g', unitGrams: 100, per100: { ...per100, kcal: 5000 } } }).rice.name, 'rice');
assert.deepEqual(Object.keys(sanitizeMemory({ x: { name: 'x', unit: 'g', unitGrams: 100, per100: { ...per100, kcal: 5000 } } })), [], 'nonsense nutrition is dropped');

(async () => {
  // all known: no AI request at all
  let calls = 0;
  const ask = async () => { calls++; return { meal: null, items: [] }; };
  const all = await analyzeMealTextSmart('k', '2 roti, 100 g rice', mem, null, ask);
  assert.equal(all.items.length, 2); assert.equal(all.aiCalls, 0); assert.equal(calls, 0);
  // the shared cache fills in a food the person never logged
  const shared = { rpc: async (fn: string) => (fn === 'kabe_cache_get' ? { data: [{ key: 'pizza', name: 'pizza', unit: 'slice', unit_grams: 110, per100: { ...per100, kcal: 270, carbs: 33, protein: 11, fat: 10 }, uses: 5 }, { key: 'weird', name: 'weird', unit: 'g', unit_grams: 1, per100: { ...per100, kcal: 9999 }, uses: 9 }], error: null } : { data: null, error: null }) };
  const viaShared = await analyzeMealTextSmart('k', '1 pizza, 100 g rice', mem, shared, ask);
  assert.equal(viaShared.aiCalls, 0); assert.equal(calls, 0);
  assert.deepEqual(viaShared.items.map((i) => i.name).sort(), ['pizza', 'rice']);
  // only the unknown food goes to the AI, and then it is shared
  let sent = '';
  const puts: string[] = [];
  const shared2 = { rpc: async (fn: string, args?: Record<string, unknown>) => { if (fn === 'kabe_cache_put') puts.push(String(args?.p_key)); return { data: [], error: null }; } };
  const ai = async (_k: string, input: unknown) => { sent = String(input); return { meal: null, items: [{ name: 'sushi', unit: 'piece', unit_grams: 30, count: 2, quantity_stated: false, note: '', per100: { kcal: 150, protein: 6, carbs: 28, fat: 1, saturated_fat: 0, free_sugar: 1, fiber: 1 } }] }; };
  const mixed = await analyzeMealTextSmart('k', '2 roti, sushi', mem, shared2, ai);
  assert.equal(mixed.aiCalls, 1); assert.match(sent, /Their words: "sushi"/, 'only the unknown food is sent');
  assert.deepEqual(mixed.items.map((i) => i.name), ['roti', 'sushi']);
  assert.deepEqual(puts, ['sushi']);
  // a cache that is down never breaks logging
  const broken = { rpc: async () => { throw new Error('offline'); } };
  assert.deepEqual(await getSharedFoods(broken, ['a']), {});
  assert.deepEqual(await getSharedMicros(broken, ['a']), {});
  await putSharedFood(broken, 'a', mem.rice);
  assert.deepEqual(await getSharedFoods(null, ['a']), {});
  // one report is not trusted yet
  assert.deepEqual(await getSharedFoods({ rpc: async () => ({ data: [{ key: 'a', name: 'a', unit: 'g', unit_grams: 1, per100, uses: 1 }], error: null }) }, ['a']), {});
  console.log('Food memory tests passed.');
})();
