// Meal plans from a menu (pure, tested in scripts/test-menuplan.ts).
// A day's calories are split 30% breakfast, 30% lunch, 10% snacks, 30% dinner. These are guides, never limits: a plan is a
// combination of dishes (some in more than one serving, like rotis, rice or curd) that comes close to the meal's share while giving
// a good share of protein, carbs and fibre and keeping fat low.
import type { MenuItem } from './menu';
import { effectiveMacros } from './photo';

export type MealKey = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_SHARE: Record<MealKey, number> = { breakfast: 0.3, lunch: 0.3, snack: 0.1, dinner: 0.3 };

/** The calories a meal is aiming for, from the day's goal. */
export const mealTarget = (dayKcal: number, meal: MealKey): number => Math.round(dayKcal * MEAL_SHARE[meal]);

export type Per = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
export type PlanLine = { item: MenuItem; qty: number; per: Per };
export type Plan = { lines: PlanLine[]; total: Per; score: number; tags: ('protein' | 'fibre' | 'lowFat')[] };

// dishes that are fine in more than one serving
const MULTI = /\b(phulka|phulkas|roti|rotis|chapati|chapatis|chapathi|rice|steamed rice|jeera rice|curd|dahi|raita|buttermilk|chaas|dal|daal|sambar|rasam|aloo jeera|jeera aloo|sabzi|sabji|salad|idli|idlis|papad|boiled egg|egg|vegetables|veg)\b/i;
// never part of a plan: sweets, drinks and fried snacks (they can still be picked by hand)
const SKIP = /\b(ice cream|gulab jamun|jalebi|halwa|kheer|cake|brownie|rasgulla|dessert|sweet|pudding|shake|cola|soda|juice|lassi|beer|wine|whisky|cocktail|fries|pakora|pakoda|samosa|fried|crispy|manchurian|nuggets|wings|cheese burst|tandoori coke)\b/i;

/** The macros of ONE serving of a dish from the menu, or null when the menu did not give enough to plan with. */
export function perServing(item: MenuItem): Per | null {
  const m = effectiveMacros(item);
  const kcal = m?.kcal ?? item.quickKcal ?? null;
  const protein = m?.protein ?? item.quickProtein ?? null;
  const carbs = m?.carbs ?? item.quickCarbs ?? null;
  const fat = m?.fat ?? item.quickFat ?? null;
  if (kcal === null || protein === null || carbs === null || fat === null || !(kcal > 0)) return null;
  const fiber = item.quickFiber ?? Math.max(0, Math.min(carbs * 0.12, 12)); // a modest guess when the menu gave no fibre
  return { kcal, protein, carbs, fat, fiber };
}

const maxQty = (name: string): number => (MULTI.test(name) ? 3 : 1);
const add = (a: Per, b: Per, q: number): Per => ({ kcal: a.kcal + b.kcal * q, protein: a.protein + b.protein * q, carbs: a.carbs + b.carbs * q, fat: a.fat + b.fat * q, fiber: a.fiber + b.fiber * q });
const ZERO: Per = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** How good a combination is for a meal of `target` kcal: 0 to 1. */
export function scorePlan(t: Per, target: number): number {
  if (!(t.kcal > 0)) return 0;
  const closeness = Math.max(0, 1 - Math.abs(t.kcal - target) / target);
  const pShare = (t.protein * 4) / t.kcal;
  const cShare = (t.carbs * 4) / t.kcal;
  const fShare = (t.fat * 9) / t.kcal;
  const protein = Math.min(1, pShare / 0.25); // about a quarter of calories from protein is plenty
  const carbs = cShare >= 0.45 && cShare <= 0.62 ? 1 : cShare < 0.45 ? Math.max(0, cShare / 0.45) : Math.max(0, 1 - (cShare - 0.62) / 0.2);
  const fibre = Math.min(1, t.fiber / Math.max(6, (target / 1000) * 14)); // 14 g per 1000 kcal
  const lowFat = fShare <= 0.25 ? 1 : Math.max(0, 1 - (fShare - 0.25) / 0.15);
  return 0.35 * closeness + 0.25 * protein + 0.15 * carbs + 0.15 * fibre + 0.1 * lowFat;
}

const tagsOf = (t: Per): Plan['tags'] => {
  const tags: Plan['tags'] = [];
  if ((t.protein * 4) / t.kcal >= 0.22) tags.push('protein');
  if (t.fiber >= 8) tags.push('fibre');
  if ((t.fat * 9) / t.kcal <= 0.25) tags.push('lowFat');
  return tags;
};

/**
 * Up to `count` different plans for a meal of `target` kcal, best first. A plan uses 2 to 4 dishes, never goes more than 3% over the
 * target, and is at least 70% of it. Dishes that are sweets, drinks or fried snacks are left out, and so are dishes without numbers.
 */
export function buildPlans(items: MenuItem[], target: number, count = 5): Plan[] {
  const pool = items
    .filter((i) => !SKIP.test(i.name))
    .map((item) => ({ item, per: perServing(item) }))
    .filter((x): x is { item: MenuItem; per: Per } => x.per !== null && x.per.kcal <= target * 1.03)
    // the most useful dishes first (protein and fibre for the calories, little fat), so the search stays small
    .sort((a, b) => dishQuality(b.per) - dishQuality(a.per))
    .slice(0, 14);
  const found: Plan[] = [];
  const limit = target * 1.03;
  const rec = (start: number, lines: PlanLine[], total: Per) => {
    if (lines.length >= 2 && total.kcal >= target * 0.7) {
      found.push({ lines: lines.map((l) => ({ ...l })), total, score: scorePlan(total, target), tags: tagsOf(total) });
      if (found.length > 600) {
        found.sort((a, b) => b.score - a.score); // keep the search light: only the best so far are kept
        found.length = 300;
      }
    }
    if (lines.length >= 4) return;
    for (let i = start; i < pool.length; i++) {
      const { item, per } = pool[i];
      for (let q = 1; q <= maxQty(item.name); q++) {
        const next = add(total, per, q);
        if (next.kcal > limit) break;
        rec(i + 1, [...lines, { item, qty: q, per }], next);
      }
    }
  };
  rec(0, [], ZERO);
  found.sort((a, b) => b.score - a.score);
  const picked: Plan[] = [];
  for (const p of found) {
    const names = new Set(p.lines.map((l) => l.item.id));
    const similar = picked.some((q) => {
      const other = new Set(q.lines.map((l) => l.item.id));
      const shared = [...names].filter((n) => other.has(n)).length;
      return shared / Math.max(names.size, other.size) > 0.5;
    });
    if (!similar) picked.push(p);
    if (picked.length >= count) break;
  }
  return picked;
}

function dishQuality(p: Per): number {
  const protein = Math.min(1, (p.protein * 4) / p.kcal / 0.3);
  const lowFat = Math.max(0, 1 - Math.max(0, (p.fat * 9) / p.kcal - 0.2) / 0.3);
  return 0.5 * protein + 0.3 * lowFat + 0.2 * Math.min(1, p.fiber / 6);
}
