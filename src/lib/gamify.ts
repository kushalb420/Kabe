// Streaks, badges, weekly challenges, levels and nudges. Everything is DERIVED from the user's real logs by pure
// functions, so it can't drift or be faked; only the date a badge was first earned is stored (by the caller).
import { Key, translate } from '../i18n';
import { Activity, isHardSession, activeMinuteItems, workoutSessions } from './activity';
import { dailyIntake } from './coach';
import { WeightEntry, addDays, dayIndex } from './tracker';

export type RawData = {
  today: string;
  entries: { date: string; kcal: number; protein: number; foodId?: string }[];
  goals: { kcal: number; protein: number };
  water: Record<string, number>;
  waterGoal: number;
  steps: Record<string, number>;
  stepGoal: number;
  workouts: { date: string; durationSec?: number }[];
  activities: Activity[];
  weights: WeightEntry[];
  goalWeight: number | null;
  goalDirection: 'lose' | 'maintain' | 'gain';
  checkins: Record<string, unknown>;
  restDays: string[];
  plan: Record<string, unknown>;
  pantryCount: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon = 0
  return addDays(date, -dow);
}

export type Streak = { current: number; longest: number; todayDone: boolean };

/**
 * Consecutive qualifying days. The current streak survives until the end of today: if today isn't done yet it still
 * counts the run that ended yesterday. `longest` is the best run ever.
 */
export function streakOf(days: Set<string>, today: string): Streak {
  const todayDone = days.has(today);
  let current = 0;
  for (let d = todayDone ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;
  const sorted = [...days].map(dayIndex).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  sorted.forEach((n, i) => {
    run = i > 0 && n === sorted[i - 1] + 1 ? run + 1 : n === sorted[i - 1] ? run : 1;
    longest = Math.max(longest, run);
  });
  return { current, longest, todayDone };
}

/** Everything the rules need, computed once. */
export type Ctx = ReturnType<typeof buildCtx>;
export function buildCtx(raw: RawData) {
  const days = dailyIntake(raw.entries.map((e) => ({ ...e, carbs: 0, fat: 0 })), 365, raw.today);
  const loggedDays = new Set(days.filter((d) => d.logged).map((d) => d.date));
  const proteinDays = new Set(days.filter((d) => d.logged && d.protein >= raw.goals.protein * 0.9).map((d) => d.date));
  const waterDays = new Set(Object.entries(raw.water).filter(([, ml]) => ml >= raw.waterGoal).map(([d]) => d));
  const stepDays = new Set(Object.entries(raw.steps).filter(([, s]) => s >= raw.stepGoal).map(([d]) => d));
  const moveDays = new Set([...raw.workouts.map((w) => w.date), ...raw.activities.filter(isHardSession).map((a) => a.date)]);
  const checkinDays = new Set(Object.keys(raw.checkins));
  // best rolling 7-day total of activity minutes
  const minutesByDay: Record<string, number> = {};
  for (const x of activeMinuteItems([...raw.activities, ...workoutSessions(raw.workouts)], raw.steps)) minutesByDay[x.date] = x.value;
  const dates = Object.keys(minutesByDay).sort();
  let bestWeekMinutes = 0;
  for (const d of dates) bestWeekMinutes = Math.max(bestWeekMinutes, sum(Array.from({ length: 7 }, (_, i) => minutesByDay[addDays(d, -i)] ?? 0)));
  const weights = [...raw.weights].sort((a, b) => a.date.localeCompare(b.date));
  const first = weights[0];
  const latest = weights[weights.length - 1];
  const sign = raw.goalDirection === 'lose' ? -1 : raw.goalDirection === 'gain' ? 1 : 0;
  return {
    raw,
    loggedDays, proteinDays, waterDays, stepDays, moveDays, checkinDays,
    streaks: {
      log: streakOf(loggedDays, raw.today),
      water: streakOf(waterDays, raw.today),
      steps: streakOf(stepDays, raw.today),
      move: streakOf(moveDays, raw.today),
      checkin: streakOf(checkinDays, raw.today),
    },
    mealsLogged: raw.entries.length,
    recipeMeals: raw.entries.filter((e) => e.foodId?.startsWith('recipe-')).length,
    bestWeekMinutes,
    minutesByDay,
    weighIns: weights.length,
    weightProgressKg: first && latest && sign ? Math.max(0, sign * (latest.kg - first.kg)) : 0,
    goalReached: !!(raw.goalWeight && first && latest && weights.length >= 2 && (Math.abs(latest.kg - raw.goalWeight) <= 0.3 || (first.kg - raw.goalWeight) * (latest.kg - raw.goalWeight) < 0)),
  };
}

// ---------------- badges ----------------
export type Tier = 'bronze' | 'silver' | 'gold';
export const TIER_POINTS: Record<Tier, number> = { bronze: 10, silver: 25, gold: 50 };
export type Group = 'Logging' | 'Nutrition' | 'Training' | 'Activity' | 'Body' | 'Recovery' | 'Kitchen';

export type BadgeDef = { id: string; group: Group; name: string; desc: string; tier: Tier; icon: string; target: number; unit: string; value: (c: Ctx) => number };

const b = (id: string, group: Group, name: string, desc: string, tier: Tier, icon: string, target: number, unit: string, value: BadgeDef['value']): BadgeDef => ({ id, group, name, desc, tier, icon, target, unit, value });
const maxRunKm = (c: Ctx) => Math.max(0, ...c.raw.activities.filter((a) => a.type === 'run' && a.km).map((a) => a.km as number));

export const BADGES: BadgeDef[] = [
  b('first-meal', 'Logging', 'First bite', 'Log your first meal', 'bronze', 'restaurant', 1, 'meal', (c) => c.mealsLogged),
  b('log-7', 'Logging', 'One week strong', 'Log food 7 days in a row', 'bronze', 'flame', 7, 'days in a row', (c) => c.streaks.log.longest),
  b('log-30', 'Logging', 'Habit formed', 'Log food 30 days in a row', 'silver', 'flame', 30, 'days in a row', (c) => c.streaks.log.longest),
  b('log-100', 'Logging', 'Centurion', 'Log food 100 days in a row', 'gold', 'flame', 100, 'days in a row', (c) => c.streaks.log.longest),
  b('meals-100', 'Logging', '100 meals', 'Log 100 food entries', 'silver', 'list', 100, 'entries', (c) => c.mealsLogged),
  b('protein-10', 'Nutrition', 'Protein pro', 'Hit your protein goal on 10 days', 'bronze', 'nutrition', 10, 'days', (c) => c.proteinDays.size),
  b('protein-50', 'Nutrition', 'Protein machine', 'Hit your protein goal on 50 days', 'gold', 'nutrition', 50, 'days', (c) => c.proteinDays.size),
  b('water-7', 'Nutrition', 'Well hydrated', 'Hit your water goal 7 days in a row', 'silver', 'water', 7, 'days in a row', (c) => c.streaks.water.longest),
  b('first-workout', 'Training', 'Iron starter', 'Finish your first workout', 'bronze', 'barbell', 1, 'workout', (c) => c.raw.workouts.length),
  b('workouts-10', 'Training', 'Getting strong', 'Finish 10 workouts', 'silver', 'barbell', 10, 'workouts', (c) => c.raw.workouts.length),
  b('workouts-50', 'Training', 'Gym regular', 'Finish 50 workouts', 'gold', 'trophy', 50, 'workouts', (c) => c.raw.workouts.length),
  b('move-7', 'Training', 'On the move', 'Exercise for 20+ minutes, 7 days in a row', 'silver', 'flash', 7, 'days in a row', (c) => c.streaks.move.longest),
  b('first-run', 'Activity', 'Runner', 'Log a run', 'bronze', 'walk', 1, 'run', (c) => c.raw.activities.filter((a) => a.type === 'run').length),
  b('run-5k', 'Activity', '5K', 'Run 5 km in one go', 'silver', 'medal', 5, 'km', maxRunKm),
  b('run-10k', 'Activity', '10K', 'Run 10 km in one go', 'gold', 'medal', 10, 'km', maxRunKm),
  b('steps-10k', 'Activity', '10,000 steps', 'Walk 10,000 steps in a day', 'bronze', 'footsteps', 10000, 'steps', (c) => Math.max(0, ...Object.values(c.raw.steps))),
  b('steps-streak-7', 'Activity', 'Step streak', 'Hit your step goal 7 days in a row', 'silver', 'footsteps', 7, 'days in a row', (c) => c.streaks.steps.longest),
  b('who-week', 'Activity', 'WHO week', '150 active minutes in 7 days', 'silver', 'heart', 150, 'minutes', (c) => c.bestWeekMinutes),
  b('first-weigh', 'Body', 'On the scale', 'Log your first weigh-in', 'bronze', 'scale', 1, 'weigh-in', (c) => c.weighIns),
  b('weigh-10', 'Body', 'Tracking progress', 'Log 10 weigh-ins', 'bronze', 'trending-down', 10, 'weigh-ins', (c) => c.weighIns),
  b('progress-2kg', 'Body', 'First 2 kg', 'Move 2 kg toward your goal', 'silver', 'trending-down', 2, 'kg', (c) => Math.round(c.weightProgressKg * 10) / 10),
  b('progress-5kg', 'Body', '5 kg milestone', 'Move 5 kg toward your goal', 'gold', 'trophy', 5, 'kg', (c) => Math.round(c.weightProgressKg * 10) / 10),
  b('goal-reached', 'Body', 'Goal weight reached', 'Reach your goal weight', 'gold', 'ribbon', 1, 'goal', (c) => (c.goalReached ? 1 : 0)),
  b('checkin-7', 'Recovery', 'Listening to your body', 'Do 7 morning check-ins', 'bronze', 'moon', 7, 'check-ins', (c) => c.checkinDays.size),
  b('checkin-30', 'Recovery', 'Recovery regular', 'Do 30 morning check-ins', 'silver', 'moon', 30, 'check-ins', (c) => c.checkinDays.size),
  b('rest-smart', 'Recovery', 'Smart rest', 'Mark a rest day', 'bronze', 'bed', 1, 'rest day', (c) => c.raw.restDays.length),
  b('first-recipe', 'Kitchen', 'Home cook', 'Log a recipe you cooked', 'bronze', 'restaurant', 1, 'recipe', (c) => c.recipeMeals),
  b('recipes-10', 'Kitchen', 'Kitchen regular', 'Log 10 recipe meals', 'silver', 'restaurant', 10, 'recipe meals', (c) => c.recipeMeals),
  b('meal-plan', 'Kitchen', 'Planner', 'Save a recipe', 'bronze', 'calendar', 1, 'plan', (c) => (Object.keys(c.raw.plan).length ? 1 : 0)),
  b('pantry', 'Kitchen', 'Stocked up', 'Add 10 items to your kitchen', 'bronze', 'basket', 10, 'items', (c) => c.raw.pantryCount),
];

/** The Training tab is hidden, so badges and challenges that need a logged workout cannot be earned. They stay defined (for tests and to bring back) but are not shown or counted. */
export const HIDDEN_BADGES = new Set(['first-workout', 'workouts-10', 'workouts-50']);
export const HIDDEN_CHALLENGES = new Set(['train-3']);

export type BadgeStatus = BadgeDef & { current: number; unlocked: boolean; progress: number };
export function evaluateBadges(c: Ctx, includeHidden = false): BadgeStatus[] {
  return BADGES.filter((d) => includeHidden || !HIDDEN_BADGES.has(d.id)).map((d) => {
    const current = d.value(c);
    return { ...d, current, unlocked: current >= d.target, progress: Math.min(1, current / d.target) };
  });
}

// ---------------- weekly challenges ----------------
export type ChallengeDef = { id: string; title: string; target: number; unit: string; value: (c: Ctx, from: string, to: string) => number };
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
const countDays = (set: Set<string>, from: string, to: string) => [...set].filter((d) => inRange(d, from, to)).length;

export const CHALLENGES: ChallengeDef[] = [
  { id: 'log-6', title: 'Log your food on 6 days', target: 6, unit: 'days', value: (c, f, t) => countDays(c.loggedDays, f, t) },
  { id: 'water-5', title: 'Hit your water goal on 5 days', target: 5, unit: 'days', value: (c, f, t) => countDays(c.waterDays, f, t) },
  { id: 'steps-4', title: 'Hit your step goal on 4 days', target: 4, unit: 'days', value: (c, f, t) => countDays(c.stepDays, f, t) },
  { id: 'train-3', title: 'Finish 3 workouts', target: 3, unit: 'workouts', value: (c, f, t) => c.raw.workouts.filter((w) => inRange(w.date, f, t)).length },
  { id: 'active-150', title: 'Reach 150 active minutes', target: 150, unit: 'min', value: (c, f, t) => sum(Object.entries(c.minutesByDay).filter(([d]) => inRange(d, f, t)).map(([, m]) => m)) },
  { id: 'protein-5', title: 'Hit your protein goal on 5 days', target: 5, unit: 'days', value: (c, f, t) => countDays(c.proteinDays, f, t) },
  { id: 'checkin-5', title: 'Do 5 morning check-ins', target: 5, unit: 'check-ins', value: (c, f, t) => countDays(c.checkinDays, f, t) },
  { id: 'cook-3', title: 'Log 3 meals you cooked', target: 3, unit: 'recipes', value: (c, f, t) => c.raw.entries.filter((e) => e.foodId?.startsWith('recipe-') && inRange(e.date, f, t)).length },
];
export const CHALLENGE_POINTS = 10;

/** Three challenges for the week starting `monday`, rotating so the same ones don't repeat back to back. */
export function challengesForWeek(monday: string): ChallengeDef[] {
  const i = Math.floor(dayIndex(monday) / 7);
  const pool = CHALLENGES.filter((d) => !HIDDEN_CHALLENGES.has(d.id));
  const n = pool.length;
  return [i, i + 3, i + 5].map((k) => pool[((k % n) + n) % n]);
}

export type ChallengeStatus = ChallengeDef & { key: string; current: number; done: boolean; progress: number };
export function evaluateChallenges(c: Ctx): ChallengeStatus[] {
  const monday = weekStart(c.raw.today);
  const sunday = addDays(monday, 6);
  return challengesForWeek(monday).map((d) => {
    const current = d.value(c, monday, sunday);
    return { ...d, key: `${monday}:${d.id}`, current, done: current >= d.target, progress: Math.min(1, current / d.target) };
  });
}

// ---------------- levels ----------------
const LEVELS = [0, 25, 75, 150, 250, 400, 600, 850, 1150, 1500];
const TITLES = ['Starter', 'Mover', 'Consistent', 'Dedicated', 'Strong', 'Athlete', 'Champion', 'Elite', 'Master', 'Legend'];
export function levelFor(points: number): { level: number; title: string; into: number; needed: number; next: number | null } {
  const top = LEVELS[LEVELS.length - 1]; // 1500 = level 10; every further level needs 400 more
  let level = 1;
  let base = 0;
  let nextAt = LEVELS[1];
  if (points >= top) {
    level = LEVELS.length + Math.floor((points - top) / 400);
    base = top + (level - LEVELS.length) * 400;
    nextAt = base + 400;
  } else {
    for (let i = 1; i < LEVELS.length; i++) if (points >= LEVELS[i]) level = i + 1;
    base = LEVELS[level - 1];
    nextAt = LEVELS[level];
  }
  return { level, title: TITLES[Math.min(level, TITLES.length) - 1], into: points - base, needed: nextAt - base, next: nextAt };
}

/** Total points: badges + completed challenges (earlier weeks' completions are passed in from storage). */
export const totalPoints = (badges: BadgeStatus[], doneChallenges: number) => sum(badges.filter((x) => x.unlocked).map((x) => TIER_POINTS[x.tier])) + doneChallenges * CHALLENGE_POINTS;

// ---------------- nudge ----------------
/** A motivational message as a translation key + values, so the UI can show it in the user's language. */
export type NudgeInfo = { key: Key; vars: Record<string, string | number>; badgeId?: string; challengeId?: string };

/** One short, honest motivational message from the user's real progress. */
export function nudgeInfo(c: Ctx, badges: BadgeStatus[], challenges: ChallengeStatus[]): NudgeInfo {
  const log = c.streaks.log;
  if (log.current >= 3 && !log.todayDone) return { key: 'nudge.streakRisk', vars: { n: log.current } };
  const almost = badges.filter((x) => !x.unlocked && x.progress >= 0.7).sort((x, y) => y.progress - x.progress)[0];
  if (almost) return { key: 'nudge.badgeClose', vars: { left: Math.ceil(almost.target - almost.current), name: almost.name }, badgeId: almost.id };
  const one = challenges.find((x) => !x.done && x.target - x.current <= 1 && x.current > 0);
  if (one) return { key: 'nudge.challengeOne', vars: { title: one.title.toLowerCase() }, challengeId: one.id };
  if (log.current >= 1 && log.todayDone) return { key: log.current === 1 ? 'nudge.streakOk.one' : 'nudge.streakOk.other', vars: { n: log.current } };
  return { key: 'nudge.start', vars: {} };
}

/** The same message in English (used by tests and anywhere without a language setting). */
export const nudge = (c: Ctx, badges: BadgeStatus[], challenges: ChallengeStatus[]): string => {
  const i = nudgeInfo(c, badges, challenges);
  return translate('en', i.key, i.vars);
};
