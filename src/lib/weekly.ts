// Weekly summary (pure logic, tested in scripts/test-weekly.ts).
// The facts are computed from the user's own data. Highlights and the "one thing to try" are rule-based and always
// available. The AI (optional) may only re-word those facts, and its text is rejected if it contains a number that is
// not one of the facts.
import { Checkin, sleepStats } from './recovery';
import { EntryLike, daysOf, summarize } from './stats';
import { addDays } from './tracker';
import { dayTotals, workoutSessions } from './activity';

export type WeekFacts = {
  endDate: string;
  goals: { kcal: number; protein: number };
  food: { loggedDays: number; avgKcal: number; avgProtein: number; daysOver: number; daysProteinMet: number };
  prevFood: { loggedDays: number; avgKcal: number; avgProtein: number };
  workouts: number;
  prevWorkouts: number;
  activeMinutes: number;
  prevActiveMinutes: number;
  sleep: { avgH: number | null; nights: number };
  weightChangeKg: number | null; // last minus first weigh-in inside the 7 days; null with fewer than 2
};

export type Input = {
  today: string;
  goals: { kcal: number; protein: number };
  entries: EntryLike[];
  workoutDates: string[];
  activities: { date: string; minutes: number; km?: number }[];
  steps?: Record<string, number>;
  workouts?: { date: string; durationSec?: number }[];
  checkins: Record<string, Checkin>;
  weights: { date: string; kg: number }[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const inWeek = (date: string, end: string) => date > addDays(end, -7) && date <= end;

export function buildFacts(i: Input): WeekFacts {
  const food = (end: string) => {
    const s = summarize(daysOf(i.entries, end, 7), i.goals);
    return { loggedDays: s.loggedDays, avgKcal: Math.round(s.avg.kcal), avgProtein: Math.round(s.avg.protein), daysOver: s.daysOver, daysProteinMet: s.daysProteinMet };
  };
  const prevEnd = addDays(i.today, -7);
  const sessions = [...i.activities, ...workoutSessions(i.workouts ?? [])];
  const minutes = (end: string) => Array.from({ length: 7 }, (_, k) => dayTotals(sessions, i.steps ?? {}, addDays(end, -k)).minutes).reduce((a, b) => a + b, 0);
  const sl = sleepStats(i.checkins, i.today, 8);
  const ws = i.weights.filter((w) => inWeek(w.date, i.today)).sort((a, b) => a.date.localeCompare(b.date));
  const { daysOver: _o, daysProteinMet: _p, ...prev } = food(prevEnd);
  void _o;
  void _p;
  return {
    endDate: i.today,
    goals: i.goals,
    food: food(i.today),
    prevFood: prev,
    workouts: i.workoutDates.filter((d) => inWeek(d, i.today)).length,
    prevWorkouts: i.workoutDates.filter((d) => inWeek(d, prevEnd)).length,
    activeMinutes: minutes(i.today),
    prevActiveMinutes: minutes(prevEnd),
    sleep: { avgH: sl.avg7, nights: sl.daysLogged },
    weightChangeKg: ws.length >= 2 ? r1(ws[ws.length - 1].kg - ws[0].kg) : null,
  };
}

/** True when there is nothing at all to summarise. */
export const isEmpty = (f: WeekFacts) => f.food.loggedDays === 0 && f.workouts === 0 && f.activeMinutes === 0 && f.sleep.nights === 0 && f.weightChangeKg === null;

export type HighlightId =
  | 'loggedMost' | 'loggedSome' | 'loggedFew'
  | 'kcalOn' | 'kcalOver' | 'kcalUnder'
  | 'proteinMet' | 'proteinLow'
  | 'workouts'
  | 'active' | 'sleepGood' | 'sleepShort' | 'weight';
export type Highlight = { id: HighlightId; params: Record<string, string | number>; good: boolean };

/** Plain observations, in a fixed order. Averages are of logged days; nothing is said about food with fewer than 3 logged days. */
export function highlights(f: WeekFacts): Highlight[] {
  const out: Highlight[] = [];
  const d = f.food.loggedDays;
  if (d > 0) out.push({ id: d >= 6 ? 'loggedMost' : d >= 4 ? 'loggedSome' : 'loggedFew', params: { n: d }, good: d >= 6 });
  if (d >= 3) {
    const p = { kcal: f.food.avgKcal, goal: Math.round(f.goals.kcal) };
    if (f.food.avgKcal > f.goals.kcal * 1.1) out.push({ id: 'kcalOver', params: p, good: false });
    else if (f.food.avgKcal < f.goals.kcal * 0.75) out.push({ id: 'kcalUnder', params: p, good: false });
    else out.push({ id: 'kcalOn', params: p, good: true });
    if (f.food.daysProteinMet >= 4) out.push({ id: 'proteinMet', params: { n: f.food.daysProteinMet, protein: f.food.avgProtein }, good: true });
    else if (f.food.avgProtein < f.goals.protein * 0.85) out.push({ id: 'proteinLow', params: { protein: f.food.avgProtein, goal: Math.round(f.goals.protein) }, good: false });
  }
  if (f.workouts > 0) out.push({ id: 'workouts', params: { n: f.workouts }, good: f.workouts >= 2 }); // only mentioned when some exist (older logs)
  if (f.activeMinutes > 0) out.push({ id: 'active', params: { min: f.activeMinutes }, good: f.activeMinutes >= 150 });
  if (f.sleep.avgH !== null && f.sleep.nights >= 2) {
    out.push({ id: f.sleep.avgH >= 7 ? 'sleepGood' : f.sleep.avgH < 6.5 ? 'sleepShort' : 'sleepGood', params: { h: f.sleep.avgH, n: f.sleep.nights }, good: f.sleep.avgH >= 7 });
  }
  if (f.weightChangeKg !== null) out.push({ id: 'weight', params: { kg: `${f.weightChangeKg > 0 ? '+' : ''}${f.weightChangeKg}` }, good: false });
  return out;
}

export type StepCode = 'logMore' | 'protein' | 'sleep' | 'move' | 'portion' | 'eatEnough' | 'keep';

/** The single most useful thing to try next week, by a fixed priority. */
export function nextStep(f: WeekFacts): StepCode {
  const d = f.food.loggedDays;
  if (d < 4) return 'logMore';
  if (f.food.avgKcal < f.goals.kcal * 0.75) return 'eatEnough';
  if (f.food.avgKcal > f.goals.kcal * 1.1) return 'portion';
  if (f.food.daysProteinMet < 4 && f.food.avgProtein < f.goals.protein * 0.85) return 'protein';
  if (f.sleep.avgH !== null && f.sleep.nights >= 2 && f.sleep.avgH < 6.5) return 'sleep';
  if (f.workouts === 0 && f.activeMinutes < 60) return 'move';
  return 'keep';
}

// ---------------------------------------------------------------- the optional AI wording
export type Narrative = { headline: string; summary: string; tip: string };

export const NARRATIVE_SCHEMA = {
  type: 'object',
  properties: { headline: { type: 'string' }, summary: { type: 'string' }, tip: { type: 'string' } },
  required: ['headline', 'summary', 'tip'],
};

export function buildWeeklyPrompt(f: WeekFacts, language: string): string {
  return [
    'You write a short, kind, honest weekly summary for a fitness app, using ONLY the JSON facts below.',
    'RULES:',
    '- Use only numbers that appear in the facts. Never invent, estimate, add up or compare numbers that are not there.',
    '- If something is null or 0, say it was not logged. Never guess why.',
    '- No medical advice, no diagnoses, no calorie or weight targets other than the goals in the facts, no shaming.',
    '- headline: at most 10 words. summary: 2 to 4 sentences. tip: ONE small, practical thing to try next week, 1 sentence.',
    `- Write in ${language}.`,
    `FACTS: ${JSON.stringify(f)}`,
  ].join('\n');
}

const DIGIT_BLOCKS = [0x30, 0x966, 0xc66, 0xbe6]; // ASCII, Devanagari, Telugu, Tamil

/** Every number in a text, reading Hindi/Telugu/Tamil digits too ("7", "७", "౭", "௭"). Decimal commas and points both work. */
export function numbersIn(text: string): number[] {
  let ascii = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const b = DIGIT_BLOCKS.find((s) => cp >= s && cp <= s + 9);
    ascii += b !== undefined ? String(cp - b) : ch === '.' || ch === ',' ? ch : ' ';
  }
  return (ascii.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(',', '.')));
}

function factNumbers(f: WeekFacts): Set<number> {
  const set = new Set<number>([7]); // "7 days" is the period itself
  const walk = (v: unknown) => {
    if (typeof v === 'number') {
      set.add(v);
      set.add(Math.abs(v));
      set.add(Math.round(v));
      set.add(r1(v));
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const { endDate: _e, ...rest } = f;
  void _e;
  walk(rest);
  return set;
}

/** The AI's text is accepted only when it is complete, short, and uses no number outside the facts. Returns null when it is not. */
export function checkNarrative(raw: unknown, f: WeekFacts): Narrative | null {
  const o = raw as Partial<Narrative> | null;
  if (!o || typeof o.headline !== 'string' || typeof o.summary !== 'string' || typeof o.tip !== 'string') return null;
  const n = { headline: o.headline.trim(), summary: o.summary.trim(), tip: o.tip.trim() };
  if (!n.headline || !n.summary || !n.tip) return null;
  if (n.headline.length > 120 || n.summary.length > 700 || n.tip.length > 300) return null;
  const allowed = factNumbers(f);
  for (const x of numbersIn(`${n.headline} ${n.summary} ${n.tip}`)) if (!allowed.has(x)) return null;
  return n;
}
