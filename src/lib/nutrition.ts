import type { Food } from '../data/foods';

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
/** Optional extras. undefined means "unknown" — never treated as zero in the UI. */
export type Extras = { sugar?: number; sodium?: number; satFat?: number }; // sugar = free sugar: ADDED sugar only (sugar, jaggery, honey, syrups, sweetened products), not the natural sugar in fruit or milk

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export const macrosFor = (food: Food, grams: number): Macros & Extras => {
  const k = grams / 100;
  return {
    kcal: food.kcal * k,
    protein: food.protein * k,
    carbs: food.carbs * k,
    fat: food.fat * k,
    fiber: (food.fiber ?? 0) * k,
    sugar: food.sugar === undefined ? undefined : food.sugar * k,
    satFat: food.satFat === undefined ? undefined : food.satFat * k,
    sodium: food.sodium === undefined ? undefined : food.sodium * k,
  };
};

const mul = (v: number | undefined, k: number) => (v === undefined ? undefined : v * k);

/** Rescale a logged item's macros to a new gram amount. */
export const scaleToGrams = <T extends Macros & Extras & { grams: number }>(item: T, grams: number): T => {
  if (!(item.grams > 0) || !(grams > 0)) return item;
  const k = grams / item.grams;
  return {
    ...item,
    grams,
    kcal: item.kcal * k,
    protein: item.protein * k,
    carbs: item.carbs * k,
    fat: item.fat * k,
    fiber: item.fiber * k,
    sugar: mul(item.sugar, k),
    satFat: mul(item.satFat, k),
    sodium: mul(item.sodium, k),
  };
};

export const sumMacros = (list: Macros[]): Macros =>
  list.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
      fiber: a.fiber + m.fiber,
    }),
    ZERO,
  );

/** Sum an optional field over items; `covered` = how many items actually had data. */
export const sumOptional = (list: Extras[], key: keyof Extras) => {
  let total = 0;
  let covered = 0;
  for (const it of list) {
    const v = it[key];
    if (v !== undefined) {
      total += v;
      covered++;
    }
  }
  return { total, covered, of: list.length };
};

export type Profile = {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'active';
  goal: 'lose' | 'maintain' | 'gain';
  /** Optional: the weight the person wants to reach. When set, the goal (lose, maintain or gain) follows from it. */
  targetKg?: number;
  /** Optional: how many of the calories come from carbs. Unset keeps the usual balanced split. */
  carbLevel?: CarbLevel;
  /** Optional: in how many weeks the person wants to reach the target weight. Sets how big the daily calorie change is. */
  weeks?: number;
};

export type CarbLevel = 'low' | 'mid' | 'high';
/** Share of the day's calories that come from carbs at each level. */
export const CARB_SHARE: Record<CarbLevel, number> = { low: 0.2, mid: 0.4, high: 0.55 };
/** Least share of calories from protein: higher on low carb, the same on medium and high carb (usual 25-30% on low carb, 20-25% otherwise). */
export const PROTEIN_SHARE: Record<CarbLevel, number> = { low: 0.3, mid: 0.22, high: 0.22 };

export const DEFAULT_PROFILE: Profile = { sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' };

const ACTIVITY ={ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

/** Grams of protein per kg of body weight for each goal. */
export const PROTEIN_PER_KG = { lose: 1.8, maintain: 2, gain: 2.2 } as const;
/** Protein is never set above this many grams per kg of body weight. */
export const MAX_PROTEIN_PER_KG = 2.2;

/** Split a calorie target into macros: protein by body weight and goal, fat ~27% of calories, carbs the rest. */
export const macrosForCalories = (kcal: number, weightKg: number, goal: Profile['goal'], carbLevel?: CarbLevel): Macros => {
  const protein = Math.min(Math.round(weightKg * PROTEIN_PER_KG[goal]), Math.round(weightKg * MAX_PROTEIN_PER_KG), Math.round((kcal * 0.35) / 4));
  if (!carbLevel) {
    let fat = Math.round((kcal * 0.27) / 9);
    if (kcal - protein * 4 - fat * 9 < kcal * 0.25) fat = Math.max(Math.round((kcal * 0.2) / 9), Math.round((kcal * 0.75 - protein * 4) / 9)); // keep carbs at least a quarter of the calories when fat can give a little
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, carbs, fat, fiber: 30 };
  }
  // a chosen carb level. Protein: by body weight, but low carb eats more of it (a larger share of calories, as in usual
  // low-carb plans), while medium and high carb share the same protein. Carbs take their share, and fat takes the rest.
  const share = PROTEIN_SHARE[carbLevel];
  const p = Math.min(Math.max(protein, Math.round((kcal * share) / 4)), Math.round((kcal * 0.35) / 4));
  let carbs = Math.round((kcal * CARB_SHARE[carbLevel]) / 4);
  let fat = Math.round((kcal - p * 4 - carbs * 4) / 9);
  const minFat = Math.round((kcal * 0.2) / 9); // fat is needed for health: never below a fifth of the calories
  if (fat < minFat) {
    fat = minFat;
    carbs = Math.max(0, Math.round((kcal - p * 4 - fat * 9) / 4));
  }
  const fiber = Math.min(38, Math.max(25, Math.round((kcal / 1000) * 14)));
  return { kcal, protein: p, carbs, fat, fiber };
};

/** Mifflin-St Jeor estimate of daily energy use (TDEE). A starting point only, not medical advice. */
export const formulaTdee = (p: Profile): number => {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  return bmr * ACTIVITY[p.activity];
};

export const GOAL_ADJUST = { lose: -400, maintain: 0, gain: 300 } as const;
/** Kabe never suggests eating below these without professional guidance. */
export const MIN_KCAL = { female: 1200, male: 1500 } as const;

/** Within this many kg of the target counts as "at the target". */
export const AT_TARGET_KG = 1;
/** A steady, safe pace: about half a kilo a week to lose, a quarter to gain. */
export const PACE_KG_WEEK = { lose: 0.45, gain: 0.25 } as const;

/** The goal that follows from the target weight, or the chosen goal when there is no target. */
export const goalFor = (p: Profile): Profile['goal'] => {
  if (!p.targetKg || !(p.targetKg > 0)) return p.goal;
  const diff = p.targetKg - p.weightKg;
  return Math.abs(diff) < AT_TARGET_KG ? 'maintain' : diff < 0 ? 'lose' : 'gain';
};

/** About how many weeks the target takes at a steady pace; null when there is no target or nothing to change. */
export const weeksToTarget = (p: Profile): number | null => {
  const g = goalFor(p);
  if (!p.targetKg || g === 'maintain') return null;
  return Math.max(1, Math.round(Math.abs(p.targetKg - p.weightKg) / PACE_KG_WEEK[g]));
};

/** About how many calories one kilo of body weight is worth. */
export const KCAL_PER_KG = 7700;
const DAY_PER_KG_WEEK = KCAL_PER_KG / 7; // calories a day for each kg a week

/** The fastest steady rate (kg a week) that is still safe: losing at most 1% of body weight (never over 1 kg) and a quarter of the day's energy; gaining at most half a percent. */
export const maxRateKgWeek = (p: Profile): number => {
  const goal = goalFor(p);
  if (goal === 'maintain') return 0;
  if (goal === 'gain') return Math.min(0.5, 0.005 * p.weightKg);
  const tdee = formulaTdee(p);
  return Math.max(0.1, Math.min(1, 0.01 * p.weightKg, (0.25 * tdee) / DAY_PER_KG_WEEK, (tdee - MIN_KCAL[p.sex]) / DAY_PER_KG_WEEK));
};

export type PlanOption = { weeks: number; kgPerWeek: number; kcal: number; recommended: boolean };

/** Daily calories for reaching the target in `weeks` weeks (the rate is kept inside the safe range). */
export const kcalForWeeks = (p: Profile, weeks: number): { kcal: number; kgPerWeek: number } => {
  const goal = goalFor(p);
  const tdee = formulaTdee(p);
  if (!p.targetKg || goal === 'maintain') return { kcal: Math.round(tdee / 10) * 10, kgPerWeek: 0 };
  const diff = Math.abs(p.targetKg - p.weightKg);
  const rate = Math.min(diff / Math.max(1, weeks), maxRateKgWeek(p));
  const perDay = rate * DAY_PER_KG_WEEK;
  const raw = goal === 'lose' ? tdee - perDay : tdee + Math.min(perDay, 500);
  return { kcal: Math.max(Math.round(raw / 10) * 10, goal === 'lose' ? MIN_KCAL[p.sex] : 0), kgPerWeek: Math.round(rate * 100) / 100 };
};

const WEEK_CHOICES = [4, 6, 8, 12, 16, 20, 24, 32, 40, 52, 64, 78, 104];

/** A few time frames to reach the target weight (only safe ones), with the calories each needs. Empty when there is nothing to reach. */
export const planOptions = (p: Profile): PlanOption[] => {
  const goal = goalFor(p);
  if (!p.targetKg || goal === 'maintain') return [];
  const diff = Math.abs(p.targetKg - p.weightKg);
  const fastest = Math.ceil(diff / maxRateKgWeek(p));
  const slowest = Math.max(fastest, Math.floor(diff / 0.1));
  const steady = Math.min(Math.max(weeksToTarget(p) ?? fastest, fastest), slowest);
  let weeks = WEEK_CHOICES.filter((w) => w >= fastest && w <= slowest);
  if (!weeks.length) weeks = [fastest];
  const best = weeks.reduce((a, b) => (Math.abs(b - steady) < Math.abs(a - steady) ? b : a), weeks[0]);
  const at = weeks.indexOf(best);
  const from = Math.max(0, Math.min(at - 1, weeks.length - 4)); // one quicker than the recommended, and slower ones
  weeks = weeks.slice(from, from + 4);
  return weeks.map((w) => ({ weeks: w, ...kcalForWeeks(p, w), recommended: w === best }));
};

export const suggestGoals = (p: Profile): Macros => {
  const goal = goalFor(p);
  let kcal = p.weeks && p.targetKg && goal !== 'maintain' ? kcalForWeeks(p, p.weeks).kcal : Math.round((formulaTdee(p) + GOAL_ADJUST[goal]) / 10) * 10;
  kcal = Math.max(kcal, MIN_KCAL[p.sex]); // never suggest eating below the safe floor
  return macrosForCalories(kcal, p.weightKg, goal); // the carb level is no longer offered: the usual balanced split
};

export const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
