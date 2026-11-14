// The network side of meal understanding: one Gemini call per typed list, photo, recording or food search.
// All parsing and checking is in gemFood.ts (pure, tested); `ask` is injectable so tests never touch the network.
import type { Food } from '../data/foods';
import { FOOD_SCHEMA, MEAL_SCHEMA, MealItem, buildFoodPrompt, buildMealPhotoPrompt, buildMealTextPrompt, itemGrams, parseFood, parseMeal, setGrams, withStatedAmounts } from './gemFood';
import { askJson } from './vision';

export type MealResult = { items: MealItem[]; meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null };
type Ask = (key: string, input: unknown, schema: object) => Promise<unknown>;

const AUDIO_PROMPT_NOTE = 'Listen to the recording and treat what you hear as the list of what the person ate or drank. ';

export async function analyzeMealText(key: string, text: string, ask: Ask = askJson): Promise<MealResult> {
  const r = parseMeal(await ask(key, buildMealTextPrompt(text), MEAL_SCHEMA));
  return { ...r, items: withStatedAmounts(r.items, text) }; // an amount the person typed is never asked about again
}

export async function analyzeMealPhoto(key: string, base64: string, mime: string, ask: Ask = askJson, note = ''): Promise<MealResult> {
  return parseMeal(await ask(key, [{ type: 'text', text: buildMealPhotoPrompt(note) }, { type: 'image', data: base64, mime_type: mime }], MEAL_SCHEMA));
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
