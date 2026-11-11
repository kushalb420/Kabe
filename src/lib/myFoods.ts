// "My foods": everything the person has logged before, as foods they can log again (pure, tested in scripts/test-myfoods.ts).
// There is no built-in food list. New foods come from describing a meal or taking a photo; this is for repeats.
import type { Food } from '../data/foods';

export type LoggedEntry = {
  id: string;
  date: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  satFat?: number;
  foodId?: string;
};

const key = (e: Pick<LoggedEntry, 'name' | 'foodId'>) => e.foodId ?? `hist-${e.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
const per100 = (v: number, grams: number) => Math.round(((v * 100) / grams) * 10) / 10;

/** One food per distinct name, rebuilt from its most recent log (per 100 g, with that log's amount as the serving). Newest first. */
export function foodsFromEntries(entries: LoggedEntry[]): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  const newest = [...entries].filter((e) => e.grams > 0 && e.name.trim()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
  for (const e of newest) {
    const id = key(e);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: e.name.trim(),
      category: 'Logged',
      kcal: Math.round((e.kcal * 100) / e.grams),
      protein: per100(e.protein, e.grams),
      carbs: per100(e.carbs, e.grams),
      fat: per100(e.fat, e.grams),
      ...(e.fiber !== undefined ? { fiber: per100(e.fiber, e.grams) } : {}),
      ...(e.sugar !== undefined ? { sugar: per100(e.sugar, e.grams) } : {}),
      ...(e.satFat !== undefined ? { satFat: per100(e.satFat, e.grams) } : {}),
      servingG: Math.round(e.grams),
      servingLabel: `${Math.round(e.grams)} g`,
    });
  }
  return out;
}

/** Matches every typed word against the food's name (prefix allowed), so "chick" finds "Chicken curry". */
export function searchMine(foods: Food[], query: string): Food[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return foods;
  return foods.filter((f) => {
    const name = f.name.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
    return words.every((w) => name.some((n) => n.startsWith(w)) || f.name.toLowerCase().includes(w));
  });
}

/** One item of a saved meal (or a logged entry) as a food of its own: per 100 g, with that amount as the serving. */
export function foodFromMealItem(it: Omit<LoggedEntry, 'id' | 'date'>): Food | null {
  return foodsFromEntries([{ ...it, id: 'x', date: '' }])[0] ?? null;
}
