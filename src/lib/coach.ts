// Coach analytics. Everything here is plain, tested arithmetic on the user's own logs — the AI chat only
// explains these results. Nothing is reported unless there is enough data; otherwise we say what is missing.
import type { Entry } from '../store/kabe';
import { GOAL_ADJUST, MIN_KCAL, Profile, formulaTdee } from './nutrition';
import { WeightEntry, addDays, dayIndex, trendSeries } from './tracker';

export const KCAL_PER_KG = 7700; // approx. energy in 1 kg of body weight change (a rule of thumb)

export type DayIntake = { date: string; kcal: number; protein: number; carbs: number; fat: number; logged: boolean };

/** Per-day totals for the last `days` days ending at `today` (oldest first). */
export function dailyIntake(entries: Pick<Entry, 'date' | 'kcal' | 'protein' | 'carbs' | 'fat'>[], days: number, today: string): DayIntake[] {
  const byDate = new Map<string, DayIntake>();
  for (const e of entries) {
    const d = byDate.get(e.date) ?? { date: e.date, kcal: 0, protein: 0, carbs: 0, fat: 0, logged: true };
    d.kcal += e.kcal;
    d.protein += e.protein;
    d.carbs += e.carbs;
    d.fat += e.fat;
    byDate.set(e.date, d);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return byDate.get(date) ?? { date, kcal: 0, protein: 0, carbs: 0, fat: 0, logged: false };
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Least-squares weight slope in kg/week over the last `windowDays`; null if there isn't enough spread of data. */
export function trendSlope(weights: WeightEntry[], today: string, windowDays = 21): { kgPerWeek: number; n: number; spanDays: number } | null {
  const from = addDays(today, -(windowDays - 1));
  const w = weights.filter((x) => x.date >= from && x.date <= today);
  if (w.length < 6) return null;
  const xs = w.map((x) => dayIndex(x.date));
  const span = Math.max(...xs) - Math.min(...xs);
  if (span < 10) return null;
  const mx = mean(xs);
  const my = mean(w.map((x) => x.kg));
  let num = 0;
  let den = 0;
  w.forEach((x, i) => {
    num += (xs[i] - mx) * (x.kg - my);
    den += (xs[i] - mx) ** 2;
  });
  return { kgPerWeek: (num / den) * 7, n: w.length, spanDays: span };
}

export type TdeeResult =
  | { ok: true; tdee: number; avgIntake: number; kgPerWeek: number; coverage: number; weighIns: number; confidence: 'low' | 'medium' | 'high' }
  // `reason` is English (tests, AI context); `code` (+ numbers) lets the screen show the same message in the user's language
  | { ok: false; reason: string; code?: 'coverage' | 'weighIns' | 'span' | 'nonsense'; days?: number; window?: number };

/**
 * Real-world energy use: average intake minus the energy implied by weight change (energy balance).
 * Needs mostly-complete food logs and weigh-ins at both ends of a 4-week window, otherwise says why not.
 */
export function estimateTdee(days: DayIntake[], weights: WeightEntry[], today: string, windowDays = 28): TdeeResult {
  const from = addDays(today, -(windowDays - 1));
  const inWindow = days.filter((d) => d.date >= from && d.date <= today);
  const full = inWindow.filter((d) => d.kcal >= 800); // treat very low days as unfinished logging
  const coverage = full.length / windowDays;
  if (coverage < 0.6) {
    return { ok: false, code: 'coverage', days: full.length, window: windowDays, reason: `Only ${full.length} of the last ${windowDays} days have a full food log — log most days so I can learn your real calorie needs.` };
  }
  const early = weights.filter((w) => w.date >= from && w.date < addDays(from, 10));
  const late = weights.filter((w) => w.date > addDays(today, -10) && w.date <= today);
  if (early.length < 2 || late.length < 2) {
    return { ok: false, code: 'weighIns', reason: 'I need at least 2 weigh-ins in the first and last 10 days of the 4-week window to see your weight change.' };
  }
  const span = mean(late.map((w) => dayIndex(w.date))) - mean(early.map((w) => dayIndex(w.date)));
  if (span < 10) return { ok: false, code: 'span', reason: 'Your weigh-ins are too close together in time to measure a change.' };
  const kgPerDay = (mean(late.map((w) => w.kg)) - mean(early.map((w) => w.kg))) / span;
  const avgIntake = mean(full.map((d) => d.kcal));
  const tdee = avgIntake - kgPerDay * KCAL_PER_KG;
  if (!(tdee >= 1000 && tdee <= 5000)) return { ok: false, code: 'nonsense', reason: 'The numbers do not add up (check for missed logging or odd weigh-ins).' };
  const confidence = coverage >= 0.85 && early.length >= 3 && late.length >= 3 && span >= 18 ? 'high' : coverage >= 0.7 ? 'medium' : 'low';
  return { ok: true, tdee: Math.round(tdee / 10) * 10, avgIntake: Math.round(avgIntake), kgPerWeek: kgPerDay * 7, coverage, weighIns: early.length + late.length, confidence };
}

export type TargetSuggestion = { kcal: number; basis: 'your logs' | 'formula'; note: string; noteCode: 'floored' | 'maintain' | 'lose' | 'gain'; floored: boolean };

/** Suggested daily calories: measured TDEE if we have it (and it is not 'low' confidence), otherwise the formula. */
export function suggestTarget(profile: Profile, tdee: TdeeResult): TargetSuggestion {
  const measured = tdee.ok && tdee.confidence !== 'low';
  const base = measured ? (tdee as Extract<TdeeResult, { ok: true }>).tdee : formulaTdee(profile);
  let kcal = Math.round((base + GOAL_ADJUST[profile.goal]) / 10) * 10;
  const floor = MIN_KCAL[profile.sex];
  const floored = kcal < floor;
  if (floored) kcal = floor;
  const note = floored
    ? `That would be below ${floor} kcal, which Kabe won't suggest without a doctor or dietitian. Showing ${floor}.`
    : profile.goal === 'maintain'
      ? 'Eating about this much should keep your weight steady.'
      : profile.goal === 'lose'
        ? 'This is a moderate deficit (~400 kcal/day), roughly 0.4 kg loss per week.'
        : 'This is a modest surplus (~300 kcal/day) for gradual gain.';
  const noteCode = floored ? 'floored' : profile.goal === 'maintain' ? 'maintain' : profile.goal === 'lose' ? 'lose' : 'gain';
  return { kcal, basis: measured ? 'your logs' : 'formula', note, noteCode, floored };
}

export type PlanStatus = 'progressing' | 'slow' | 'plateau' | 'stable' | 'drifting' | 'insufficient' | 'unclear';

/** Is the weight trend doing what the goal needs? `loggingCoverage` 0..1 guards against blaming the plan when logging stopped. */
export function planStatus(goal: Profile['goal'], slope: { kgPerWeek: number } | null, loggingCoverage: number): PlanStatus {
  if (!slope) return 'insufficient';
  const s = slope.kgPerWeek;
  if (goal === 'maintain') return Math.abs(s) < 0.2 ? 'stable' : 'drifting';
  const toward = goal === 'lose' ? -s : s;
  if (toward >= 0.15) return 'progressing';
  if (toward > 0.05) return 'slow';
  return loggingCoverage >= 0.6 ? 'plateau' : 'unclear';
}

export type Forecast =
  | { ok: true; weeks: number; date: string }
  | { ok: false; reason: 'no_goal' | 'insufficient' | 'flat' | 'wrong_direction' | 'too_far' | 'reached' };

/** When the current pace would reach the goal weight. A projection, not a promise. */
export function forecastGoal(trendKg: number, goalKg: number | null, slope: { kgPerWeek: number } | null, today: string): Forecast {
  if (goalKg === null) return { ok: false, reason: 'no_goal' };
  if (!slope) return { ok: false, reason: 'insufficient' };
  const diff = goalKg - trendKg;
  if (Math.abs(diff) < 0.3) return { ok: false, reason: 'reached' };
  if (Math.abs(slope.kgPerWeek) < 0.05) return { ok: false, reason: 'flat' };
  if (Math.sign(diff) !== Math.sign(slope.kgPerWeek)) return { ok: false, reason: 'wrong_direction' };
  const weeks = Math.abs(diff / slope.kgPerWeek);
  if (weeks > 104) return { ok: false, reason: 'too_far' };
  return { ok: true, weeks: Math.round(weeks * 10) / 10, date: addDays(today, Math.round(weeks * 7)) };
}

/** Losing faster than ~1% of body weight per week is more than is generally advised. */
export const tooFast = (slope: { kgPerWeek: number } | null, weightKg: number) => !!slope && slope.kgPerWeek < 0 && -slope.kgPerWeek > weightKg * 0.01;

export type WeekSummary = { loggedDays: number; avgKcal: number; avgProtein: number; proteinGoalDays: number; kcalGoalDays: number };

/** Last-7-day summary using only days that have food logged. kcalGoalDays = within ±10% of target. */
export function weekSummary(days: DayIntake[], goal: { kcal: number; protein: number }): WeekSummary {
  const last7 = days.slice(-7).filter((d) => d.kcal > 0);
  if (!last7.length) return { loggedDays: 0, avgKcal: 0, avgProtein: 0, proteinGoalDays: 0, kcalGoalDays: 0 };
  return {
    loggedDays: last7.length,
    avgKcal: Math.round(mean(last7.map((d) => d.kcal))),
    avgProtein: Math.round(mean(last7.map((d) => d.protein))),
    proteinGoalDays: last7.filter((d) => d.protein >= goal.protein * 0.9).length,
    kcalGoalDays: last7.filter((d) => Math.abs(d.kcal - goal.kcal) <= goal.kcal * 0.1).length,
  };
}

export type CoachAnalysis = ReturnType<typeof analyzeCoach>;

/** One call that runs every analysis on the user's data, used by both the insight cards and the chat context. */
export function analyzeCoach(a: {
  profile: Profile;
  goals: { kcal: number; protein: number };
  entries: Pick<Entry, 'date' | 'kcal' | 'protein' | 'carbs' | 'fat'>[];
  weights: WeightEntry[];
  goalWeight: number | null;
  today: string;
}) {
  const days28 = dailyIntake(a.entries, 28, a.today);
  const weightKg = currentWeight(a.weights, a.profile.weightKg);
  const slope = trendSlope(a.weights, a.today);
  const tdee = estimateTdee(days28, a.weights, a.today);
  const coverage21 = days28.slice(-21).filter((d) => d.kcal >= 800).length / 21;
  return {
    days28,
    weightKg,
    slope,
    tdee,
    coverage21,
    status: planStatus(a.profile.goal, slope, coverage21),
    target: suggestTarget({ ...a.profile, weightKg }, tdee),
    forecast: forecastGoal(weightKg, a.goalWeight, slope, a.today),
    week: weekSummary(days28, a.goals),
    tooFast: tooFast(slope, weightKg),
  };
}

/** Latest smoothed weight (7-day average), or the profile weight if there are no weigh-ins. */
export const currentWeight = (weights: WeightEntry[], fallbackKg: number) =>
  weights.length ? trendSeries(weights)[weights.length - 1].avg : fallbackKg;
