// Recovery logic: sleep scoring, a simple readiness score, training-load streaks and plain-language recommendations.
// The readiness score is a transparent rule of thumb (weights below), NOT a medical measurement.
import { EXERCISES, Muscle } from '../data/exercises';
import { Activity, isHardSession } from './activity';
import { addDays } from './tracker';
import type { Workout } from './workout';

/** One morning check-in. sleepQ: 1 poor … 5 great. soreness/fatigue/stress: 1 none … 5 severe. */
export type Checkin = { sleepH: number; sleepQ: number; soreness: number; fatigue: number; stress: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// hours slept → 0..100. Adults are generally advised 7–9 h; too little or a lot more is scored lower.
const HOURS: [number, number][] = [[0, 0], [4, 15], [5, 40], [6, 65], [7, 90], [7.5, 100], [9, 100], [10, 85], [12, 60]];
export function sleepHoursScore(h: number): number {
  if (h <= 0) return 0;
  if (h >= 12) return 60;
  for (let i = 1; i < HOURS.length; i++) {
    const [x0, y0] = HOURS[i - 1];
    const [x1, y1] = HOURS[i];
    if (h <= x1) return y0 + ((y1 - y0) * (h - x0)) / (x1 - x0);
  }
  return 60;
}

/** Sleep score: 70% hours, 30% how rested you felt. */
export const sleepScore = (h: number, q: number) => 0.7 * sleepHoursScore(h) + 0.3 * (((clamp(q, 1, 5) - 1) / 4) * 100);

const lowIsGood = (v: number) => (5 - clamp(v, 1, 5)) * 25; // 1 → 100, 5 → 0

export type Readiness = { score: number; parts: { sleep: number; soreness: number; fatigue: number; stress: number }; loadPenalty: number };

/** score = 40% sleep + 20% soreness + 20% fatigue + 20% stress, minus a penalty after many hard days in a row (4+ → −10, 6+ → −20). */
export function readiness(c: Checkin, streak: number): Readiness {
  const parts = { sleep: sleepScore(c.sleepH, c.sleepQ), soreness: lowIsGood(c.soreness), fatigue: lowIsGood(c.fatigue), stress: lowIsGood(c.stress) };
  const loadPenalty = streak >= 6 ? 20 : streak >= 4 ? 10 : 0;
  const base = 0.4 * parts.sleep + 0.2 * parts.soreness + 0.2 * parts.fatigue + 0.2 * parts.stress;
  return { score: Math.round(clamp(base - loadPenalty, 0, 100)), parts, loadPenalty };
}

export type Level = 'push' | 'moderate' | 'light' | 'rest';
export const levelFor = (score: number): Level => (score >= 75 ? 'push' : score >= 55 ? 'moderate' : score >= 35 ? 'light' : 'rest');

const HEADLINE: Record<Level, string> = {
  push: 'You look well recovered — a good day for a hard session.',
  moderate: 'Decent recovery — train, but keep it controlled (skip max-effort sets).',
  light: 'Recovery is low — an easy walk, mobility or a light session is plenty today.',
  rest: 'Your body is asking for rest — take a rest day.',
};

/** A tip as a code + numbers, so the screen can show it in the user's language (the English text is in `tips`). */
export type TipCode = { id: 'shortSleep' | 'soreMuscles' | 'soreGeneral' | 'streak' | 'stress' | 'rest' | 'push'; hours?: number; muscles?: Muscle[]; days?: number };

export function recommend(score: number, c: Checkin, ctx: { streak: number; musclesYesterday: Muscle[] }): { level: Level; headline: string; tips: string[]; codes: TipCode[] } {
  const level = levelFor(score);
  const tips: string[] = [];
  const codes: TipCode[] = [];
  const add = (text: string, code: TipCode) => {
    tips.push(text);
    codes.push(code);
  };
  if (c.sleepH < 6) add(`You slept ${c.sleepH} h. Keep today's training shorter or lighter and aim for an earlier night.`, { id: 'shortSleep', hours: c.sleepH });
  if (c.soreness >= 4) {
    if (ctx.musclesYesterday.length) add(`You're very sore — go easy on what you trained yesterday (${ctx.musclesYesterday.join(', ').toLowerCase()}); train other muscles or do mobility.`, { id: 'soreMuscles', muscles: ctx.musclesYesterday });
    else add("You're very sore — choose mobility work or an easy walk.", { id: 'soreGeneral' });
  }
  if (ctx.streak >= 4) add(`You've trained hard ${ctx.streak} days in a row — schedule a rest day soon.`, { id: 'streak', days: ctx.streak });
  if (c.stress >= 4) add('Stress is high — a walk or an easy session often helps more than a hard one.', { id: 'stress' });
  if (level === 'rest') add('Rest is when you rebuild: prioritise sleep, protein and water. If you feel unwell, dizzy or have chest pain, stop and see a doctor.', { id: 'rest' });
  if (level === 'push' && !tips.length) add('Make it count, then eat and sleep well to lock in the progress.', { id: 'push' });
  return { level, headline: HEADLINE[level], tips, codes };
}

// ---------------- sleep stats ----------------
export type SleepStats = { avg7: number | null; daysLogged: number; debtH: number; bestH: number | null; worstH: number | null };

/** Last 7 days. Sleep debt = hours short of your goal, summed over the nights you logged. */
export function sleepStats(checkins: Record<string, Checkin>, today: string, goalH: number): SleepStats {
  const vals = Array.from({ length: 7 }, (_, i) => checkins[addDays(today, i - 6)]?.sleepH).filter((v): v is number => typeof v === 'number' && v > 0);
  if (!vals.length) return { avg7: null, daysLogged: 0, debtH: 0, bestH: null, worstH: null };
  return {
    avg7: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    daysLogged: vals.length,
    debtH: Math.round(vals.reduce((s, h) => s + Math.max(0, goalH - h), 0) * 10) / 10,
    bestH: Math.max(...vals),
    worstH: Math.min(...vals),
  };
}

// ---------------- training load & rest days ----------------
/** A "training day": a logged workout, or a hard activity session (see isHardSession). Easy walks don't count. */
export function trainingDay(date: string, workouts: Workout[], activities: Activity[]): boolean {
  return workouts.some((w) => w.date === date && w.exercises.some((e) => e.sets.length > 0)) || activities.some((a) => a.date === date && isHardSession(a));
}

export const isRestDay = (date: string, workouts: Workout[], activities: Activity[], manualRest: string[]) =>
  manualRest.includes(date) || !trainingDay(date, workouts, activities);

/** Consecutive training days ending the day BEFORE `date` (a day marked as rest breaks the run). Capped at 30. */
export function trainingStreakBefore(date: string, workouts: Workout[], activities: Activity[], manualRest: string[]): number {
  let n = 0;
  for (let d = addDays(date, -1); n < 30 && trainingDay(d, workouts, activities) && !manualRest.includes(d); d = addDays(d, -1)) n++;
  return n;
}

/** Muscle groups trained in logged workouts on a date. */
export function musclesTrained(date: string, workouts: Workout[], muscleOf: (exerciseId: string) => Muscle | undefined = (id) => EXERCISES.find((e) => e.id === id)?.muscle): Muscle[] {
  const set = new Set<Muscle>();
  for (const w of workouts) {
    if (w.date !== date) continue;
    for (const e of w.exercises) {
      const m = muscleOf(e.exerciseId);
      if (m && e.sets.length) set.add(m);
    }
  }
  return [...set];
}

/** Rest days in the 7 days ending `today`. */
export const restDaysThisWeek = (today: string, workouts: Workout[], activities: Activity[], manualRest: string[]) =>
  Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter((d) => isRestDay(d, workouts, activities, manualRest)).length;
