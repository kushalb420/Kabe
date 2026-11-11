import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUILTIN_BACKEND, effectiveAiKey } from '../lib/backend';
import { foodFromMealItem, foodsFromEntries } from '../lib/myFoods';
import { Per100Extras, applyFilling, extrasOf, nameKey, needsFilling } from '../lib/enrich';
import { lookupFood } from '../lib/mealAi';
import { BUILTIN_GEMINI_KEY } from '../lib/builtinAi';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FOODS, Food } from '../data/foods';
import { EXERCISES, Exercise } from '../data/exercises';
import type { Lang } from '../i18n';
import { KABE_SYNC_KEYS } from '../lib/sync';
import { EMPTY_INTENT, Intent, sanitizeIntent } from '../lib/intent';
import { DEFAULT_LAYOUT, Layout, sanitizeLayout } from '../lib/dashboard';
import type { AiInsights } from '../lib/insights';
import { Extras, Macros, Profile, macrosFor, scaleToGrams, toDateKey } from '../lib/nutrition';
import { ExerciseLog, Workout, lastSets, suggestNext } from '../lib/workout';

export type Routine = { id: string; name: string; exercises: { exerciseId: string; name: string; sets: number }[] };

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snacks', icon: 'cafe-outline' },
];

export type Entry = Macros & Extras & {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  grams: number;
  foodId?: string;
  source: 'database' | 'custom' | 'manual' | 'usda' | 'off' | 'web' | 'ai' | 'photo' | 'restaurant' | 'voice';
};

export type SavedMealItem = Macros & Extras & { name: string; grams: number; foodId?: string; source: Entry['source'] };
/** `restaurant` is set for orders saved from the restaurant screen ("my usual"). */
export type SavedMeal = { id: string; name: string; items: SavedMealItem[]; restaurant?: string };

type Persisted = {
  entries: Entry[];
  customFoods: Food[];
  externalFoods: Food[]; // USDA / Open Food Facts foods the user has logged or starred
  favorites: string[]; // food ids
  savedMeals: SavedMeal[];
  geminiKey: string; // user's own free Google AI Studio key, for photo analysis
  aiConsent: boolean; // user agreed that photos are sent to Google (free tier may be used to improve its products)
  consentV2: boolean;
  sugarGoal: number | null; // the person's own free sugar limit (g); null = the WHO default of 10% of calories
  goalsCustom: boolean; // true when the person typed their own targets instead of using the suggested ones
  welcomed: boolean; // the first-run welcome screen has been seen
  userName: string; // what to call the person (Today greeting)
  nameAsked: boolean; // the nickname question has been shown (answered or skipped)
  coachConsent: boolean; // user agreed that questions + a summary of their logs are sent to Google for the coach chat
  language: Lang; // app language (device setting, not synced)
  intent: Intent; // what the person wants from Kabe (tailors the insights)
  dashboard: Layout; // which cards show on Today, and in what order
  insightCache: { key: string; tips: AiInsights } | null; // today's AI insights, so they are not asked for again (device-only)
  goals: Macros;
  profile: Profile | null;
  workouts: Workout[]; // finished, newest first
  routines: Routine[];
  customExercises: Exercise[];
  activeWorkout: Workout | null; // survives closing the app
};

const DEFAULTS: Persisted = {
  entries: [],
  customFoods: [],
  externalFoods: [],
  favorites: [],
  savedMeals: [],
  geminiKey: '',
  aiConsent: true, // AI sharing is on from the start (explained in Privacy, where it can be switched off)
  coachConsent: true,
  consentV2: false, // set once older installs have been moved to the default above
  goalsCustom: false,
  sugarGoal: null,
  welcomed: false,
  userName: '',
  nameAsked: false,
  language: 'en',
  intent: EMPTY_INTENT,
  dashboard: DEFAULT_LAYOUT,
  insightCache: null,
  goals: { kcal: 2000, protein: 120, carbs: 220, fat: 65, fiber: 30 },
  profile: null,
  workouts: [],
  routines: [],
  customExercises: [],
  activeWorkout: null,
};

const KEY = 'kabe:v1';
/** Keep a copy of online foods so favourites/recents still resolve offline. */
const MAX_REMEMBERED = 300;
/** Remember a food that is not in the built-in list, newest first. The list is capped so it never grows without end, but starred foods are always kept. */
const remember = (list: Food[], food: Food, favorites: string[]): Food[] => {
  if (!(food.source || food.category === 'Logged') || list.some((f) => f.id === food.id)) return list;
  const next = [food, ...list];
  return next.length <= MAX_REMEMBERED ? next : [...next.slice(0, MAX_REMEMBERED), ...next.slice(MAX_REMEMBERED).filter((f) => favorites.includes(f.id))];
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Ctx = Persisted & {
  ready: boolean;
  allFoods: Food[];
  recentFoods: Food[];
  historyFoods: Food[];
  addEntry: (
    food: Food,
    grams: number,
    meal: MealType,
    date: string,
    opts?: { photo?: boolean; restaurant?: boolean; voice?: boolean; macros?: Partial<Macros & Extras> },
  ) => void;
  /** Set exact values on a logged entry (grams and/or macros the user typed). */
  updateEntry: (id: string, patch: Partial<Pick<Entry, 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat'>>) => void;
  setGeminiKey: (key: string) => void;
  setAiConsent: (v: boolean) => void;
  setCoachConsent: (v: boolean) => void;
  setWelcomed: (v: boolean) => void;
  setUserName: (n: string) => void;
  skipNameAsk: () => void;
  setLanguage: (l: Lang) => void;
  setIntent: (i: Intent) => void;
  setDashboard: (l: Layout) => void;
  setInsightCache: (c: { key: string; tips: AiInsights } | null) => void;
  /** Replace the synced data with a downloaded snapshot (device-only settings like API keys are kept). */
  importSnapshot: (s: Record<string, unknown>) => void;
  updateEntryGrams: (id: string, grams: number) => void;
  removeEntry: (id: string) => void;
  addCustomFood: (food: Omit<Food, 'id' | 'custom'>) => Food;
  toggleFavorite: (food: Food) => void;
  allExercises: Exercise[];
  startWorkout: (routine?: Routine) => void;
  updateActive: (fn: (w: Workout) => Workout) => void;
  addExerciseToActive: (ex: Exercise) => void;
  finishWorkout: () => void;
  discardWorkout: () => void;
  deleteWorkout: (id: string) => void;
  saveRoutine: (name: string, w: Workout) => void;
  deleteRoutine: (id: string) => void;
  /** Your own split: a name and the exercises you choose, with a number of sets each. */
  createRoutine: (name: string, exercises: Routine['exercises']) => void;
  updateRoutine: (id: string, name: string, exercises: Routine['exercises']) => void;
  addCustomExercise: (name: string, muscle: Exercise['muscle']) => Exercise;
  saveMeal: (name: string, items: Entry[]) => void;
  /** Save a restaurant order ("my usual") so it can be logged again in one tap. */
  saveOrder: (name: string, restaurant: string, items: SavedMealItem[]) => void;
  addSavedMeal: (mealId: string, meal: MealType, date: string) => void;
  /** Log these items (for example a saved meal after editing it). */
  addMealItems: (items: SavedMealItem[], meal: MealType, date: string) => void;
  /** Replace the items of a saved meal. */
  updateSavedMeal: (mealId: string, items: SavedMealItem[]) => void;
  /** Keep each of these foods on its own in Saved foods (the favourites). Foods already saved are left alone. */
  saveFoods: (items: SavedMealItem[]) => void;
  deleteSavedMeal: (mealId: string) => void;
  setGoals: (g: Macros) => void; // suggested targets (clears "my own")
  setCustomGoals: (g: Macros) => void; // the person's own targets
  setSugarGoal: (g: number | null) => void; // own free sugar limit, null = default
  setProfile: (p: Profile) => void;
  resetAll: () => void;
};

const KabeContext = createContext<Ctx | null>(null);

export function KabeProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          // one-time move to "AI on by default"; anyone who switches it off afterwards stays off
          const existing = !!saved.profile || (Array.isArray(saved.entries) && saved.entries.length > 0); // people who already use Kabe skip the welcome
          setData({ ...DEFAULTS, ...saved, ...(saved.consentV2 ? {} : { aiConsent: true, coachConsent: true }), consentV2: true, welcomed: saved.welcomed ?? existing });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  // Foods logged without free sugar / saturated fat get them filled in quietly: Gemini is asked once per food name,
  // the answer is remembered on this phone, and only the missing numbers are added to the entries.
  const extras = useRef<{ known: Record<string, Per100Extras | null>; tried: Set<string>; loaded: boolean }>({ known: {}, tried: new Set(), loaded: false });
  const aiKey = effectiveAiKey(data.geminiKey, BUILTIN_BACKEND, BUILTIN_GEMINI_KEY);
  useEffect(() => {
    if (!ready || !aiKey || !data.aiConsent) return;
    let cancelled = false;
    const apply = () =>
      setData((d) => {
        const next = applyFilling(d.entries, extras.current.known);
        return next === d.entries ? d : { ...d, entries: next };
      });
    (async () => {
      const st = extras.current;
      if (!st.loaded) {
        st.loaded = true;
        try {
          const raw = await AsyncStorage.getItem('kabe:extras:v1');
          if (raw) st.known = { ...JSON.parse(raw), ...st.known };
        } catch {
          /* nothing remembered yet */
        }
      }
      apply();
      for (const name of needsFilling(data.entries, st.known, st.tried)) {
        if (cancelled) return;
        st.tried.add(nameKey(name));
        try {
          st.known[nameKey(name)] = extrasOf(await lookupFood(aiKey, name));
        } catch {
          break; // offline or out of free requests: stop this round, try again next time the app opens
        }
        AsyncStorage.setItem('kabe:extras:v1', JSON.stringify(st.known)).catch(() => {});
        apply();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, aiKey, data.aiConsent, data.entries.length]);

  const addEntry = useCallback<Ctx['addEntry']>((food, grams, meal, date, opts) => {
    const entry: Entry = {
      ...macrosFor(food, grams),
      ...(opts?.macros ?? {}), // numbers the user edited win over database values
      id: uid(),
      date,
      meal,
      name: food.name,
      grams,
      foodId: food.id,
      source: opts?.voice ? 'voice' : opts?.restaurant ? 'restaurant' : opts?.photo ? 'photo' : food.custom ? 'custom' : (food.source ?? 'database'),
    };
    setData((d) => ({
      ...d,
      entries: [...d.entries, entry],
      externalFoods: remember(d.externalFoods, food, d.favorites),
    }));
  }, []);

  const updateEntry = useCallback<Ctx['updateEntry']>((id, patch) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }, []);

  const updateEntryGrams = useCallback((id: string, grams: number) => {
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? scaleToGrams(e, grams) : e)) }));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }));
  }, []);

  const addCustomFood = useCallback<Ctx['addCustomFood']>((food) => {
    const created: Food = { ...food, id: `custom-${Date.now()}`, custom: true };
    setData((d) => ({ ...d, customFoods: [created, ...d.customFoods] }));
    return created;
  }, []);

  const toggleFavorite = useCallback((food: Food) => {
    setData((d) => ({
      ...d,
      favorites: d.favorites.includes(food.id) ? d.favorites.filter((x) => x !== food.id) : [food.id, ...d.favorites],
      externalFoods: remember(d.externalFoods, food, [food.id, ...d.favorites]),
    }));
  }, []);

  const setGeminiKey = useCallback((geminiKey: string) => setData((d) => ({ ...d, geminiKey: geminiKey.trim() })), []);
  const setAiConsent = useCallback((aiConsent: boolean) => setData((d) => ({ ...d, aiConsent })), []);
  const setUserName = useCallback((userName: string) => setData((d) => ({ ...d, userName: userName.replace(/\s+/g, ' ').trim().slice(0, 30), nameAsked: true })), []);
  const skipNameAsk = useCallback(() => setData((d) => ({ ...d, nameAsked: true })), []);
  const setWelcomed = useCallback((welcomed: boolean) => setData((d) => ({ ...d, welcomed })), []);
  const setCoachConsent = useCallback((coachConsent: boolean) => setData((d) => ({ ...d, coachConsent })), []);
  const setLanguage = useCallback((language: Lang) => setData((d) => ({ ...d, language })), []);
  const setIntent = useCallback((intent: Intent) => setData((d) => ({ ...d, intent: sanitizeIntent(intent) })), []);
  const setDashboard = useCallback((layout: Layout) => setData((d) => ({ ...d, dashboard: sanitizeLayout(layout) })), []);
  const setInsightCache = useCallback((insightCache: { key: string; tips: AiInsights } | null) => setData((d) => ({ ...d, insightCache })), []);
  const importSnapshot = useCallback((s: Record<string, unknown>) => {
    setData((d) => {
      const next: Record<string, unknown> = { ...d };
      for (const k of KABE_SYNC_KEYS) next[k] = s[k] ?? (DEFAULTS as Record<string, unknown>)[k];
      return next as Persisted;
    });
  }, []);

  const saveMeal = useCallback((name: string, items: Entry[]) => {
    if (!items.length) return;
    const saved: SavedMeal = {
      id: uid(),
      name,
      items: items.map(({ name: n, grams, foodId, source, kcal, protein, carbs, fat, fiber, sugar, sodium, satFat }) => ({
        name: n, grams, foodId, source, kcal, protein, carbs, fat, fiber, sugar, sodium, satFat,
      })),
    };
    setData((d) => ({ ...d, savedMeals: [saved, ...d.savedMeals] }));
  }, []);

  const saveOrder = useCallback((name: string, restaurant: string, items: SavedMealItem[]) => {
    if (!items.length) return;
    const saved: SavedMeal = { id: uid(), name, restaurant: restaurant.trim() || undefined, items };
    setData((d) => ({ ...d, savedMeals: [saved, ...d.savedMeals] }));
  }, []);

  const addSavedMeal = useCallback((mealId: string, meal: MealType, date: string) => {
    setData((d) => {
      const sm = d.savedMeals.find((m) => m.id === mealId);
      if (!sm) return d;
      const added: Entry[] = sm.items.map((it) => ({ ...it, id: uid(), date, meal }));
      return { ...d, entries: [...d.entries, ...added] };
    });
  }, []);

  const addMealItems = useCallback<Ctx['addMealItems']>((items, meal, date) => {
    if (!items.length) return;
    setData((d) => ({ ...d, entries: [...d.entries, ...items.map((it) => ({ ...it, id: uid(), date, meal }))] }));
  }, []);

  const updateSavedMeal = useCallback<Ctx['updateSavedMeal']>((mealId, items) => {
    if (!items.length) return;
    setData((d) => ({ ...d, savedMeals: d.savedMeals.map((m) => (m.id === mealId ? { ...m, items } : m)) }));
  }, []);

  const saveFoods = useCallback<Ctx['saveFoods']>((items) => {
    setData((d) => {
      let favorites = d.favorites;
      let externalFoods = d.externalFoods;
      for (const it of items) {
        const food = foodFromMealItem(it);
        if (!food || favorites.includes(food.id)) continue;
        favorites = [food.id, ...favorites];
        externalFoods = remember(externalFoods, food, favorites);
      }
      return favorites === d.favorites ? d : { ...d, favorites, externalFoods };
    });
  }, []);

  const deleteSavedMeal = useCallback((mealId: string) => {
    setData((d) => ({ ...d, savedMeals: d.savedMeals.filter((m) => m.id !== mealId) }));
  }, []);

  const newExerciseLog = (ex: { id?: string; exerciseId?: string; name: string }, workouts: Workout[], count = 3): ExerciseLog => {
    const exerciseId = ex.exerciseId ?? ex.id ?? ex.name;
    const prev = lastSets(exerciseId, workouts);
    const sug = suggestNext(prev);
    const n = Math.max(count, 1);
    return {
      exerciseId,
      name: ex.name,
      sets: Array.from({ length: n }, () => ({
        id: uid(),
        weight: sug?.weight ?? 0,
        reps: sug?.reps ?? 0,
        done: false,
      })),
    };
  };

  const startWorkout = useCallback((routine?: Routine) => {
    setData((d) => {
      if (d.activeWorkout) return d;
      const now = Date.now();
      const w: Workout = {
        id: uid(),
        name: routine?.name ?? 'Workout',
        date: toDateKey(new Date(now)),
        startedAt: now,
        durationSec: 0,
        exercises: (routine?.exercises ?? []).map((r) => newExerciseLog(r, d.workouts, r.sets)),
      };
      return { ...d, activeWorkout: w };
    });
  }, []);

  const updateActive = useCallback((fn: (w: Workout) => Workout) => {
    setData((d) => (d.activeWorkout ? { ...d, activeWorkout: fn(d.activeWorkout) } : d));
  }, []);

  const addExerciseToActive = useCallback((ex: Exercise) => {
    setData((d) =>
      d.activeWorkout
        ? { ...d, activeWorkout: { ...d.activeWorkout, exercises: [...d.activeWorkout.exercises, newExerciseLog({ id: ex.id, name: ex.name }, d.workouts)] } }
        : d,
    );
  }, []);

  const finishWorkout = useCallback(() => {
    setData((d) => {
      const a = d.activeWorkout;
      if (!a) return d;
      // keep only completed sets; drop exercises with none
      const exercises = a.exercises
        .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done) }))
        .filter((ex) => ex.sets.length > 0);
      const done: Workout = { ...a, exercises, durationSec: Math.round((Date.now() - a.startedAt) / 1000) };
      return { ...d, activeWorkout: null, workouts: exercises.length ? [done, ...d.workouts] : d.workouts };
    });
  }, []);

  const discardWorkout = useCallback(() => setData((d) => ({ ...d, activeWorkout: null })), []);
  const deleteWorkout = useCallback((id: string) => setData((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) })), []);

  const saveRoutine = useCallback((name: string, w: Workout) => {
    const r: Routine = {
      id: uid(),
      name,
      exercises: w.exercises.map((ex) => ({ exerciseId: ex.exerciseId, name: ex.name, sets: Math.max(ex.sets.length, 1) })),
    };
    setData((d) => ({ ...d, routines: [r, ...d.routines] }));
  }, []);

  const createRoutine = useCallback((name: string, exercises: Routine['exercises']) => {
    if (!name.trim() || exercises.length === 0) return;
    setData((d) => ({ ...d, routines: [{ id: uid(), name: name.trim(), exercises }, ...d.routines] }));
  }, []);
  const updateRoutine = useCallback((id: string, name: string, exercises: Routine['exercises']) => {
    if (!name.trim() || exercises.length === 0) return;
    setData((d) => ({ ...d, routines: d.routines.map((r) => (r.id === id ? { ...r, name: name.trim(), exercises } : r)) }));
  }, []);
  const deleteRoutine = useCallback((id: string) => setData((d) => ({ ...d, routines: d.routines.filter((r) => r.id !== id) })), []);

  const addCustomExercise = useCallback((name: string, muscle: Exercise['muscle']) => {
    const ex: Exercise = { id: `custom-${Date.now()}`, name, muscle, equipment: 'Custom', custom: true };
    setData((d) => ({ ...d, customExercises: [ex, ...d.customExercises] }));
    return ex;
  }, []);

  const setGoals = useCallback((goals: Macros) => setData((d) => ({ ...d, goals, goalsCustom: false })), []);
  const setSugarGoal = useCallback((g: number | null) => setData((d) => ({ ...d, sugarGoal: typeof g === 'number' && g > 0 && g <= 500 ? Math.round(g) : null })), []);
  const setCustomGoals = useCallback((goals: Macros) => setData((d) => ({ ...d, goals, goalsCustom: true })), []);
  const setProfile = useCallback((profile: Profile) => setData((d) => ({ ...d, profile })), []);
  const resetAll = useCallback(() => setData(DEFAULTS), []);

  const allFoods = useMemo(
    () => [...data.customFoods, ...FOODS, ...data.externalFoods],
    [data.customFoods, data.externalFoods],
  );

  const allExercises = useMemo(() => [...data.customExercises, ...EXERCISES], [data.customExercises]);

  /** Everything the person has logged, as foods to log again (newest first). */
  const historyFoods = useMemo(() => foodsFromEntries(data.entries), [data.entries]);
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (let i = data.entries.length - 1; i >= 0 && out.length < 8; i--) {
      const id = data.entries[i].foodId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const food = allFoods.find((f) => f.id === id);
      if (food) out.push(food);
    }
    return out;
  }, [data.entries, allFoods]);

  const value = useMemo(
    () => ({
      ...data,
      geminiKey: effectiveAiKey(data.geminiKey, BUILTIN_BACKEND, BUILTIN_GEMINI_KEY),
      historyFoods,
      ready,
      allFoods,
      recentFoods,
      addEntry,
      updateEntryGrams,
      updateEntry,
      removeEntry,
      addCustomFood,
      toggleFavorite,
      setGeminiKey,
      setAiConsent,
      setCoachConsent,
      setWelcomed,
      setUserName,
      skipNameAsk,
      setLanguage,
      setIntent,
      setDashboard,
      setInsightCache,
      importSnapshot,
      allExercises,
      startWorkout,
      updateActive,
      addExerciseToActive,
      finishWorkout,
      discardWorkout,
      deleteWorkout,
      saveRoutine,
      deleteRoutine,
      createRoutine,
      updateRoutine,
      addCustomExercise,
      saveMeal,
      saveOrder,
      addSavedMeal,
      addMealItems,
      updateSavedMeal,
      saveFoods,
      deleteSavedMeal,
      setGoals,
      setCustomGoals,
      setSugarGoal,
      setProfile,
      resetAll,
    }),
    [data, ready, allFoods, recentFoods, historyFoods, setUserName, skipNameAsk, addEntry, updateEntryGrams, updateEntry, removeEntry, addCustomFood, toggleFavorite, setGeminiKey, setAiConsent, setCoachConsent, setWelcomed, setLanguage, setIntent, setDashboard, setInsightCache, importSnapshot, allExercises, startWorkout, updateActive, addExerciseToActive, finishWorkout, discardWorkout, deleteWorkout, saveRoutine, deleteRoutine, createRoutine, updateRoutine, addCustomExercise, saveMeal, saveOrder, addSavedMeal, addMealItems, updateSavedMeal, saveFoods, deleteSavedMeal, setGoals, setCustomGoals, setSugarGoal, setProfile, resetAll],
  );

  return <KabeContext.Provider value={value}>{children}</KabeContext.Provider>;
}

export function useKabe() {
  const ctx = useContext(KabeContext);
  if (!ctx) throw new Error('useKabe must be used inside KabeProvider');
  return ctx;
}
