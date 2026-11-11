// Nutrition statistics over a period (pure logic, tested in scripts/test-stats.ts).
// Honesty rule: a day with nothing logged is "no data", not "0 kcal", so it never drags an average down.
import { Macros, toDateKey } from './nutrition';

export type Period = 7 | 30 | 90;
export const PERIODS: Period[] = [7, 30, 90];

export type EntryLike = { date: string; kcal: number; protein: number; carbs: number; fat: number };
export type Day = { key: string; date: Date; kcal: number; protein: number; carbs: number; fat: number; logged: boolean };

const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** One row per calendar day, oldest first, ending on `endKey`. */
export function daysOf(entries: EntryLike[], endKey: string, length: number): Day[] {
  const byDay = new Map<string, EntryLike[]>();
  for (const e of entries) {
    const l = byDay.get(e.date);
    if (l) l.push(e);
    else byDay.set(e.date, [e]);
  }
  const end = parseKey(endKey);
  return Array.from({ length }, (_, i) => {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (length - 1 - i));
    const key = toDateKey(date);
    const list = byDay.get(key) ?? [];
    const sum = list.reduce((a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    return { key, date, ...sum, logged: sum.kcal > 0 };
  });
}

export type Bucket = { start: Date; days: number; loggedDays: number; kcal: number; protein: number; carbs: number; fat: number };

/** Group days into buckets of `size` (the last bucket may be shorter). Each bucket averages its LOGGED days only. */
export function bucketize(days: Day[], size: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = 0; i < days.length; i += size) {
    const part = days.slice(i, i + size);
    const logged = part.filter((d) => d.logged);
    const n = logged.length || 1;
    const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => logged.reduce((a, d) => a + d[k], 0) / n;
    out.push({ start: part[0].date, days: part.length, loggedDays: logged.length, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') });
  }
  return out;
}

/** Daily bars for a week, 5-day averages for a month, 15-day averages for three months (always 6–7 bars). */
export const bucketSize = (period: Period) => (period === 7 ? 1 : period === 30 ? 5 : 15);

export type Split = { protein: number; carbs: number; fat: number }; // percent of calories, sums to ~100

/** Share of calories from each macro (4/4/9 kcal per gram). Uses the macros' own energy, so it always sums to 100. */
export function macroSplit(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): Split | null {
  const p = m.protein * 4;
  const c = m.carbs * 4;
  const f = m.fat * 9;
  const total = p + c + f;
  if (!(total > 0)) return null;
  return { protein: (p / total) * 100, carbs: (c / total) * 100, fat: (f / total) * 100 };
}

export type Summary = {
  loggedDays: number;
  totalDays: number;
  avg: { kcal: number; protein: number; carbs: number; fat: number };
  daysOver: number; // more than 10% above the calorie goal
  daysProteinMet: number; // reached at least 90% of the protein goal
  best: { key: string; protein: number } | null;
};

export function summarize(days: Day[], goals: Pick<Macros, 'kcal' | 'protein'>): Summary {
  const logged = days.filter((d) => d.logged);
  const n = logged.length || 1;
  const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => logged.reduce((a, d) => a + d[k], 0) / n;
  let best: Summary['best'] = null;
  for (const d of logged) if (!best || d.protein > best.protein) best = { key: d.key, protein: d.protein };
  return {
    loggedDays: logged.length,
    totalDays: days.length,
    avg: { kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') },
    daysOver: logged.filter((d) => d.kcal > goals.kcal * 1.1).length,
    daysProteinMet: logged.filter((d) => d.protein >= goals.protein * 0.9).length,
    best,
  };
}

export type NoteCode = 'few' | 'over' | 'under' | 'protein' | 'steady';

/**
 * One plain observation (never medical advice). Needs at least 3 logged days, otherwise it only says there is too little data.
 * Averages are of logged days, so skipped days do not look like fasting.
 */
export function noteFor(s: Summary, goals: Pick<Macros, 'kcal' | 'protein'>): NoteCode {
  if (s.loggedDays < 3) return 'few';
  if (s.avg.kcal > goals.kcal * 1.1) return 'over';
  if (s.avg.kcal < goals.kcal * 0.75) return 'under';
  if (s.avg.protein < goals.protein * 0.85) return 'protein';
  return 'steady';
}

// ---------------------------------------------------------------- counts per day / per week (workouts, active minutes)
export type Count = { start: Date; value: number };

/**
 * `items` are things with a date and a value (a workout = 1, a walk = its minutes). For 7 days: one count per day.
 * For longer periods: only COMPLETE 7-day weeks counted back from `endKey` (30 → 4 weeks, 90 → 12), so no bar covers fewer days.
 */
export function countsPerBucket(items: { date: string; value: number }[], endKey: string, period: Period): Count[] {
  const size = period === 7 ? 1 : 7;
  const n = period === 7 ? 7 : Math.floor(period / 7);
  const end = parseKey(endKey);
  const out: Count[] = [];
  for (let b = n - 1; b >= 0; b--) {
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - b * size);
    const first = new Date(last.getFullYear(), last.getMonth(), last.getDate() - (size - 1));
    const a = toDateKey(first);
    const z = toDateKey(last);
    out.push({ start: first, value: items.filter((i) => i.date >= a && i.date <= z).reduce((s, i) => s + i.value, 0) });
  }
  return out;
}

// ---------------------------------------------------------------- weekly budget and breakdowns
export type RichEntry = { date: string; meal: string; name: string; kcal: number; protein: number; carbs: number; fat: number };

const dayKey = (d: Date) => toDateKey(d);

/** Monday of the week containing `key` (weeks run Monday to Sunday). */
export function mondayOf(key: string): string {
  const d = parseKey(key);
  const back = (d.getDay() + 6) % 7;
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back));
}

export type WeekBudget = {
  weekStart: string;
  daysElapsed: number; // Monday to today, inclusive
  daysLeft: number; // today included
  loggedDays: number;
  eatenKcal: number;
  budgetKcal: number; // 7 × daily goal
  remainingKcal: number; // can be negative
  perDayLeft: number; // what is left, spread over the days that remain (today included); 0 when over
  eatenProtein: number;
  budgetProtein: number;
};

/** The calorie and protein budget for the calendar week: 7 × your daily goal, how much is used, and what each remaining day can have. */
export function weekBudget(entries: RichEntry[], today: string, goal: { kcal: number; protein: number }): WeekBudget {
  const weekStart = mondayOf(today);
  const daysElapsed = Math.round((parseKey(today).getTime() - parseKey(weekStart).getTime()) / 86400000) + 1;
  const mine = entries.filter((e) => e.date >= weekStart && e.date <= today);
  const eatenKcal = mine.reduce((a, e) => a + e.kcal, 0);
  const budgetKcal = goal.kcal * 7;
  const remainingKcal = budgetKcal - eatenKcal;
  const daysLeft = 8 - daysElapsed;
  return {
    weekStart,
    daysElapsed,
    daysLeft,
    loggedDays: new Set(mine.filter((e) => e.kcal > 0).map((e) => e.date)).size,
    eatenKcal,
    budgetKcal,
    remainingKcal,
    perDayLeft: Math.max(0, remainingKcal / daysLeft),
    eatenProtein: mine.reduce((a, e) => a + e.protein, 0),
    budgetProtein: goal.protein * 7,
  };
}

export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealKey = (typeof MEAL_KEYS)[number];

/** Share of calories (percent) by meal over the rows given. Meals that are not one of the four count as snacks. */
export function mealShares(rows: Pick<RichEntry, 'meal' | 'kcal'>[]): Record<MealKey, number> {
  const sum: Record<MealKey, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const r of rows) sum[(MEAL_KEYS as readonly string[]).includes(r.meal) ? (r.meal as MealKey) : 'snack'] += r.kcal;
  const total = MEAL_KEYS.reduce((a, k) => a + sum[k], 0);
  return Object.fromEntries(MEAL_KEYS.map((k) => [k, total > 0 ? (sum[k] / total) * 100 : 0])) as Record<MealKey, number>;
}

export type Contributor = { name: string; amount: number; sharePct: number };

/** The foods that contributed most of a nutrient (same foods are added together by name), best first. */
export function topContributors(rows: RichEntry[], key: 'kcal' | 'protein' | 'carbs' | 'fat', n = 3): Contributor[] {
  const by = new Map<string, { name: string; amount: number }>();
  let total = 0;
  for (const r of rows) {
    const v = r[key];
    if (!(v > 0)) continue;
    total += v;
    const k = r.name.trim().toLowerCase();
    const cur = by.get(k);
    by.set(k, { name: cur?.name ?? r.name.trim(), amount: (cur?.amount ?? 0) + v });
  }
  return [...by.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
    .map((x) => ({ name: x.name, amount: Math.round(x.amount), sharePct: total > 0 ? Math.round((x.amount / total) * 100) : 0 }));
}
