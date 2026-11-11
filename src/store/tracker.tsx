import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Activity } from '../lib/activity';
import type { ChatMsg } from '../lib/coachChat';
import type { ProgressPhoto } from '../lib/progressPhotos';
import { CustomReminder, DEFAULT_PREFS, NotifPrefs, Snooze, liveSnoozes, sanitizeCustom, sanitizePrefs } from '../lib/notify';
import { DEFAULT_REMINDERS, ReminderSettings, sanitizeReminders } from '../lib/reminders';
import type { Checkin } from '../lib/recovery';
import { TRACKER_SYNC_KEYS } from '../lib/sync';
import { Schedule, SuppComposition, addDose, cleanSchedule, dosesDue, dosesTaken, removeDose } from '../lib/supplements';
import { DayLog, Measurement, WeightEntry, toggleId, upsertMeasurement, upsertWeight } from '../lib/tracker';

/** A habit or supplement. remind = a daily reminder time; schedule and composition are for supplements (how often, and what one dose holds). */
export type Named = { id: string; name: string; dose?: string; remind?: { hour: number; minute: number }; schedule?: Schedule; composition?: SuppComposition };
export type CaffeineEntry = { id: string; date: string; name: string; mg: number };

type Persisted = {
  weights: WeightEntry[];
  measurements: Measurement[];
  water: Record<string, number>; // date -> ml
  waterGoal: number;
  caffeine: CaffeineEntry[];
  supplements: Named[];
  supplementLog: DayLog;
  habits: Named[];
  habitLog: DayLog;
  goalWeight: number | null; // kg, set in the Coach tab
  coachChat: ChatMsg[]; // last messages of the coach conversation
  checkins: Record<string, Checkin>; // morning recovery check-in per date
  restDays: string[]; // dates the user marked as rest days
  activities: Activity[]; // walks, runs, rides, cardio sessions
  steps: Record<string, number>; // steps per date (typed in)
  photos: ProgressPhoto[]; // progress photos: the files stay on this phone, nothing about them is synced
  stepGoal: number;
  reminders: ReminderSettings; // local reminders (device setting, not synced)
  notif: NotifPrefs; // follow-ups, snooze, the idle nudge, the master switch
  customReminders: CustomReminder[]; // the person's own reminders
  customDone: DayLog; // date -> ids of own reminders marked done
  snoozes: Snooze[]; // snoozed notifications waiting to come back (device only)
  autoSteps: boolean; // read steps from the phone's step counter (turned on by default)
  sleepGoal: number; // hours
  badges: Record<string, string>; // badge id → date first earned
  challengesDone: Record<string, string>; // "weekStart:challengeId" → date completed
};

const DEFAULTS: Persisted = {
  weights: [],
  measurements: [],
  water: {},
  waterGoal: 2500,
  caffeine: [],
  supplements: [],
  supplementLog: {},
  habits: [],
  habitLog: {},
  goalWeight: null,
  coachChat: [],
  checkins: {},
  restDays: [],
  activities: [],
  steps: {},
  photos: [],
  reminders: DEFAULT_REMINDERS,
  notif: DEFAULT_PREFS,
  customReminders: [],
  customDone: {},
  snoozes: [],
  autoSteps: true,
  stepGoal: 8000,
  sleepGoal: 8,
  badges: {},
  challengesDone: {},
};

const KEY = 'kabe:tracker:v1';
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Ctx = Persisted & {
  ready: boolean; // saved data has been read from the phone
  logWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;
  logMeasurement: (m: Measurement) => void;
  removeMeasurement: (date: string) => void;
  addWater: (date: string, ml: number) => void; // negative to undo
  setWaterGoal: (ml: number) => void;
  addCaffeine: (date: string, name: string, mg: number) => void;
  removeCaffeine: (id: string) => void;
  /** Adds a supplement and returns its id. */
  addSupplement: (name: string, dose?: string, schedule?: Schedule, composition?: SuppComposition) => string;
  removeSupplement: (id: string) => void;
  /** Change a supplement's dose, schedule or what one dose contains. */
  updateSupplement: (id: string, patch: Partial<Pick<Named, 'dose' | 'schedule' | 'composition'>>) => void;
  /** One more dose taken on a date / take the last one back. */
  takeDose: (date: string, id: string) => void;
  undoDose: (date: string, id: string) => void;
  /** Set (or clear with null) the daily reminder time of a habit or supplement. */
  setItemReminder: (kind: 'habit' | 'supplement', id: string, remind: { hour: number; minute: number } | null) => void;
  addHabit: (name: string) => void;
  removeHabit: (id: string) => void;
  toggleHabit: (date: string, id: string) => void;
  /** Remember newly earned badges / completed challenges (never removes or overwrites an earlier date). */
  recordProgress: (badgeIds: string[], challengeKeys: string[], date: string) => void;
  saveCheckin: (date: string, c: Checkin) => void;
  toggleRestDay: (date: string) => void;
  addActivity: (a: Omit<Activity, 'id'>) => void;
  removeActivity: (id: string) => void;
  addPhoto: (p: ProgressPhoto) => void;
  removePhoto: (id: string) => void;
  setSteps: (date: string, steps: number | null) => void;
  setStepGoal: (n: number) => void;
  setAutoSteps: (on: boolean) => void;
  setReminders: (r: ReminderSettings) => void;
  setNotif: (p: NotifPrefs) => void;
  saveCustomReminder: (r: Omit<CustomReminder, 'id'> & { id?: string }) => void;
  removeCustomReminder: (id: string) => void;
  /** Marks a habit, supplement or own reminder done for a date (never un-marks: a notification's Done is one way). */
  markDone: (kind: 'habit' | 'supplement' | 'custom', id: string, date: string) => void;
  addSnooze: (s: Snooze) => void;
  setSleepGoal: (h: number) => void;
  setGoalWeight: (kg: number | null) => void;
  addCoachMessage: (m: ChatMsg) => void;
  clearCoachChat: () => void;
  /** Replace the synced data with a downloaded snapshot (the local coach chat is kept). */
  importSnapshot: (s: Record<string, unknown>) => void;
  resetTracker: () => void;
};

const TrackerContext = createContext<Ctx | null>(null);

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setData({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  const logWeight = useCallback((date: string, kg: number) => setData((d) => ({ ...d, weights: upsertWeight(d.weights, date, kg) })), []);
  const removeWeight = useCallback((date: string) => setData((d) => ({ ...d, weights: d.weights.filter((w) => w.date !== date) })), []);
  const logMeasurement = useCallback((m: Measurement) => setData((d) => ({ ...d, measurements: upsertMeasurement(d.measurements, m) })), []);
  const removeMeasurement = useCallback((date: string) => setData((d) => ({ ...d, measurements: d.measurements.filter((m) => m.date !== date) })), []);

  const addWater = useCallback(
    (date: string, ml: number) =>
      setData((d) => ({ ...d, water: { ...d.water, [date]: Math.max(0, (d.water[date] ?? 0) + ml) } })),
    [],
  );
  const setWaterGoal = useCallback((waterGoal: number) => setData((d) => ({ ...d, waterGoal: Math.max(500, waterGoal) })), []);

  const addCaffeine = useCallback(
    (date: string, name: string, mg: number) => setData((d) => ({ ...d, caffeine: [...d.caffeine, { id: uid(), date, name, mg }] })),
    [],
  );
  const removeCaffeine = useCallback((id: string) => setData((d) => ({ ...d, caffeine: d.caffeine.filter((c) => c.id !== id) })), []);

  const addSupplement = useCallback<Ctx['addSupplement']>((name, dose, schedule, composition) => {
    const id = uid();
    setData((d) => ({ ...d, supplements: [...d.supplements, { id, name, ...(dose ? { dose } : {}), ...(schedule ? { schedule } : {}), ...(composition ? { composition } : {}) }] }));
    return id;
  }, []);
  const updateSupplement = useCallback<Ctx['updateSupplement']>((id, patch) => setData((d) => ({ ...d, supplements: d.supplements.map((x) => (x.id === id ? { ...x, ...patch } : x)) })), []);
  const takeDose = useCallback((date: string, id: string) => setData((d) => ({ ...d, supplementLog: addDose(d.supplementLog, date, id) })), []);
  const undoDose = useCallback((date: string, id: string) => setData((d) => ({ ...d, supplementLog: removeDose(d.supplementLog, date, id) })), []);
  const removeSupplement = useCallback((id: string) => setData((d) => ({ ...d, supplements: d.supplements.filter((s) => s.id !== id) })), []);

  const setItemReminder = useCallback<Ctx['setItemReminder']>(
    (kind, id, remind) =>
      setData((d) => {
        const key = kind === 'habit' ? 'habits' : 'supplements';
        return { ...d, [key]: d[key].map((x) => (x.id === id ? (remind ? { ...x, remind } : (({ remind: _r, ...rest }) => rest)(x)) : x)) };
      }),
    [],
  );
  const addHabit = useCallback((name: string) => setData((d) => ({ ...d, habits: [...d.habits, { id: uid(), name }] })), []);
  const removeHabit = useCallback((id: string) => setData((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) })), []);
  const toggleHabit = useCallback((date: string, id: string) => setData((d) => ({ ...d, habitLog: toggleId(d.habitLog, date, id) })), []);

  const recordProgress = useCallback((badgeIds: string[], challengeKeys: string[], date: string) => setData((d) => {
    const badges = { ...d.badges };
    const challengesDone = { ...d.challengesDone };
    let changed = false;
    for (const id of badgeIds) if (!badges[id]) { badges[id] = date; changed = true; }
    for (const k of challengeKeys) if (!challengesDone[k]) { challengesDone[k] = date; changed = true; }
    return changed ? { ...d, badges, challengesDone } : d;
  }), []);
  const saveCheckin = useCallback((date: string, c: Checkin) => setData((d) => ({ ...d, checkins: { ...d.checkins, [date]: c } })), []);
  const toggleRestDay = useCallback((date: string) => setData((d) => ({ ...d, restDays: d.restDays.includes(date) ? d.restDays.filter((x) => x !== date) : [...d.restDays, date] })), []);
  const addActivity = useCallback((a: Omit<Activity, 'id'>) => setData((d) => ({ ...d, activities: [...d.activities, { ...a, id: uid() }] })), []);
  const addPhoto = useCallback((p: ProgressPhoto) => setData((d) => ({ ...d, photos: [...d.photos, p] })), []);
  const removePhoto = useCallback((id: string) => setData((d) => ({ ...d, photos: d.photos.filter((x) => x.id !== id) })), []);
  const removeActivity = useCallback((id: string) => setData((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== id) })), []);
  const setSteps = useCallback((date: string, steps: number | null) => setData((d) => {
    const next = { ...d.steps };
    if (steps === null || !(steps > 0)) delete next[date];
    else next[date] = Math.round(steps);
    return { ...d, steps: next };
  }), []);
  const setStepGoal = useCallback((n: number) => setData((d) => ({ ...d, stepGoal: Math.min(50000, Math.max(1000, Math.round(n))) })), []);
  const setSleepGoal = useCallback((h: number) => setData((d) => ({ ...d, sleepGoal: Math.min(12, Math.max(4, h)) })), []);
  const setReminders = useCallback((reminders: ReminderSettings) => setData((d) => ({ ...d, reminders: sanitizeReminders(reminders) })), []);
  const setNotif = useCallback((p: NotifPrefs) => setData((d) => ({ ...d, notif: sanitizePrefs(p) })), []);
  const saveCustomReminder = useCallback<Ctx['saveCustomReminder']>(
    (r) =>
      setData((d) => {
        const id = r.id ?? uid();
        const next = d.customReminders.some((x) => x.id === id) ? d.customReminders.map((x) => (x.id === id ? { ...r, id } : x)) : [...d.customReminders, { ...r, id }];
        return { ...d, customReminders: sanitizeCustom(next) };
      }),
    [],
  );
  const removeCustomReminder = useCallback((id: string) => setData((d) => ({ ...d, customReminders: d.customReminders.filter((x) => x.id !== id) })), []);
  const markDone = useCallback<Ctx['markDone']>(
    (kind, id, date) =>
      setData((d) => {
        if (kind === 'supplement') {
          // a notification's Done takes one dose, up to what is due that day
          const s = d.supplements.find((x) => x.id === id);
          const max = Math.max(1, s ? dosesDue(cleanSchedule(s.schedule, date), date) : 1);
          return dosesTaken(d.supplementLog[date], id) >= max ? d : { ...d, supplementLog: addDose(d.supplementLog, date, id) };
        }
        const key = kind === 'habit' ? 'habitLog' : 'customDone';
        if ((d[key][date] ?? []).includes(id)) return d;
        return { ...d, [key]: toggleId(d[key], date, id) };
      }),
    [],
  );
  const addSnooze = useCallback((s: Snooze) => setData((d) => ({ ...d, snoozes: liveSnoozes([...d.snoozes.filter((x) => x.key !== s.key), s], new Date()) })), []);
  const setAutoSteps = useCallback((autoSteps: boolean) => setData((d) => ({ ...d, autoSteps })), []);
  const setGoalWeight = useCallback((goalWeight: number | null) => setData((d) => ({ ...d, goalWeight })), []);
  const addCoachMessage = useCallback((m: ChatMsg) => setData((d) => ({ ...d, coachChat: [...d.coachChat, m].slice(-40) })), []);
  const clearCoachChat = useCallback(() => setData((d) => ({ ...d, coachChat: [] })), []);

  const importSnapshot = useCallback((s: Record<string, unknown>) => {
    setData((d) => {
      const next: Record<string, unknown> = { ...d };
      for (const k of TRACKER_SYNC_KEYS) next[k] = s[k] ?? (DEFAULTS as Record<string, unknown>)[k];
      return next as Persisted;
    });
  }, []);

  const resetTracker = useCallback(() => setData(DEFAULTS), []);

  const value = useMemo(
    () => ({
      ...data,
      ready,
      logWeight, removeWeight, logMeasurement, removeMeasurement, addWater, setWaterGoal,
      addCaffeine, removeCaffeine, addSupplement, removeSupplement, updateSupplement, takeDose, undoDose,
      addHabit, removeHabit, toggleHabit, setItemReminder, setGoalWeight, addCoachMessage, clearCoachChat, importSnapshot, resetTracker,
      recordProgress, saveCheckin, toggleRestDay, addActivity, removeActivity, addPhoto, removePhoto, setSteps, setStepGoal, setAutoSteps, setReminders, setNotif, saveCustomReminder, removeCustomReminder, markDone, addSnooze, setSleepGoal,
    }),
    [data, ready, importSnapshot, recordProgress, saveCheckin, toggleRestDay, addActivity, removeActivity, addPhoto, removePhoto, setSteps, setStepGoal, setAutoSteps, setReminders, setNotif, saveCustomReminder, removeCustomReminder, markDone, addSnooze, setSleepGoal, setGoalWeight, addCoachMessage, clearCoachChat, logWeight, removeWeight, logMeasurement, removeMeasurement, addWater, setWaterGoal, addCaffeine, removeCaffeine, addSupplement, removeSupplement, updateSupplement, takeDose, undoDose, addHabit, removeHabit, toggleHabit, setItemReminder, resetTracker],
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used inside TrackerProvider');
  return ctx;
}
