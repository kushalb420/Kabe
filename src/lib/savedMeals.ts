// Saved meals: what kind of diet a meal suits, filtering by it, and adding a food to a meal (pure, tested in scripts/test-savedmeals.ts).
import type { Food } from '../data/foods';
import { macrosFor } from './nutrition';
import type { SavedMeal, SavedMealItem } from '../store/kabe';

export type SavedDiet = 'vegan' | 'veg' | 'egg' | 'nonveg';
export const SAVED_DIETS: SavedDiet[] = ['vegan', 'veg', 'egg', 'nonveg'];

export const isSavedDiet = (v: unknown): v is SavedDiet => typeof v === 'string' && (SAVED_DIETS as string[]).includes(v);

/** The saved meals that suit a diet filter. `null` shows every meal; meals with no diet set only show under "All". */
export function filterMeals<T extends { diet?: SavedDiet }>(meals: T[], diet: SavedDiet | null): T[] {
  return diet ? meals.filter((m) => m.diet === diet) : meals;
}

/** The diets that at least one saved meal has, in the usual order (so the filter only offers choices that find something). */
export function dietsInUse(meals: Pick<SavedMeal, 'diet'>[]): SavedDiet[] {
  return SAVED_DIETS.filter((d) => meals.some((m) => m.diet === d));
}

/** A food from the picker becomes an item of a saved meal, at its usual serving unless an amount is given. */
export function foodToItem(food: Food, grams?: number): SavedMealItem {
  const g = grams && grams > 0 ? grams : food.servingG > 0 ? food.servingG : 100;
  return { ...macrosFor(food, g), name: food.name, grams: g, foodId: food.id, source: food.custom ? 'custom' : (food.source ?? 'database') };
}
