// The network side of meal understanding: one Gemini call per typed list, photo, recording or food search.
// All parsing and checking is in gemFood.ts (pure, tested); `ask` is injectable so tests never touch the network.
import type { Food } from '../data/foods';
import { FOOD_SCHEMA, MEAL_SCHEMA, MealItem, buildFoodPrompt, buildMealPhotoPrompt, mergeMealItems, buildMealTextPrompt, itemGrams, parseFood, parseMeal, setGrams, withStatedAmounts } from './gemFood';
import { FoodMemory, Known, memKey, parseClause, resolveText } from './foodMemory';
import { CacheClient, getSharedFoods, putSharedFood } from './sharedCache';
import { PHOTO_MODELS } from './photo';
import { askJson } from './vision';

/** Photos get the strongest model first (the lighter ones are the fallback). */
const askPhoto: Ask = (key, input, schema) => askJson(key, input, schema, undefined, PHOTO_MODELS);

export type MealResult = { items: MealItem[]; meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null };
type Ask = (key: string, input: unknown, schema: object) => Promise<unknown>;

const AUDIO_PROMPT_NOTE = 'Listen to the recording and treat what you hear as the list of what the person ate or drank. ';

export async function analyzeMealText(key: string, text: string, ask: Ask = askJson): Promise<MealResult> {
  const r = parseMeal(await ask(key, buildMealTextPrompt(text), MEAL_SCHEMA));
  return { ...r, items: withStatedAmounts(r.items, text) }; // an amount the person typed is never asked about again
}

export async function analyzeMealPhoto(key: string, base64: string, mime: string, ask: Ask = askPhoto, note = ''): Promise<MealResult> {
  const r = parseMeal(await ask(key, [{ type: 'text', text: buildMealPhotoPrompt(note) }, { type: 'image', data: base64, mime_type: mime }], MEAL_SCHEMA));
  const m = mergeMealItems(r.items); // a food the AI listed twice, or an ingredient of a dish already listed, counts once
  return { ...r, items: m.items };
}

export async function analyzeMealAudio(key: string, base64: string, mime: string, ask: Ask = askJson): Promise<MealResult> {
  const prompt = AUDIO_PROMPT_NOTE + buildMealTextPrompt('(the words are in the recording)');
  return parseMeal(await ask(key, [{ type: 'text', text: prompt }, { type: 'audio', data: base64, mime_type: mime }], MEAL_SCHEMA));
}

/** One food or dish for the search box and other lookups; null when it is not a food. */
export async function lookupFood(key: string, query: string, ask: Ask = askJson): Promise<Food | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  return parseFood(await ask(key, buildFoodPrompt(q), FOOD_SCHEMA), q);
}

/**
 * Work an item out again with an extra detail the person added after seeing it ("loose", "only 45 g is paneer").
 * The amount they have set stays; only the nutrition and the note change. Returns null if nothing usable came back.
 */
export async function refineItem(key: string, item: MealItem, detail: string, ask: Ask = askJson): Promise<MealItem | null> {
  const d = detail.trim();
  if (!d) return null;
  const amount = `${item.count} ${item.unit}`;
  const r = parseMeal(await ask(key, buildMealTextPrompt(`${item.name} ${amount} (${d.slice(0, 200)})`), MEAL_SCHEMA));
  const n = r.items[0];
  if (!n) return null;
  const note = [item.note, d].filter(Boolean).join('; ').slice(0, 160);
  // keep the person's amount: scale to the same grams, with the new nutrition
  return { ...n, id: item.id, name: item.name, unit: item.unit, unitGrams: item.unitGrams, count: item.count, stated: item.stated, note };
}

/**
 * Replace an item with a different food (the scan got it wrong). The amount in grams stays what it was, so only the food and
 * its nutrition change. Returns null if nothing usable came back.
 */
export async function swapItem(key: string, item: MealItem, newName: string, ask: Ask = askJson): Promise<MealItem | null> {
  const name = newName.trim().slice(0, 80);
  if (!name) return null;
  const grams = itemGrams(item);
  const r = parseMeal(await ask(key, buildMealTextPrompt(`${Math.max(grams, 1)} g ${name}`), MEAL_SCHEMA));
  const n = r.items[0];
  if (!n) return null;
  return { ...setGrams(n, grams), id: item.id, note: '', stated: item.stated };
}

/**
 * A typed meal, using what Kabe already knows. Foods in the person's own memory, and foods other people's lookups already worked out
 * (the shared cache), are built without the AI; only the foods nobody has seen are sent to it, and what it answers is added to the
 * shared cache for the next person. If every food is known, no request is made at all.
 */
export async function analyzeMealTextSmart(
  key: string,
  text: string,
  mem: FoodMemory,
  shared: CacheClient | null,
  ask: Ask = askJson,
): Promise<MealResult & { aiCalls: number }> {
  let { known, unknown } = resolveText(text, mem);
  if (unknown.length) {
    // the community cache, one request for every unknown food
    const wanted = unknown.map((u) => memKey(parseClause(u).name)).filter(Boolean);
    const hits = await getSharedFoods(shared, wanted);
    if (Object.keys(hits).length) {
      const more = resolveText(unknown.join(', '), hits as Record<string, Known>);
      known = [...known, ...more.known];
      unknown = more.unknown;
    }
  }
  if (!unknown.length) return { items: known, meal: null, aiCalls: 0 };
  const asked = unknown.join(', ');
  const r = await analyzeMealText(key, asked, ask);
  // share what the AI just worked out (plain foods only: an item with a detail note is a one-off variant)
  for (const it of r.items) {
    if (it.note) continue;
    const k = memKey(it.name);
    if (k) void putSharedFood(shared, k, { name: it.name, unit: it.unit === 'g' || it.unit === 'ml' ? 'serving' : it.unit, unitGrams: it.unit === 'g' || it.unit === 'ml' ? 100 : it.unitGrams, per100: it.per100, n: 1, at: Date.now() });
  }
  return { items: [...known, ...r.items], meal: r.meal, aiCalls: 1 };
}
