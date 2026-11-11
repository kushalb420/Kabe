// Which "keep under" nutrients went over their daily limit: free sugar, carbs, fat and saturated fat (pure, tested in
// scripts/test-limits.ts). Protein and fibre are never counted as "over": more of them is fine. Used for the small mark on
// Today's bars and for the coach.
import { NUTRITION } from '../config/app';
import type { Macros } from './nutrition';

export type Limit = 'sugar' | 'carbs' | 'fat' | 'satFat';
export const LIMITS: Limit[] = ['sugar', 'carbs', 'fat', 'satFat'];

type Eaten = { date?: string; carbs: number; fat: number; sugar?: number; satFat?: number };

/** The daily limit of each, in grams. Free sugar and saturated fat are a share of the calorie goal. */
export function limitGoals(goals: Macros): Record<Limit, number> {
  return {
    sugar: (goals.kcal * NUTRITION.freeSugarMaxPctKcal) / 100 / NUTRITION.kcalPerGramSugar,
    carbs: goals.carbs,
    fat: goals.fat,
    satFat: (goals.kcal * NUTRITION.satFatMaxPctKcal) / 100 / NUTRITION.kcalPerGramFat,
  };
}

/** What was eaten of each (an amount that was never recorded counts as nothing, never as a guess). */
export function limitTotals(entries: Eaten[]): Record<Limit, number> {
  const t: Record<Limit, number> = { sugar: 0, carbs: 0, fat: 0, satFat: 0 };
  for (const e of entries) {
    t.sugar += e.sugar ?? 0;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.satFat += e.satFat ?? 0;
  }
  return t;
}

/** The limits that are passed, with by how many grams (rounded). A small margin is allowed so 100.2% is not "over". */
export function overLimits(totals: Record<Limit, number>, goals: Macros): { key: Limit; overG: number }[] {
  const g = limitGoals(goals);
  return LIMITS.filter((k) => g[k] > 0 && totals[k] > g[k] * 1.01).map((k) => ({ key: k, overG: Math.round(totals[k] - g[k]) }));
}

const NAMES: Record<Limit, string> = { sugar: 'free sugar', carbs: 'carbs', fat: 'fat', satFat: 'saturated fat' };

/** For the coach: what is over today, and on how many of the last seven days (only days with food logged count). */
export function exceedSummary(entries: (Eaten & { date: string })[], goals: Macros, today: string, days: string[]) {
  const todays = overLimits(limitTotals(entries.filter((e) => e.date === today)), goals).map((o) => ({ nutrient: NAMES[o.key], overByG: o.overG }));
  const counts: Record<string, number> = {};
  let logged = 0;
  for (const d of days) {
    const day = entries.filter((e) => e.date === d);
    if (day.length === 0) continue;
    logged++;
    for (const o of overLimits(limitTotals(day), goals)) counts[NAMES[o.key]] = (counts[NAMES[o.key]] ?? 0) + 1;
  }
  return { overToday: todays, daysOverInLast7: counts, daysLoggedInLast7: logged };
}
