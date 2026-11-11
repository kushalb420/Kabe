import type { Food } from '../data/foods';

export type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
/** Optional extras. undefined means "unknown" — never treated as zero in the UI. */
export type Extras = { sugar?: number; sodium?: number; satFat?: number }; // sugar = FREE sugar (added sugars, honey, syrups, juices)

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
};

export const DEFAULT_PROFILE: Profile = { sex: 'female', age: 25, heightCm: 165, weightKg: 60, activity: 'light', goal: 'maintain' };

const ACTIVITY ={ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

/** Split a calorie target into macros: protein by body weight, fat ~27% of calories, carbs the rest. */
export const macrosForCalories = (kcal: number, weightKg: number, goal: Profile['goal']): Macros => {
  const protein = Math.round(weightKg * (goal === 'lose' ? 1.8 : 1.6));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, fiber: 30 };
};

/** Mifflin-St Jeor estimate of daily energy use (TDEE). A starting point only, not medical advice. */
export const formulaTdee = (p: Profile): number => {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  return bmr * ACTIVITY[p.activity];
};

export const GOAL_ADJUST = { lose: -400, maintain: 0, gain: 300 } as const;
/** Kabe never suggests eating below these without professional guidance. */
export const MIN_KCAL = { female: 1200, male: 1500 } as const;

export const suggestGoals = (p: Profile): Macros => {
  const kcal = Math.round((formulaTdee(p) + GOAL_ADJUST[p.goal]) / 10) * 10;
  return macrosForCalories(kcal, p.weightKg, p.goal);
};

export const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
