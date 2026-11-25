// Photo → food estimate. The AI model only NAMES foods and GUESSES portions in grams.
// All calories/macros come from the food database (macrosFor) — the model is never asked for them.
import { AI } from '../config/app';
import type { Food } from '../data/foods';
import { tokens, wordMatches } from './foodText';
import { macrosFor } from './nutrition';

export type Confidence = 'low' | 'medium' | 'high';
export type RawItem = { name: string; databaseName: string | null; searchTerm: string; grams: number; confidence: Confidence; /** what is already inside this dish (so it is never counted again as its own item) */ includes?: string[] };
/** Nutrition the user typed in (for this item at its current grams). Takes priority over database values. */
export type Manual = { kcal: number; protein: number; carbs: number; fat: number };
export type MacroKey = keyof Manual;

/** lookup: 'pending' while searching online, 'failed' if nothing reliable was found. */
export type PhotoItem = RawItem & { id: string; food: Food | null; lookup?: 'pending' | 'failed'; manual?: Manual };

const r1x = (n: number) => Math.round(n * 10) / 10;

/** What this item contributes: the user's own numbers if they edited them, else database values scaled to grams. */
export function effectiveMacros(it: Pick<PhotoItem, 'food' | 'grams' | 'manual'>): Manual | null {
  if (it.manual) return it.manual;
  if (!it.food) return null;
  const m = macrosFor(it.food, it.grams);
  return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
}

/** Change grams; hand-edited numbers scale with the portion so they stay proportional. */
export function withGrams(it: PhotoItem, grams: number): PhotoItem {
  const g = Math.max(5, Math.round(grams));
  if (!it.manual || !(it.grams > 0)) return { ...it, grams: g };
  const k = g / it.grams;
  const m = it.manual;
  return { ...it, grams: g, manual: { kcal: r1x(m.kcal * k), protein: r1x(m.protein * k), carbs: r1x(m.carbs * k), fat: r1x(m.fat * k) } };
}

/** Edit one nutrient of one item (starts from the current values, or zeros for an item with no data). */
export function setItemMacro(it: PhotoItem, key: MacroKey, value: number): PhotoItem {
  const base = effectiveMacros(it) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return { ...it, manual: { ...base, [key]: Math.max(0, r1x(value)) } };
}

/**
 * Edit the meal total: every item is scaled by the same factor so proportions stay (or, if the total was 0, split equally).
 * Items without any nutrition are left alone.
 */
export function scaleTotal(items: PhotoItem[], key: MacroKey, newTotal: number): PhotoItem[] {
  const target = Math.max(0, newTotal);
  const counted = items.filter((i) => effectiveMacros(i));
  if (!counted.length) return items;
  const old = counted.reduce((s, i) => s + effectiveMacros(i)![key], 0);
  return items.map((it) => {
    const eff = effectiveMacros(it);
    if (!eff) return it;
    const value = old > 0 ? eff[key] * (target / old) : target / counted.length;
    return { ...it, manual: { ...eff, [key]: r1x(value) } };
  });
}

/** Portion-size uncertainty by confidence. Photo portion estimates are rough, so we show ranges. */
export const UNCERTAINTY: Record<Confidence, number> = { high: 0.2, medium: 0.3, low: 0.45 };

export const MODELS: string[] = AI.models; // from src/config/app.ts
export const PHOTO_MODELS: string[] = AI.photoModels; // strongest model first, for plate photos
/** Photos are answered with as little "thinking" as the model allows: measured about a third faster. */
export const PHOTO_EXTRA = { generation_config: { thinking_level: AI.photoThinking } };

export const buildPrompt = (databaseNames: string[]) =>
  [
    'You are a careful dietitian estimating ONE meal from ONE photo, for a food diary in India. Work through these steps.',
    '',
    'STEP 1. SCALE. Find objects of known size in the photo and use them to judge real-world size. Typical sizes: dinner plate 24-28 cm across, thali 28-32 cm, side plate 18-20 cm, katori (small bowl) about 150 ml, steel glass about 200-250 ml, tablespoon 15 ml, teaspoon 5 ml, fork or spoon about 18-20 cm long, a phone about 15 cm, an adult hand about 18 cm long, packaging with a printed weight. Write which object you used and its assumed size in "scale_reference". If nothing in the photo gives a scale, say so there and lower your confidence.',
    '',
    'STEP 2. VOLUME TO WEIGHT. For every food estimate how much space it takes (width across the plate, and how deep or thick it is) compared with the scale object, then convert to weight with realistic densities. Useful anchors (cooked, edible weight): 1 phulka or chapati 30-40 g, paratha 60-80 g, naan 90-110 g, 1 idli 40 g, 1 dosa 90-120 g, boiled egg 50 g, a katori of cooked rice 150 g (a full plate portion is 200-300 g), a katori of dal 150-180 g, a katori of curry with pieces 150 g, a katori of curd 120 g, 1 samosa 60-80 g, 1 banana 100 g peeled, 1 apple 150 g, a chicken leg piece about 80-100 g without bone, a slice of bread 25-30 g, a glass of milk or lassi 200-250 g. Do not copy these numbers blindly: change them to what the photo shows, and avoid rounding everything to 100, 150 or 200. A normal home plate is about 300-700 g in total and a restaurant plate 500-1000 g. Weigh only what can be eaten: leave out bones, shells, peel, leaves used for serving, foil and the plate itself. Count gravy and oil that are part of a dish.',
    '',
    'STEP 3. ONE ENTRY PER DISH, NEVER TWICE. A mixed dish is ONE item with its whole weight. Chicken biryani already contains its rice and chicken pieces, so give "chicken biryani" once (for example 300 g) and do NOT also list rice or chicken. The same goes for pulao, fried rice, khichdi, curry with pieces, sandwiches, burgers, pizza, wraps, rolls, noodles, salads and stuffed breads. List foods separately only when they are clearly separate on the plate (a bowl of raita next to the biryani, a roti beside a curry). If one food appears several times (three rotis), give ONE item with the total weight and the count in the name, like "roti x3". In "includes" list the main ingredients already counted inside that dish. Never output the same food in two items.',
    '',
    'For each item give:',
    '- name: short common name (Indian dishes by their usual names, like dal, roti, idli, sambar)',
    '- includes: the main ingredients already inside this dish (an empty list for a simple food)',
    '- database_name: copy EXACTLY one name from the DATABASE list below if it is a good match for the same food, otherwise null',
    '- search_term: 1-3 words to search a food database (e.g. "chicken biryani")',
    '- grams: your best estimate of the edible weight in grams, a whole number',
    '- confidence: high only when the food is clear AND a scale object is visible, otherwise medium or low',
    'Do NOT output calories or nutrients. If the image has no food, return an empty items list.',
    'In "notes" mention anything that makes the estimate harder (hidden oil, sauces, mixed dishes, unclear scale, dark or blurry photo).',
    '',
    'DATABASE:',
    ...databaseNames.map((n) => `- ${n}`),
  ].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    scale_reference: { type: 'string' }, // thinking first: the object used for scale and its size
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          includes: { type: 'array', items: { type: 'string' } },
          database_name: { type: ['string', 'null'] },
          search_term: { type: 'string' },
          grams: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'search_term', 'grams', 'confidence'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['items'],
};

/** Request body for the Gemini Interactions API (v1beta/interactions). */
export const buildRequest = (model: string, base64: string, mime: string, databaseNames: string[]) => ({
  model,
  input: [
    { type: 'text', text: buildPrompt(databaseNames) },
    { type: 'image', data: base64, mime_type: mime },
  ],
  response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
});

type Step = { type?: string; content?: { type?: string; text?: string }[] };

/** Pull the model's JSON text out of an interaction response and validate it. */
export function parseResponse(json: unknown): { items: RawItem[]; notes: string } {
  const r = json as { status?: string; steps?: Step[] };
  if (!r || typeof r !== 'object') throw new Error('The AI returned an unreadable response.');
  if (r.status && r.status !== 'completed') throw new Error(`The AI request did not finish (status: ${r.status}).`);
  const text = (r.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('');
  if (!text) throw new Error('The AI returned no answer. Try another photo.');
  let data: { items?: unknown; notes?: unknown };
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('The AI answer was not valid JSON. Try again.');
  }
  if (!Array.isArray(data.items)) throw new Error('The AI answer was missing the food list.');
  const items: RawItem[] = [];
  for (const it of data.items as Record<string, unknown>[]) {
    const grams = Number(it.grams);
    const name = typeof it.name === 'string' ? it.name.trim() : '';
    if (!name || !isFinite(grams) || grams <= 0 || grams > 3000) continue; // drop nonsense instead of trusting it
    const conf = it.confidence === 'high' || it.confidence === 'medium' || it.confidence === 'low' ? it.confidence : 'low';
    items.push({
      name,
      databaseName: typeof it.database_name === 'string' ? it.database_name : null,
      searchTerm: typeof it.search_term === 'string' && it.search_term.trim() ? it.search_term.trim() : name,
      grams: Math.round(grams),
      confidence: conf,
      includes: Array.isArray(it.includes) ? (it.includes as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 12) : [],
    });
  }
  const merged = mergeDuplicates(items);
  const notes = [typeof data.notes === 'string' ? data.notes : '', merged.merged.length ? `Not counted twice: ${merged.merged.join('; ')}.` : ''].filter(Boolean).join(' ');
  return { items: merged.items, notes };
}

const SKIP_WORDS = new Set(['piece', 'pieces', 'boiled', 'fried', 'cooked', 'grilled', 'roasted', 'baked', 'steamed', 'gravy', 'sauce', 'with', 'and', 'of', 'the', 'plain', 'fresh', 'small', 'large', 'extra']);
/** Dishes that already contain these foods, so these are never separate items next to them. */
const DISH_CONTAINS: Record<string, string[]> = {
  biryani: ['rice', 'chicken', 'mutton', 'lamb', 'egg', 'paneer', 'vegetable', 'vegetables', 'veg', 'onion', 'potato', 'prawn', 'fish'],
  pulao: ['rice', 'vegetable', 'vegetables', 'veg', 'peas', 'paneer', 'chicken'],
  pulav: ['rice', 'vegetable', 'vegetables', 'veg', 'peas'],
  khichdi: ['rice', 'dal', 'lentil', 'lentils', 'vegetable', 'vegetables'],
  'fried rice': ['rice', 'egg', 'chicken', 'vegetable', 'vegetables', 'veg'],
  noodles: ['vegetable', 'vegetables', 'egg', 'chicken'],
  sandwich: ['bread', 'cheese', 'egg', 'chicken', 'vegetable', 'vegetables'],
  burger: ['bun', 'bread', 'patty', 'cheese', 'chicken'],
  wrap: ['roti', 'chicken', 'paneer', 'vegetable', 'vegetables'],
  roll: ['roti', 'chicken', 'paneer', 'egg', 'vegetable', 'vegetables'],
  pizza: ['cheese', 'bread', 'vegetable', 'vegetables', 'chicken'],
  salad: ['vegetable', 'vegetables', 'cucumber', 'tomato', 'onion'],
};
const sig = (s: string) => tokens(s).filter((t) => !SKIP_WORDS.has(t));

export type Mergeable = { name: string; grams: number; includes?: string[] };

/**
 * One food must count once. Works out which items to drop: the same food listed twice (its weight moves to the first one), and an
 * item that is only an ingredient of a dish already on the list (chicken pieces next to chicken biryani).
 */
export function mergePlan(list: Mergeable[]): { drop: Set<number>; added: Map<number, number>; notes: string[] } {
  const notes: string[] = [];
  const drop = new Set<number>();
  const added = new Map<number, number>(); // kept index -> grams added from repeats
  const grams = list.map((x) => x.grams);
  const key = (n: string) => sig(n).sort().join(' ');
  // 1. the same food listed more than once
  list.forEach((it, i) => {
    const k = key(it.name);
    if (!k) return;
    const prev = list.findIndex((o, j) => j < i && !drop.has(j) && key(o.name) === k);
    if (prev >= 0) {
      drop.add(i);
      grams[prev] += grams[i];
      added.set(prev, (added.get(prev) ?? 0) + grams[i]);
      notes.push(`${it.name} added to ${list[prev].name}`);
    }
  });
  // 2. an ingredient that is already inside a bigger dish
  list.forEach((b, bi) => {
    const bt = sig(b.name);
    if (!bt.length || drop.has(bi)) return;
    for (let ai = 0; ai < list.length; ai++) {
      const a = list[ai];
      if (ai === bi || drop.has(ai) || drop.has(bi) || grams[ai] < grams[bi]) continue;
      const at = new Set(sig(a.name));
      const inName = bt.every((t) => at.has(t)) && at.size > bt.length;
      const listed = (a.includes ?? []).flatMap((x) => sig(x));
      const inList = bt.every((t) => listed.includes(t)) && grams[ai] > grams[bi];
      const dishKey = Object.keys(DISH_CONTAINS).find((k) => tokens(a.name).join(' ').includes(k));
      const inDish = !!dishKey && grams[ai] > grams[bi] && bt.every((t) => DISH_CONTAINS[dishKey].includes(t));
      if (inName || inList || inDish) {
        drop.add(bi);
        notes.push(`${b.name} is already part of ${a.name}`);
      }
    }
  });
  return { drop, added, notes };
}

export function mergeDuplicates(items: RawItem[]): { items: RawItem[]; merged: string[] } {
  const plan = mergePlan(items);
  const out = items
    .map((it, i) => (plan.added.has(i) ? { ...it, grams: it.grams + plan.added.get(i)! } : { ...it }))
    .filter((_, i) => !plan.drop.has(i));
  return { items: out, merged: plan.notes };
}

/** Exact database_name from the model first; otherwise a strict word-overlap match; otherwise null (user chooses). */
export function matchFood(item: RawItem, foods: Food[]): Food | null {
  if (item.databaseName) {
    const exact = foods.find((f) => f.name.toLowerCase() === item.databaseName!.toLowerCase());
    if (exact) return exact;
  }
  let best: Food | null = null;
  let bestScore = 0;
  for (const term of [item.name, item.searchTerm]) {
    const a = tokens(term);
    if (!a.length) continue;
    for (const f of foods) {
      const b = tokens(f.name);
      const overlap = a.filter((t) => b.includes(t)).length;
      const score = overlap / Math.max(a.length, b.length);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
  }
  return bestScore >= 0.6 ? best : null;
}

const SOURCE_RANK: Record<string, number> = { Foundation: 0, 'SR Legacy': 1, 'Survey (FNDDS)': 2 };

/**
 * Pick the online (USDA) result that really is this food: every word of the query must appear in the
 * description; among those prefer the one with the fewest extra words (most generic), then the better data source.
 * Returns null rather than guessing when nothing fits.
 */
export function pickOnlineMatch(item: RawItem, candidates: Food[]): Food | null {
  let best: { food: Food; extra: number; rank: number } | null = null;
  for (const term of [item.searchTerm, item.name]) {
    const a = tokens(term);
    if (!a.length) continue;
    for (const f of candidates) {
      const b = tokens(f.name);
      if (!a.every((t) => wordMatches(t, b))) continue;
      const cand = { food: f, extra: b.length - a.length, rank: SOURCE_RANK[f.category] ?? 3 };
      if (!best || cand.extra < best.extra || (cand.extra === best.extra && cand.rank < best.rank)) best = cand;
    }
    if (best) break; // searchTerm match beats a looser name match
  }
  return best?.food ?? null;
}

export type SearchFn = (query: string) => Promise<Food[]>;

/**
 * Look up foods the local database doesn't have, one item at a time (online APIs are rate limited).
 * `onUpdate` fires as each item resolves. A rate-limit error stops further lookups and is returned so the UI can explain.
 */
export async function resolveOnline(
  items: PhotoItem[],
  search: SearchFn | SearchFn[], // tried in order until one gives a good match
  onUpdate: (id: string, patch: Partial<PhotoItem>) => void,
  isCancelled: () => boolean = () => false,
): Promise<{ error: string | null }> {
  let error: string | null = null;
  for (const it of items) {
    if (it.food || isCancelled()) continue;
    if (error) {
      onUpdate(it.id, { lookup: 'failed' });
      continue;
    }
    let found: Food | null = null;
    const queries = [...new Set([it.searchTerm, it.name].map((q) => q.trim()).filter(Boolean))];
    try {
      outer: for (const fn of Array.isArray(search) ? search : [search]) {
        for (const q of queries) {
          found = pickOnlineMatch(it, await fn(q));
          if (found) break outer;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Online lookup failed.';
    }
    if (isCancelled()) return { error };
    onUpdate(it.id, found ? { food: found, lookup: undefined } : { lookup: 'failed' });
  }
  return { error };
}

/**
 * Portion uncertainty, widened when the nutrition values themselves are less certain: an average of varied products,
 * a single web page, or an AI estimate. Numbers the user typed themselves are treated as nearly exact.
 */
export function itemUncertainty(it: { confidence: Confidence; food: Food | null; manual?: Manual }): number {
  if (it.manual) return 0.1;
  const base = UNCERTAINTY[it.confidence];
  const f = it.food;
  if (!f) return base;
  if (f.source === 'ai') return Math.max(base, 0.5);
  const t = f.typical;
  if (!t || f.kcal <= 0) return base;
  const spread = Math.min(0.6, (t.kcalMax - t.kcalMin) / 2 / f.kcal);
  return Math.max(base, spread, f.source === 'web' && t.n === 1 ? 0.3 : 0);
}

export type Totals = { kcal: number; kcalLow: number; kcalHigh: number; protein: number; carbs: number; fat: number; counted: number; skipped: number };

/** Totals over matched items, with a kcal range from portion uncertainty. Unmatched items are skipped, not guessed. */
export function totalsWithRange(items: PhotoItem[]): Totals {
  const t: Totals = { kcal: 0, kcalLow: 0, kcalHigh: 0, protein: 0, carbs: 0, fat: 0, counted: 0, skipped: 0 };
  for (const it of items) {
    const m = effectiveMacros(it);
    if (!m) {
      t.skipped++;
      continue;
    }
    const u = itemUncertainty(it);
    t.kcal += m.kcal;
    t.kcalLow += m.kcal * (1 - u);
    t.kcalHigh += m.kcal * (1 + u);
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
    t.counted++;
  }
  return t;
}
