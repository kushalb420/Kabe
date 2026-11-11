// Search over Kabe's built-in everyday foods (works offline). Everything else is looked up by Gemini (see mealAi.ts).
import { FOODS, Food } from '../data/foods';
import { tokens, wordMatches } from './foodText';

const INDEX = FOODS.map((food) => ({ food, toks: tokens(food.name) }));

/**
 * Every query word must match a word in the food's name (prefix allowed while typing).
 * Shorter, more generic names rank first.
 */
export function searchFoods(query: string, limit = 25): Food[] {
  const q = tokens(query);
  if (!q.length) return [];
  const hits = INDEX.filter((e) => q.every((w) => wordMatches(w, e.toks, true))).map((e) => ({ e, extra: e.toks.length - q.length }));
  hits.sort((a, b) => a.extra - b.extra || a.e.food.name.length - b.e.food.name.length);
  return hits.slice(0, limit).map((h) => h.e.food);
}
