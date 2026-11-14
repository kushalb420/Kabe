import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { loadHealthConnect, readStepSpans } from '../lib/healthConnect';
import { idleTimes, lastMovement } from '../lib/idleSchedule';
import { IDLE_TEXT } from '../lib/idleText';
import { useKabe } from '../store/kabe';
import { useTracker } from '../store/tracker';
import { ensurePermission } from '../lib/permissions';
import { REMINDER_CHANNEL, ensureReminderChannel } from '../lib/reminderChannel';

const IDS = ['kabe-idle-0', 'kabe-idle-1', 'kabe-idle-2'];

/**
 * The "you have been still" reminder. There is no background service: whenever Kabe is opened or put away it asks Health Connect
 * whether you moved during the chosen time, and (if not) schedules up to three reminders, one per chosen interval, inside your
 * waking hours. Seeing movement pushes them later; switching the setting off removes them. Renders nothing.
 */
export function IdleWatcher() {
  const { notif, ready } = useTracker();
  const { language } = useKabe();
  const on = notif.allOn && notif.idle.on;
  const { afterMin, from, to, minSteps } = notif.idle;
  const lastActive = useRef(0); // ms; set when the app starts, moved forward whenever movement is seen
  const replan = useRef<() => void>(() => {}); // lets the live step counter ask for a fresh plan while walking

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    let dead = false;
    if (!lastActive.current) lastActive.current = Date.now();

    const clear = async () => {
      for (const id of IDS) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    };

    const plan = async () => {
      try {
        await clear();
        if (!on || dead) return;
        if ((await ensurePermission(Notifications.getPermissionsAsync, Notifications.requestPermissionsAsync)) !== 'granted') return;
        await ensureReminderChannel();
        const now = Date.now();
        // the clock starts from the last time the person was really walking (Health Connect keeps the history, even while
        // Kabe was closed), not from when the app happened to open
        const hc = loadHealthConnect();
        if (hc) {
          const spans = await readStepSpans(hc, new Date(now - 6 * 3_600_000), new Date(now));
          const moved = spans ? lastMovement(spans, { windowMin: 5, minSteps: Math.min(minSteps, 40) }) : null;
          if (moved !== null) lastActive.current = Math.max(lastActive.current, moved);
        }
        const times = idleTimes({ now, lastActiveAt: lastActive.current, afterMin, from, to, max: IDS.length });
        const text = IDLE_TEXT[language] ?? IDLE_TEXT.en;
        for (let i = 0; i < times.length && !dead; i++) {
          await Notifications.scheduleNotificationAsync({
            identifier: IDS[i],
            content: { title: text.title, body: text.body, priority: Notifications.AndroidNotificationPriority.HIGH },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: times[i], channelId: REMINDER_CHANNEL },
          });
        }
      } catch {
        /* reminders are a nicety: if the phone refuses, the app carries on */
      }
    };

    replan.current = () => void plan();
    void plan();
    const sub = AppState.addEventListener('change', () => void plan()); // opened or put away: look again

    // while Kabe is open, the phone's step counter sees you walking live: every burst of steps pushes the reminders later
    let walk: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        if (!on || !(await Pedometer.isAvailableAsync())) return;
        const perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted || dead) return;
        walk = Pedometer.watchStepCount(() => {
          lastActive.current = Date.now();
          if (!timer) timer = setTimeout(() => { timer = null; replan.current(); }, 90_000); // look again at most every 90 seconds
        });
      } catch {
        /* no step counter here: Health Connect alone does the job */
      }
    })();
    return () => {
      dead = true;
      sub.remove();
      walk?.remove();
      if (timer) clearTimeout(timer);
    };
  }, [on, ready, afterMin, from, to, minSteps, language]);

  return null;
}
