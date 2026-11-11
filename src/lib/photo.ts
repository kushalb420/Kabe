// Photo → food estimate. The AI model only NAMES foods and GUESSES portions in grams.
// All calories/macros come from the food database (macrosFor) — the model is never asked for them.
import { AI } from '../config/app';
import type { Food } from '../data/foods';
import { tokens, wordMatches } from './foodText';
import { macrosFor } from './nutrition';

export type Confidence = 'low' | 'medium' | 'high';
export type RawItem = { name: string; databaseName: string | null; searchTerm: string; grams: number; confidence: Confidence };
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

export const buildPrompt = (databaseNames: string[]) =>
  [
    'You are helping log a meal from a photo for a nutrition diary.',
    'List each distinct food or drink visible. Include Indian dishes by their common names (e.g. dal, roti, idli, sambar).',
    'For each item give:',
    '- name: short common name',
    '- database_name: copy EXACTLY one name from the DATABASE list below if it is a good match for the same food, otherwise null',
    '- search_term: 1-3 words to search a food database (e.g. "chicken biryani")',
    '- grams: your best estimate of the edible weight on the plate, in grams (use plate/hand/utensil size as scale; be realistic)',
    '- confidence: high, medium or low, for how sure you are about the food AND the portion',
    'Do NOT output calories or nutrients. If the image has no food, return an empty items list.',
    'In "notes" mention anything that makes the estimate harder (hidden oil, sauces, mixed dishes, unclear scale).',
    '',
    'DATABASE:',
    ...databaseNames.map((n) => `- ${n}`),
  ].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
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
    });
  }
  return { items, notes: typeof data.notes === 'string' ? data.notes : '' };
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
