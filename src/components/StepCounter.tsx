import { Pedometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { loadHealthConnect, readTodayStepsWith } from '../lib/healthConnect';
import { toDateKey } from '../lib/nutrition';
import { nextTotal, shouldSave, startOfDay, withSession } from '../lib/steps';
import { useTracker } from '../store/tracker';

/**
 * Logs today's steps from the phone's built-in step counter. Renders nothing.
 * iPhone: the whole day is read from the system. Android with a development build: the whole day from Health Connect.
 * Android in Expo Go: steps are counted while Kabe is open (Expo Go cannot read the day's history).
 */
export function StepCounter() {
  const { autoSteps, setSteps, steps } = useTracker();
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  const last = useRef<{ value: number; at: number } | null>(null);

  useEffect(() => {
    if (!autoSteps || Platform.OS === 'web') return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const save = (date: string, value: number) => {
      const total = nextTotal(stepsRef.current[date] ?? 0, value);
      if (shouldSave(last.current, total, Date.now())) {
        last.current = { value: total, at: Date.now() };
        setSteps(date, total);
      }
    };

    const start = async () => {
      try {
        // Android in a development build: Health Connect gives the WHOLE day. In Expo Go it is not there, so this is skipped.
        if (Platform.OS === 'android') {
          const hc = loadHealthConnect();
          if (hc) {
            const first = await readTodayStepsWith(hc, new Date());
            if (first !== null && !cancelled) {
              save(toDateKey(new Date()), first);
              timer = setInterval(async () => {
                const now = new Date();
                const v = await readTodayStepsWith(hc, now);
                if (v !== null && !cancelled) save(toDateKey(now), v);
              }, 60000);
              return;
            }
          }
        }
        if (!(await Pedometer.isAvailableAsync())) return;
        let perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Pedometer.requestPermissionsAsync();
        if (!perm.granted || cancelled) return;

        if (Platform.OS === 'ios') {
          const read = async () => {
            try {
              const now = new Date();
              const r = await Pedometer.getStepCountAsync(startOfDay(now), now);
              if (!cancelled) save(toDateKey(now), r.steps);
            } catch {
              /* try again on the next tick */
            }
          };
          await read();
          timer = setInterval(read, 60000);
        } else {
          // Android: count steps while the app is open and add them to what is already logged for the day
          const day = toDateKey(new Date());
          const base = stepsRef.current[day] ?? 0;
          sub = Pedometer.watchStepCount((r) => {
            const today = toDateKey(new Date());
            if (today !== day) return; // midnight passed: counting restarts the next time the app opens
            save(today, withSession(base, r.steps));
          });
        }
      } catch {
        /* no pedometer on this phone: the typed step count still works */
      }
    };
    void start();
    return () => {
      cancelled = true;
      sub?.remove();
      if (timer) clearInterval(timer);
    };
  }, [autoSteps, setSteps]);

  return null;
}
