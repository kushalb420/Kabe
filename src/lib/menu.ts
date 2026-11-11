// Restaurant menus. Like the plate photo, the AI model only READS dish names (and guesses a typical serving in grams)
// from a menu photo; it is never asked for calories. Nutrition comes from the same lookup chain as plate photos
// (bundled USDA → packaged averages → web pages → a clearly labelled AI estimate) and is always shown as a range,
// because a restaurant's real recipe, oil and portion are unknown.
import type { Food } from '../data/foods';
import { nativeToEnglish } from '../data/nativeFoods';
import { Confidence, MODELS, Manual, PhotoItem, RawItem, effectiveMacros, itemUncertainty } from './photo';
import type { SavedMealItem } from '../store/kabe';

export type Veg = 'veg' | 'egg' | 'nonveg' | 'unknown';
export type DietFilter = 'any' | 'egg' | 'veg';

/** A dish as read from the menu (or typed). */
export type MenuDish = { name: string; searchTerm: string; grams: number; veg: Veg; price: number | null; confidence: Confidence; kcal?: number | null };
/** A dish on the review screen: a PhotoItem (so the plate-photo lookup and editing code is reused) plus menu fields. */
export type MenuItem = PhotoItem & { veg: Veg; price: number | null; picked: boolean; /** calories of one basic serving, read with the menu (used to rank instantly) */ quickKcal?: number | null };

const MAX_DISHES = 60;
export const DEFAULT_PORTION_G = 250;

// ---------------------------------------------------------------- reading a menu photo
export const buildMenuPrompt = () =>
  [
    'You are reading a restaurant menu photo so a person can see which dishes fit their diet.',
    'List each distinct dish or drink printed on the menu (at most 40; skip headings, offers and addresses).',
    'For each dish give:',
    '- name: the dish name as printed (keep Indian dish names as they are written)',
    '- search_term: 1-3 plain English words to search a food database (e.g. "paneer butter masala")',
    '- grams: a typical restaurant serving of that dish in grams (a curry bowl is about 250-300, 2 rotis about 100, a biryani plate about 350, a soup about 250)',
    '- veg: "veg", "egg", "nonveg", or "unknown" (use the menu\'s veg/non-veg marks or the ingredients; "unknown" if you cannot tell)',
    '- price: the printed price as a number, or null if none is shown',
    '- kcal: calories in ONE such serving, a single best number (for example 450). Base it on standard food tables for the dish as served',
    '- confidence: high, medium or low, for how sure you are about the dish AND the serving size',
    'Only calories per serving are wanted, no other nutrients. If the image is not a menu, return an empty dishes list.',
  ].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    restaurant: { type: ['string', 'null'] },
    dishes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          search_term: { type: 'string' },
          grams: { type: 'number' },
          veg: { type: 'string', enum: ['veg', 'egg', 'nonveg', 'unknown'] },
          price: { type: ['number', 'null'] },
          kcal: { type: ['number', 'null'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'search_term', 'grams'],
      },
    },
  },
  required: ['dishes'],
};

export const buildMenuRequest = (model: string, base64: string, mime: string) => ({
  model,
  input: [
    { type: 'text', text: buildMenuPrompt() },
    { type: 'image', data: base64, mime_type: mime },
  ],
  response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
});

export { MODELS };

type Step = { type?: string; content?: { type?: string; text?: string }[] };

export const cleanKcal = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : NaN;
  return isFinite(n) && n >= 10 && n <= 3500 ? Math.round(n) : null;
};

const cleanPrice = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : NaN;
  return isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};

/** Validate the model's JSON: drop nonsense and duplicates instead of trusting it. */
export function parseMenuResponse(json: unknown): { restaurant: string; dishes: MenuDish[] } {
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
  let data: { dishes?: unknown; restaurant?: unknown };
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('The AI answer was not valid JSON. Try again.');
  }
  if (!Array.isArray(data.dishes)) throw new Error('The AI answer was missing the dish list.');
  const seen = new Set<string>();
  const dishes: MenuDish[] = [];
  for (const d of data.dishes as Record<string, unknown>[]) {
    const name = typeof d.name === 'string' ? d.name.trim().slice(0, 80) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const g = Number(d.grams);
    const grams = isFinite(g) && g >= 30 && g <= 1500 ? Math.round(g) : DEFAULT_PORTION_G; // a missing/absurd serving falls back to a typical one
    const veg: Veg = d.veg === 'veg' || d.veg === 'egg' || d.veg === 'nonveg' ? d.veg : 'unknown';
    const known = isFinite(g) && g >= 30 && g <= 1500;
    const conf: Confidence = !known ? 'low' : d.confidence === 'high' || d.confidence === 'medium' ? d.confidence : 'low';
    dishes.push({
      name,
      searchTerm: typeof d.search_term === 'string' && d.search_term.trim() ? d.search_term.trim().slice(0, 60) : name,
      grams,
      veg,
      price: cleanPrice(d.price),
      confidence: conf,
      kcal: cleanKcal(d.kcal),
    });
    if (dishes.length >= MAX_DISHES) break;
  }
  return { restaurant: typeof data.restaurant === 'string' ? data.restaurant.trim().slice(0, 60) : '', dishes };
}

// ---------------------------------------------------------------- typing what you ordered (no AI needed)
const PORTIONS: [RegExp, number][] = [
  [/\b(naan|roti|chapati|chapathi|phulka|paratha|kulcha|puri|poori|bhatura|dosa|uttapam|idli|vada|toast|bun|pav)\b/, 80],
  [/\b(biryani|biriyani|pulao|fried rice|khichdi|rice|noodles|pasta|thali|meals)\b/, 320],
  [/\b(soup|rasam|sambar|dal|daal|lentil)\b/, 250],
  [/\b(salad|raita|papad|pickle)\b/, 120],
  [/\b(juice|lassi|shake|smoothie|cola|soda|lemonade|coffee|tea|chai|milk|buttermilk|chaas|beer|wine)\b/, 250],
  [/\b(ice cream|gulab jamun|jalebi|halwa|kheer|cake|brownie|rasgulla|dessert|sweet|pudding)\b/, 110],
  [/\b(fries|samosa|pakora|pakoda|tikka|kebab|kabab|momos|spring roll|nuggets|wings|starter|chaat)\b/, 150],
  [/\b(burger|sandwich|wrap|roll|pizza)\b/, 220],
];

/** A rough typical serving for a dish name. Only a starting point: the user edits it. */
export function typicalPortionG(name: string): number {
  const n = nativeToEnglish(name).toLowerCase();
  for (const [re, g] of PORTIONS) if (re.test(n)) return g;
  return DEFAULT_PORTION_G;
}

/** "2 naan, butter chicken; lassi" → dishes. A leading number multiplies the typical serving (capped at 20). */
export function dishesFromText(text: string): MenuDish[] {
  const parts = text
    .split(/[\n,;+]|\band\b|&/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: MenuDish[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s*(.+)$/i);
    const qty = m ? Math.min(20, Math.max(0.5, parseFloat(m[1]))) : 1;
    const name = (m ? m[2] : p).trim().slice(0, 80);
    if (!name || name.length < 2) continue;
    out.push({ name, searchTerm: name, grams: Math.round(typicalPortionG(name) * qty), veg: 'unknown', price: null, confidence: 'low' });
    if (out.length >= MAX_DISHES) break;
  }
  return out;
}

/** A dish becomes a reviewable item. Restaurant servings are never better than "medium" confidence. */
export const dishToItem = (d: MenuDish, id: string): MenuItem => {
  const raw: RawItem = { name: d.name, databaseName: null, searchTerm: d.searchTerm, grams: d.grams, confidence: d.confidence === 'high' ? 'medium' : d.confidence };
  return { ...raw, id, food: null, veg: d.veg, price: d.price, picked: false, quickKcal: d.kcal ?? null };
};

// ---------------------------------------------------------------- ranking: which dishes fit me?
export type Tag = 'highProtein' | 'light' | 'fits' | 'heavy' | 'noData';
export type Ranked = { item: MenuItem; macros: Manual | null; tag: Tag; score: number };

/** veg diners never see dishes known to be egg or meat; "unknown" is kept (the screen warns to check the menu). */
export function allowedByDiet(veg: Veg, diet: DietFilter): boolean {
  if (diet === 'any') return true;
  if (diet === 'veg') return veg === 'veg' || veg === 'unknown';
  return veg !== 'nonveg';
}

export function tagFor(m: Manual, mealKcal: number): Tag {
  const share = m.kcal > 0 ? (m.protein * 4) / m.kcal : 0;
  if (m.kcal > mealKcal * 1.3) return 'heavy';
  if (m.protein >= 25 && share >= 0.25) return 'highProtein';
  if (m.kcal <= mealKcal * 0.6) return 'light';
  return 'fits';
}

/**
 * Order dishes for someone who wants a meal of about `mealKcal`: protein-rich dishes near that size first, heavy dishes last.
 * Dishes without nutrition numbers yet keep their menu order at the end (never guessed).
 */
export function rankMenu(items: MenuItem[], mealKcal: number, diet: DietFilter = 'any'): Ranked[] {
  const target = Math.max(250, mealKcal);
  const rows: Ranked[] = items
    .filter((i) => allowedByDiet(i.veg, diet))
    .map((item) => {
      const macros = effectiveMacros(item);
      if (!macros) return { item, macros, tag: 'noData' as Tag, score: -1 };
      const share = macros.kcal > 0 ? Math.min(1, (macros.protein * 4) / macros.kcal) : 0;
      const closeness = Math.max(0, 1 - Math.abs(macros.kcal - target) / target);
      const over = macros.kcal > target * 1.3 ? 0.5 : 0;
      return { item, macros, tag: tagFor(macros, target), score: 0.6 * share + 0.4 * closeness - over };
    });
  const known = rows.filter((r) => r.macros).sort((a, b) => b.score - a.score);
  return [...known, ...rows.filter((r) => !r.macros)];
}

/**
 * Instant ranking, no AI and no waiting: dishes in order of the calories of their basic serving (lightest first, or heaviest first).
 * Dishes without a number go last. Once you pick a dish and its full nutrition is known, that number is used instead.
 */
export function rankByCalories(items: MenuItem[], mealKcal: number, diet: DietFilter = 'any', heaviestFirst = false): { item: MenuItem; kcal: number | null; tag: Tag }[] {
  const rows = items
    .filter((i) => allowedByDiet(i.veg, diet))
    .map((item) => {
      const kcal = effectiveMacros(item)?.kcal ?? item.quickKcal ?? null;
      const tag: Tag = kcal === null ? 'noData' : kcal > Math.max(250, mealKcal) * 1.3 ? 'heavy' : kcal <= Math.max(250, mealKcal) * 0.6 ? 'light' : 'fits';
      return { item, kcal, tag };
    });
  const known = rows.filter((r) => r.kcal !== null).sort((a, b) => (heaviestFirst ? (b.kcal as number) - (a.kcal as number) : (a.kcal as number) - (b.kcal as number)));
  return [...known, ...rows.filter((r) => r.kcal === null)];
}

/** No single restaurant meal is ranked against more than this, even when most of the day is still left. */
export const MAX_MEAL_KCAL = 900;

/** How many kcal a single meal could be: what is left today split over the meals still to eat (1 to 3), never above MAX_MEAL_KCAL. */
export function mealBudget(kcalLeft: number, mealsLeft: number): number {
  const n = Math.min(3, Math.max(1, Math.round(mealsLeft)));
  return Math.min(MAX_MEAL_KCAL, Math.max(0, Math.round(kcalLeft / n)));
}

// ---------------------------------------------------------------- guarding against wrong matches
/**
 * A dish on a menu is cooked and served, so a database entry for the DRY ingredient ("Lentils, raw", "Wheat flour",
 * "Rice, uncooked") would make it look 3× too heavy. Such entries are never used for a dish.
 */
export function isRawIngredient(f: Pick<Food, 'name'>): boolean {
  const n = f.name.toLowerCase();
  if (/\b(cooked|boiled|prepared|baked|fried|grilled|roasted|steamed)\b/.test(n)) return false;
  return /\b(raw|dry|dried|dehydrated|uncooked|flour|powder|meal|seeds?|mix|concentrate|unprepared)\b/.test(n);
}

/** Wrap a food search so it never returns raw ingredients (see isRawIngredient). */
export const forDishes = (fn: (q: string) => Promise<Food[]>) => async (q: string): Promise<Food[]> => (await fn(q)).filter((f) => !isRawIngredient(f));

/** Restaurant recipes, oil and portions are unknown, so a dish is never treated as more certain than ±35%. Numbers you typed count as nearly exact. */
export const RESTAURANT_MIN_UNCERTAINTY = 0.35;
export const dishUncertainty = (it: MenuItem): number => (it.manual ? 0.1 : Math.max(RESTAURANT_MIN_UNCERTAINTY, itemUncertainty(it)));

// ---------------------------------------------------------------- the order
export type OrderTotals = { kcal: number; kcalLow: number; kcalHigh: number; protein: number; carbs: number; fat: number; dishes: number; missing: number; price: number; unpriced: number };

export function orderTotals(items: MenuItem[]): OrderTotals {
  const t: OrderTotals = { kcal: 0, kcalLow: 0, kcalHigh: 0, protein: 0, carbs: 0, fat: 0, dishes: 0, missing: 0, price: 0, unpriced: 0 };
  for (const it of items.filter((i) => i.picked)) {
    t.dishes++;
    if (it.price) t.price += it.price;
    else t.unpriced++;
    const m = effectiveMacros(it);
    if (!m) {
      t.missing++;
      continue;
    }
    const u = dishUncertainty(it);
    t.kcal += m.kcal;
    t.kcalLow += m.kcal * (1 - u);
    t.kcalHigh += m.kcal * (1 + u);
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
  }
  t.price = Math.round(t.price * 100) / 100;
  return t;
}

/** Picked dishes that have numbers, as saved-meal items (so an order can be logged again in one tap). */
export function toSavedItems(items: MenuItem[]): SavedMealItem[] {
  const out: SavedMealItem[] = [];
  for (const it of items.filter((i) => i.picked)) {
    const m = effectiveMacros(it);
    if (!m) continue;
    out.push({ name: it.name, grams: it.grams, foodId: it.food?.id, source: 'restaurant', kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: 0 });
  }
  return out;
}

export const orderName = (restaurant: string, items: MenuItem[], fallback: string): string => {
  const picked = items.filter((i) => i.picked);
  const first = picked[0]?.name ?? '';
  const more = picked.length > 1 ? ` +${picked.length - 1}` : '';
  const base = `${first}${more}`.trim() || fallback;
  return restaurant.trim() ? `${restaurant.trim()} · ${base}` : base;
};
