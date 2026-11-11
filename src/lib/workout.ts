export type SetLog = { id: string; weight: number; reps: number; done: boolean };
export type ExerciseLog = { exerciseId: string; name: string; sets: SetLog[] };
export type Workout = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  startedAt: number; // ms
  durationSec: number;
  exercises: ExerciseLog[];
};

/** Epley estimated one-rep max. Only meaningful for ~1–12 reps. */
export const est1RM = (weight: number, reps: number) =>
  weight > 0 && reps > 0 ? (reps === 1 ? weight : weight * (1 + reps / 30)) : 0;

export const setVolume = (s: Pick<SetLog, 'weight' | 'reps'>) => s.weight * s.reps;

export const workoutVolume = (w: Workout) =>
  w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done).reduce((b, s) => b + setVolume(s), 0), 0);

export const workoutSetCount = (w: Workout) =>
  w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.done).length, 0);

/** Sets from the most recent finished workout containing this exercise (newest first input). */
export const lastSets = (exerciseId: string, workouts: Workout[]): SetLog[] => {
  for (const w of workouts) {
    const ex = w.exercises.find((x) => x.exerciseId === exerciseId);
    const done = ex?.sets.filter((s) => s.done);
    if (done && done.length) return done;
  }
  return [];
};

/** `reason` is English (tests, logs); `why` lets the UI show the same advice in the user's language. */
export type Suggestion = { weight: number; reps: number; reason: string; why: { key: 'bodyweight' | 'addWeight' | 'same'; reps?: number; step?: number } };

/**
 * Simple, transparent double-progression rule (not AI):
 * - every set hit the top of the rep range -> add weight, restart at the bottom
 * - otherwise keep the weight and aim for +1 rep on the weakest set
 */
export const suggestNext = (prev: SetLog[], repMin = 8, repMax = 12, step = 2.5): Suggestion | null => {
  if (!prev.length) return null;
  const weight = Math.max(...prev.map((s) => s.weight));
  const atWeight = prev.filter((s) => s.weight === weight);
  const minReps = Math.min(...atWeight.map((s) => s.reps));
  if (weight <= 0) return { weight: 0, reps: Math.min(minReps + 1, 30), reason: 'Bodyweight: aim for one more rep.', why: { key: 'bodyweight' } };
  if (minReps >= repMax) {
    return { weight: weight + step, reps: repMin, reason: `You hit ${repMax} reps on every set — add ${step} kg.`, why: { key: 'addWeight', reps: repMax, step } };
  }
  const next = Math.min(minReps + 1, repMax);
  return { weight, reps: next, reason: `Same weight, aim for ${next} reps each set.`, why: { key: 'same', reps: next } };
};

/** Best estimated 1RM per exercise across history. */
export const records = (workouts: Workout[]) => {
  const best = new Map<string, { name: string; e1rm: number; weight: number; reps: number; date: string }>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (!s.done || s.weight <= 0 || s.reps <= 0 || s.reps > 12) continue;
        const v = est1RM(s.weight, s.reps);
        const cur = best.get(ex.exerciseId);
        if (!cur || v > cur.e1rm) best.set(ex.exerciseId, { name: ex.name, e1rm: v, weight: s.weight, reps: s.reps, date: w.date });
      }
    }
  }
  return [...best.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.e1rm - a.e1rm);
};

export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Best estimated 1RM of this exercise in each workout, oldest first (for a progress chart). */
export const exerciseHistory = (exerciseId: string, workouts: Workout[]) =>
  [...workouts]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((w) => {
      const ex = w.exercises.find((x) => x.exerciseId === exerciseId);
      const best = Math.max(0, ...(ex?.sets ?? []).filter((s) => s.done && s.reps > 0 && s.reps <= 12).map((s) => est1RM(s.weight, s.reps)));
      return { date: w.date, e1rm: best };
    })
    .filter((p) => p.e1rm > 0);
