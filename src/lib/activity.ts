// Activity maths: estimated calories (MET method), pace, weekly summaries. Pure and tested.
// Calories are ESTIMATES (energy = MET × body weight × hours, MET values from the Compendium of Physical Activities,
// rounded). Individuals differ by roughly ±25%, so the UI always says "about".
import { addDays } from './tracker';

export type ActivityType = 'walk' | 'run' | 'cycle' | 'cardio' | 'other';
export type Activity = { id: string; date: string; type: ActivityType; minutes: number; km?: number; effort?: number; note?: string };

export const TYPE_LABEL: Record<ActivityType, string> = { walk: 'Walk', run: 'Run', cycle: 'Cycle', cardio: 'Cardio / gym', other: 'Other' };
export const WHO_WEEKLY_MINUTES = 150; // WHO: at least 150 min of moderate activity per week for adults

export const speedKmh = (a: Pick<Activity, 'minutes' | 'km'>): number | null => (a.km && a.km > 0 && a.minutes > 0 ? a.km / (a.minutes / 60) : null);

/** Pace in minutes per km, or null without a distance. */
export const paceMinPerKm = (a: Pick<Activity, 'minutes' | 'km'>): number | null => (a.km && a.km > 0 && a.minutes > 0 ? a.minutes / a.km : null);

export const formatPace = (p: number | null): string => {
  if (p === null || !isFinite(p)) return '—';
  let m = Math.floor(p);
  let s = Math.round((p - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')} /km`;
};

const band = (v: number, cuts: number[], mets: number[]) => {
  for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return mets[i];
  return mets[mets.length - 1];
};

/** MET for an activity: by speed when we know the distance, otherwise by effort / a typical value. */
export function metFor(a: Pick<Activity, 'type' | 'minutes' | 'km' | 'effort'>): number {
  const v = speedKmh(a);
  switch (a.type) {
    case 'walk':
      return v === null ? 3.5 : band(v, [3.6, 4.4, 5.2, 6.0, 6.8], [2.8, 3.0, 3.5, 4.3, 5.0, 7.0]);
    case 'run':
      return v === null ? 9.8 : band(v, [8.0, 9.0, 10.3, 11.3, 12.5, 13.8], [7.0, 8.3, 9.8, 11.0, 11.8, 12.8, 14.5]);
    case 'cycle':
      return v === null ? 6.8 : band(v, [16, 19.3, 22.5, 25.7], [4.0, 6.8, 8.0, 10.0, 12.0]);
    default: {
      const e = a.effort;
      if (!e) return a.type === 'cardio' ? 6.0 : 4.0;
      return e <= 3 ? 4.0 : e <= 6 ? 6.0 : e <= 8 ? 8.0 : 10.0;
    }
  }
}

export const kcalBurned = (a: Pick<Activity, 'type' | 'minutes' | 'km' | 'effort'>, weightKg: number): number => Math.round(metFor(a) * weightKg * (a.minutes / 60));

/** Sessions that count as "training" for rest-day purposes: runs/rides/cardio/other ≥ 20 min, walks ≥ 90 min. Easy walks are active recovery. */
export const isHardSession = (a: Activity) => (a.type === 'walk' ? a.minutes >= 90 : a.minutes >= 20);

// ---- active minutes and distance: ONE definition used everywhere (Activity, Insights, charts, friends, badges, coach)
/** Steps beyond this many a day count as walking for exercise (the first ones are ordinary moving about the house). */
export const STEP_BASELINE = 3000;
/** The usual pace of moderate walking, which is what the WHO guideline measures. */
export const STEPS_PER_MIN = 100;
export const KM_PER_STEP = 0.00075; // an average stride of 75 cm

export type Session = { date: string; minutes: number; km?: number };

/** Minutes of walking that the steps of a day imply. */
export const walkingMinutes = (steps: number): number => (steps > STEP_BASELINE ? Math.round((steps - STEP_BASELINE) / STEPS_PER_MIN) : 0);
export const stepsKm = (steps: number): number => Math.round(steps * KM_PER_STEP * 10) / 10;

/** A finished workout is a session of its own length. */
export const workoutSessions = (workouts: { date: string; durationSec?: number }[]): Session[] =>
  workouts.filter((w) => (w.durationSec ?? 0) > 0).map((w) => ({ date: w.date, minutes: Math.max(1, Math.round((w.durationSec ?? 0) / 60)) }));

/**
 * One day's active minutes and km: the sessions you logged (walks, runs, workouts) or, when larger, what your steps imply.
 * The larger one is used, never the sum, so a logged walk that also made steps is not counted twice.
 */
export function dayTotals(sessions: Session[], steps: Record<string, number>, date: string): { minutes: number; km: number } {
  let minutes = 0;
  let km = 0;
  for (const x of sessions) {
    if (x.date !== date) continue;
    minutes += x.minutes;
    km += x.km ?? 0;
  }
  const st = steps[date] ?? 0;
  return { minutes: Math.max(minutes, walkingMinutes(st)), km: Math.round(Math.max(km, stepsKm(st)) * 10) / 10 };
}

/** Every date that has any active minutes, for charts (date + minutes). */
export function activeMinuteItems(sessions: Session[], steps: Record<string, number>): { date: string; value: number }[] {
  const dates = new Set<string>([...sessions.map((x) => x.date), ...Object.keys(steps)]);
  return [...dates].map((date) => ({ date, value: dayTotals(sessions, steps, date).minutes })).filter((x) => x.value > 0);
}

export type WeekSummary = { activeMinutes: number; km: number; sessions: number; kcal: number; avgSteps: number | null; stepDays: number; goalDays: number };

/** The 7 days ending `today`. activeMinutes counts walks too (moderate activity is what the WHO guideline measures). */
export function weekSummary(activities: Activity[], steps: Record<string, number>, today: string, weightKg: number, stepGoal: number, workouts: { date: string; durationSec?: number }[] = []): WeekSummary {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const acts = activities.filter((a) => days.includes(a.date));
  const wks = workouts.filter((w) => days.includes(w.date));
  const sessions: Session[] = [...acts, ...workoutSessions(wks)];
  const totals = days.map((d) => dayTotals(sessions, steps, d));
  const stepVals = days.map((d) => steps[d]).filter((v): v is number => typeof v === 'number' && v > 0);
  return {
    activeMinutes: totals.reduce((s, x) => s + x.minutes, 0),
    km: Math.round(totals.reduce((s, x) => s + x.km, 0) * 10) / 10,
    sessions: acts.length + wks.length,
    kcal: acts.reduce((s, a) => s + kcalBurned(a, weightKg), 0),
    avgSteps: stepVals.length ? Math.round(stepVals.reduce((a, b) => a + b, 0) / stepVals.length) : null,
    stepDays: stepVals.length,
    goalDays: stepVals.filter((v) => v >= stepGoal).length,
  };
}

/** Per-day numbers for the last 7 days (oldest first), for charts. */
export function weekSeries(activities: Activity[], steps: Record<string, number>, today: string, workouts: { date: string; durationSec?: number }[] = []) {
  const sessions: Session[] = [...activities, ...workoutSessions(workouts)];
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, minutes: dayTotals(sessions, steps, date).minutes, steps: steps[date] ?? 0 };
  });
}

export type Bests = { longestRunKm: number | null; fastestRunPace: number | null; longestWalkKm: number | null; longestRideKm: number | null };

/** Personal bests. A "fastest pace" only counts runs of at least 3 km so a short sprint doesn't win. */
export function personalBests(activities: Activity[]): Bests {
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);
  const runs = activities.filter((a) => a.type === 'run' && a.km);
  const paced = runs.filter((a) => (a.km as number) >= 3).map((a) => paceMinPerKm(a)).filter((p): p is number => p !== null);
  return {
    longestRunKm: max(runs.map((a) => a.km as number)),
    fastestRunPace: paced.length ? Math.min(...paced) : null,
    longestWalkKm: max(activities.filter((a) => a.type === 'walk' && a.km).map((a) => a.km as number)),
    longestRideKm: max(activities.filter((a) => a.type === 'cycle' && a.km).map((a) => a.km as number)),
  };
}
