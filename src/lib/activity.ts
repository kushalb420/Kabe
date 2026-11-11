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

export type WeekSummary = { activeMinutes: number; km: number; sessions: number; kcal: number; avgSteps: number | null; stepDays: number; goalDays: number };

/** The 7 days ending `today`. activeMinutes counts walks too (moderate activity is what the WHO guideline measures). */
export function weekSummary(activities: Activity[], steps: Record<string, number>, today: string, weightKg: number, stepGoal: number): WeekSummary {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const acts = activities.filter((a) => days.includes(a.date));
  const stepVals = days.map((d) => steps[d]).filter((v): v is number => typeof v === 'number' && v > 0);
  return {
    activeMinutes: acts.reduce((s, a) => s + a.minutes, 0),
    km: Math.round(acts.reduce((s, a) => s + (a.km ?? 0), 0) * 10) / 10,
    sessions: acts.length,
    kcal: acts.reduce((s, a) => s + kcalBurned(a, weightKg), 0),
    avgSteps: stepVals.length ? Math.round(stepVals.reduce((a, b) => a + b, 0) / stepVals.length) : null,
    stepDays: stepVals.length,
    goalDays: stepVals.filter((v) => v >= stepGoal).length,
  };
}

/** Per-day numbers for the last 7 days (oldest first), for charts. */
export function weekSeries(activities: Activity[], steps: Record<string, number>, today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, minutes: activities.filter((a) => a.date === date).reduce((s, a) => s + a.minutes, 0), steps: steps[date] ?? 0 };
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
