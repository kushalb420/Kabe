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
};

export type CarbLevel = 'low' | 'mid' | 'high';
/** Share of the day's calories that come from carbs at each level. */
export const CARB_SHARE: Record<CarbLevel, number> = { low: 0.2, mid: 0.4, high: 0.55 };
/** Least share of calories from protein: higher on low carb, the same on medium and high carb (usual 25-30% on low carb, 20-25% otherwise). */
export const PROTEIN_SHARE: Record<CarbLevel, number> = { low: 0.3, mid: 0.22, high: 0.22 };

export const DEFAULT_PROFILE: Profile = { sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' };

const ACTIVITY ={ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

/** Split a calorie target into macros: protein by body weight, fat ~27% of calories, carbs the rest. */
export const macrosForCalories = (kcal: number, weightKg: number, goal: Profile['goal'], carbLevel?: CarbLevel): Macros => {
  const protein = Math.round(weightKg * (goal === 'lose' ? 1.8 : 1.6));
  if (!carbLevel) {
    const fat = Math.round((kcal * 0.27) / 9);
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

export const suggestGoals = (p: Profile): Macros => {
  const goal = goalFor(p);
  let kcal = Math.round((formulaTdee(p) + GOAL_ADJUST[goal]) / 10) * 10;
  if (p.targetKg || p.carbLevel) kcal = Math.max(kcal, MIN_KCAL[p.sex]); // never suggest eating below the safe floor
  return macrosForCalories(kcal, p.weightKg, goal, p.carbLevel);
};

export const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
