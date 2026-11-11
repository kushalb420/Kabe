import assert from 'node:assert/strict';
import { FOODS, Food } from '../src/data/foods';
import {
  PhotoItem,
  buildPrompt,
  buildRequest,
  effectiveMacros,
  itemUncertainty,
  matchFood,
  parseResponse,
  pickOnlineMatch,
  resolveOnline,
  scaleTotal,
  setItemMacro,
  totalsWithRange,
  withGrams,
} from '../src/lib/photo';

const wrap = (obj: unknown, status = 'completed') => ({
  status,
  steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(obj) }] }],
});

// --- parsing ---
const ok = parseResponse(
  wrap({
    items: [
      { name: 'Roti', database_name: 'Roti / Chapati (whole wheat)', search_term: 'roti', grams: 80, confidence: 'high' },
      { name: 'Mystery curry', database_name: null, search_term: 'curry', grams: 150.4, confidence: 'weird' },
      { name: 'Bad', search_term: 'x', grams: -5, confidence: 'high' }, // dropped
      { name: 'Huge', search_term: 'x', grams: 99999, confidence: 'high' }, // dropped
      { name: '', search_term: 'x', grams: 10, confidence: 'high' }, // dropped
    ],
    notes: 'Oil not visible',
  }),
);
assert.equal(ok.items.length, 2);
assert.equal(ok.items[1].confidence, 'low'); // unknown confidence → low
assert.equal(ok.items[1].grams, 150);
assert.equal(ok.notes, 'Oil not visible');

// fenced JSON tolerated
const fenced = parseResponse({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '```json\n{"items":[]}\n```' }] }] });
assert.deepEqual(fenced.items, []);

assert.throws(() => parseResponse(wrap({ items: [] }, 'failed')), /did not finish/);
assert.throws(() => parseResponse({ status: 'completed', steps: [] }), /no answer/);
assert.throws(() => parseResponse({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'not json' }] }] }), /not valid JSON/);
assert.throws(() => parseResponse(wrap({ nothing: true })), /missing the food list/);

// --- matching ---
const m = (name: string, databaseName: string | null = null, searchTerm = name) => matchFood({ name, databaseName, searchTerm, grams: 100, confidence: 'high' }, FOODS);
assert.equal(m('x', 'Egg, boiled')?.id, 'egg'); // exact database_name wins
assert.equal(m('x', 'egg, BOILED')?.id, 'egg'); // case-insensitive
assert.equal(m('boiled egg')?.id, 'egg'); // word overlap
assert.equal(m('white rice')?.id, 'rice-white');
assert.equal(m('scrambled egg'), null); // not the same food → user chooses, no silent wrong match
assert.equal(m('chicken biryani'), null);
assert.equal(m('x', 'Not in list', 'something odd'), null);

// --- totals + range ---
const roti = FOODS.find((f) => f.id === 'roti')!;
const items: PhotoItem[] = [
  { id: '1', name: 'Roti', databaseName: null, searchTerm: 'roti', grams: 100, confidence: 'high', food: roti },
  { id: '2', name: 'Curry', databaseName: null, searchTerm: 'curry', grams: 200, confidence: 'low', food: null },
];
const t = totalsWithRange(items);
assert.equal(t.counted, 1);
assert.equal(t.skipped, 1); // unmatched food is NOT given invented calories
assert.equal(Math.round(t.kcal), 297);
assert.equal(Math.round(t.kcalLow), Math.round(297 * 0.8));
assert.equal(Math.round(t.kcalHigh), Math.round(297 * 1.2));

// --- online lookup (USDA-style candidates, taken from real search results) ---
const usda = (name: string, category: string): Food => ({ id: `usda-${name}`, name, category, kcal: 100, protein: 5, carbs: 10, fat: 2, servingG: 100, servingLabel: '100 g', source: 'usda' });
const biryaniResults = [usda('Biryani With Vegetables', 'Survey (FNDDS)'), usda('Biryani With Chicken', 'Survey (FNDDS)'), usda('Biryani With Meat', 'Survey (FNDDS)')];
const raw = (name: string, searchTerm = name) => ({ name, databaseName: null, searchTerm, grams: 100, confidence: 'medium' as const });
assert.equal(pickOnlineMatch(raw('Chicken biryani'), biryaniResults)?.name, 'Biryani With Chicken'); // word order doesn't matter
assert.equal(pickOnlineMatch(raw('Fish biryani'), biryaniResults), null); // fish isn't in any result → no silent wrong match
const paneerResults = [usda('Palak Paneer', 'Survey (FNDDS)'), usda('Cheese, Paneer', 'Survey (FNDDS)'), usda('Butter, Tub', 'Survey (FNDDS)'), usda('Fruit Butter', 'Survey (FNDDS)')];
assert.equal(pickOnlineMatch(raw('Paneer butter masala'), paneerResults), null); // noisy results rejected
// most generic wins, better source breaks ties
assert.equal(pickOnlineMatch(raw('rice'), [usda('Rice, With Chicken And Beans', 'Survey (FNDDS)'), usda('Rice, White', 'Foundation')])?.name, 'Rice, White');
assert.equal(pickOnlineMatch(raw('oats'), [usda('Oats', 'Survey (FNDDS)'), usda('Oats', 'Foundation')])?.category, 'Foundation');

(async () => {
  const mk = (id: string, name: string, food: Food | null = null): PhotoItem => ({ ...raw(name), id, food });
  const updates: Record<string, any> = {};
  const r1 = await resolveOnline(
    [mk('a', 'Roti', FOODS[0]), mk('b', 'Chicken biryani'), mk('c', 'Mystery stew')],
    async (q) => (q.toLowerCase().includes('biryani') ? biryaniResults : []),
    (id, patch) => (updates[id] = patch),
  );
  assert.equal(r1.error, null);
  assert.equal(updates.a, undefined); // already matched locally → no lookup
  assert.equal(updates.b.food.name, 'Biryani With Chicken');
  assert.equal(updates.c.lookup, 'failed');

  // rate limit: stop calling the API, mark the rest failed, surface the message
  const up2: Record<string, any> = {};
  let calls2 = 0;
  const r2 = await resolveOnline(
    [mk('x', 'Soup'), mk('y', 'Salad'), mk('z', 'Pie')],
    async () => { calls2++; throw new Error('USDA rate limit reached.'); },
    (id, patch) => (up2[id] = patch),
  );
  assert.equal(calls2, 1); // first lookup hits the limit; no more API calls are made for the others
  assert.equal(up2.x.lookup, 'failed');
  assert.match(r2.error!, /rate limit/);
  assert.equal(up2.y.lookup, 'failed');
  assert.equal(up2.z.lookup, 'failed');

  // cancelled (user left) → no updates
  const up3: Record<string, any> = {};
  await resolveOnline([mk('q', 'Chicken biryani')], async () => biryaniResults, (id, p) => (up3[id] = p), () => true);
  assert.deepEqual(up3, {});
  console.log('Online lookup tests passed.');
})();

// --- editable nutrition: per item and for the meal total ---
const dal = FOODS.find((x) => x.id === 'toor-dal')!;
const mk = (id: string, food: Food | null, grams: number): PhotoItem => ({ id, name: id, databaseName: null, searchTerm: id, grams, confidence: 'high', food });
let meal = [mk('roti', roti, 100), mk('dal', dal, 100), mk('curry', null, 200)];
assert.equal(Math.round(effectiveMacros(meal[0])!.kcal), 297);
assert.equal(effectiveMacros(meal[2]), null);
// edit one item's calories by hand → it overrides the database; the others are untouched
meal[0] = setItemMacro(meal[0], 'kcal', 250);
assert.equal(effectiveMacros(meal[0])!.kcal, 250);
assert.equal(effectiveMacros(meal[0])!.protein, 9.8, 'other macros keep their current values');
// editing grams scales hand-edited numbers proportionally
meal[0] = withGrams(meal[0], 50);
assert.equal(effectiveMacros(meal[0])!.kcal, 125);
assert.equal(meal[0].grams, 50);
assert.equal(withGrams(mk('x', roti, 100), 200).manual, undefined, 'database items just recompute');
// an item with no data becomes usable once the user types numbers
meal[2] = setItemMacro(meal[2], 'kcal', 300);
assert.equal(effectiveMacros(meal[2])!.kcal, 300);
assert.equal(effectiveMacros(meal[2])!.protein, 0);
assert.equal(totalsWithRange(meal).counted, 3);
assert.equal(totalsWithRange(meal).skipped, 0);
// editing the TOTAL scales every item by the same factor
const before = totalsWithRange(meal).kcal; // 125 + 105 + 300 = 530
assert.equal(Math.round(before), 530);
const scaled = scaleTotal(meal, 'kcal', 1060);
assert.equal(Math.round(totalsWithRange(scaled).kcal), 1060);
assert.equal(Math.round(effectiveMacros(scaled[0])!.kcal), 250); // 125 × 2
assert.equal(Math.round(effectiveMacros(scaled[2])!.kcal), 600);
assert.equal(scaled[1].grams, 100, 'grams unchanged');
// total of a macro that was 0 → split equally; total 0 → zeros
const flat = scaleTotal([mk('a', null, 100), mk('b', null, 100)].map((i) => setItemMacro(i, 'fat', 0)), 'fat', 10);
assert.equal(effectiveMacros(flat[0])!.fat, 5);
assert.equal(Math.round(totalsWithRange(scaleTotal(meal, 'kcal', 0)).kcal), 0);
// uncertainty: your own numbers ≈ exact; AI estimate widest; single web page wider than base
assert.equal(itemUncertainty({ confidence: 'low', food: null, manual: { kcal: 1, protein: 0, carbs: 0, fat: 0 } }), 0.1);
assert.equal(itemUncertainty({ confidence: 'high', food: { ...roti, source: 'ai', estimate: true } }), 0.5);
assert.equal(itemUncertainty({ confidence: 'high', food: { ...roti, source: 'web', typical: { n: 1, kcalMin: 0.75 * roti.kcal, kcalMax: 1.25 * roti.kcal } } }), 0.3);
assert.equal(itemUncertainty({ confidence: 'high', food: roti }), 0.2);
// source labels

// --- request shape + prompt ---
const req: any = buildRequest('gemini-3.5-flash-lite', 'AAAA', 'image/jpeg', ['Egg, boiled']);
assert.equal(req.input[1].type, 'image');
assert.equal(req.input[1].mime_type, 'image/jpeg');
assert.equal(req.response_format.mime_type, 'application/json');
assert.ok(buildPrompt(['Egg, boiled']).includes('- Egg, boiled'));
assert.ok(/Do NOT output calories/.test(req.input[0].text));

console.log('Photo analysis tests passed.');
