// Builds the compact JSON summary of the user's data that the coach is allowed to see.
import type { Food } from '../data/foods';
import type { CaffeineEntry, Named } from '../store/tracker';
import type { Entry } from '../store/kabe';
import { CoachAnalysis } from './coach';
import { MIN_KCAL, Macros, Profile, r0, r1 } from './nutrition';
import { Workout, workoutSetCount, workoutVolume } from './workout';
import { DayLog, WeightEntry, addDays } from './tracker';
import { exceedSummary } from './limits';

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function buildCoachContext(a: {
  today: string;
  profile: Profile | null;
  goals: Macros;
  entries: Entry[];
  weights: WeightEntry[];
  goalWeight: number | null;
  workouts: Workout[];
  water: Record<string, number>;
  waterGoal: number;
  caffeine: CaffeineEntry[];
  habits: Named[];
  habitLog: DayLog;
  supplements: Named[];
  supplementLog: DayLog;
  quickFoods: Food[]; // favourites + recent
  analysis: CoachAnalysis;
  sugarGoal?: number | null; // the person's own free sugar limit in grams
  lifestyle?: Record<string, unknown>; // recovery + activity summary computed by the app
}) {
  const { today, analysis: z } = a;
  const todays = a.entries.filter((e) => e.date === today);
  const eaten = todays.reduce((s, e) => ({ kcal: s.kcal + e.kcal, protein: s.protein + e.protein, carbs: s.carbs + e.carbs, fat: s.fat + e.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const since = addDays(today, -13);
  const t = z.tdee;
  return {
    today,
    profile: a.profile
      ? { sex: a.profile.sex, age: a.profile.age, heightCm: a.profile.heightCm, activity: a.profile.activity, goal: a.profile.goal }
      : 'not set up yet (ask the user to fill in Me → Calculate my targets for better advice)',
    currentWeightKg: round(z.weightKg, 1),
    goalWeightKg: a.goalWeight,
    dailyTargets: { kcal: a.goals.kcal, proteinG: a.goals.protein, carbsG: a.goals.carbs, fatG: a.goals.fat },
    minimumSafeKcal: a.profile ? MIN_KCAL[a.profile.sex] : MIN_KCAL.female,
    todaySoFar: { kcal: r0(eaten.kcal), proteinG: r0(eaten.protein), carbsG: r0(eaten.carbs), fatG: r0(eaten.fat), itemsLogged: todays.length },
    limitsExceeded: exceedSummary(a.entries, a.goals, today, z.days28.slice(-7).map((d) => d.date), a.sugarGoal), // free sugar, carbs, fat and saturated fat over their daily limits
    remainingToday: { kcal: r0(a.goals.kcal - eaten.kcal), proteinG: r0(a.goals.protein - eaten.protein) },
    last7DaysFood: z.days28.slice(-7).map((d) => ({ date: d.date, logged: d.kcal > 0, kcal: r0(d.kcal), proteinG: r0(d.protein) })),
    weekSummary: z.week,
    weighIns14d: a.weights.filter((w) => w.date >= since).map((w) => ({ date: w.date, kg: w.kg })),
    analysis: {
      weightTrendKgPerWeek: z.slope ? round(z.slope.kgPerWeek, 2) : 'not enough weigh-ins yet',
      planStatus: z.status, // progressing | slow | plateau | stable | drifting | insufficient | unclear
      losingTooFast: z.tooFast,
      measuredDailyCaloriesBurned: t.ok ? { kcal: t.tdee, confidence: t.confidence, avgIntake: t.avgIntake } : `unknown — ${t.reason}`,
      suggestedDailyKcal: { kcal: z.target.kcal, basedOn: z.target.basis, note: z.target.note },
      goalForecast: z.forecast.ok ? { weeks: z.forecast.weeks, date: z.forecast.date } : `none (${z.forecast.reason})`,
    },
    workoutsLast14d: a.workouts
      .filter((w) => w.date >= since)
      .map((w) => ({ date: w.date, name: w.name, sets: workoutSetCount(w), volumeKg: r0(workoutVolume(w)), exercises: w.exercises.map((e) => e.name) })),
    recoveryAndActivity: a.lifestyle ?? 'not logged',
    hydration: { todayMl: a.water[today] ?? 0, goalMl: a.waterGoal },
    caffeineTodayMg: a.caffeine.filter((c) => c.date === today).reduce((s, c) => s + c.mg, 0),
    habitsDoneToday: a.habits.filter((h) => a.habitLog[today]?.includes(h.id)).map((h) => h.name),
    habitsNotDoneToday: a.habits.filter((h) => !a.habitLog[today]?.includes(h.id)).map((h) => h.name),
    supplementsTakenToday: a.supplements.filter((s) => a.supplementLog[today]?.includes(s.id)).map((s) => s.name),
    favouriteAndRecentFoods: a.quickFoods.slice(0, 12).map((f) => ({
      name: f.name,
      serving: f.servingLabel,
      kcalPerServing: r0((f.kcal * f.servingG) / 100),
      proteinGPerServing: r1((f.protein * f.servingG) / 100),
    })),
  };
}
