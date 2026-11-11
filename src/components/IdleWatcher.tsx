import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { loadHealthConnect, readStepsBetween } from '../lib/healthConnect';
import { idleTimes, movedEnough } from '../lib/idleSchedule';
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
        // did the person move during the chosen time? then the clock starts again from now
        const hc = loadHealthConnect();
        if (hc) {
          const steps = await readStepsBetween(hc, new Date(now - afterMin * 60_000), new Date(now));
          if (movedEnough(steps, minSteps)) lastActive.current = now;
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

    void plan();
    const sub = AppState.addEventListener('change', () => void plan()); // opened or put away: look again
    return () => {
      dead = true;
      sub.remove();
    };
  }, [on, ready, afterMin, from, to, minSteps, language]);

  return null;
}
