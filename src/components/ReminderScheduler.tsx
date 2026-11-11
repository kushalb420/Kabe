import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { nowMs } from '../lib/clock';
import { upcomingItems } from '../lib/itemReminders';
import { cleanSchedule, dosesDue, dosesTaken, isDue } from '../lib/supplements';
import { capSchedule, liveSnoozes, upcomingCustom, withFollowUps } from '../lib/notify';
import { toDateKey } from '../lib/nutrition';
import { upcoming } from '../lib/reminders';
import { useKabe } from '../store/kabe';
import { useTracker } from '../store/tracker';
import { ensurePermission } from '../lib/permissions';
import { REMINDER_CHANNEL, ensureReminderChannel } from '../lib/reminderChannel';

// notifications appear even while Kabe is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

type Planned = { key: string; at: Date; title: string; body: string; task?: { kind: string; id: string; date: string } };

/**
 * Keeps the phone's scheduled notifications in step with everything you have set: the daily nudges, a time for each habit
 * and supplement, your own reminders, follow-ups until a task is done, and snoozes. Anything already done today is left
 * out. The next 7 days are scheduled as one-off times and rebuilt whenever Kabe opens or you log something. Task
 * notifications carry Done and Snooze buttons (handled in NotificationActions). Renders nothing; nothing goes to a server.
 */
export function ReminderScheduler() {
  const { reminders, checkins, weights, water, waterGoal, habits, habitLog, supplements, supplementLog, notif, customReminders, customDone, snoozes } = useTracker();
  const { entries } = useKabe();
  const { t, lang } = useT();
  const now = new Date(nowMs());
  const today = toDateKey(now);
  const done = {
    logFood: entries.some((e) => e.date === today && e.kcal > 0),
    checkin: !!checkins[today],
    weigh: weights.some((w) => w.date === today),
    water: (water[today] ?? 0) >= waterGoal,
  };

  // a supplement counts as done for today once every dose due today is taken
  const suppDone = supplements.filter((x) => dosesTaken(supplementLog[today], x.id) >= Math.max(1, dosesDue(cleanSchedule(x.schedule, today), today))).map((x) => x.id);

  const planned: Planned[] = [];
  if (notif.allOn) {
    for (const u of upcoming(reminders, now, done)) planned.push({ key: u.key, at: u.at, title: t(`rem.${u.id}.title` as Key), body: t(`rem.${u.id}.body` as Key) });
    const base = [
      ...upcomingItems(habits, 'habit', now, habitLog[today] ?? []),
      ...upcomingItems(supplements, 'supplement', now, suppDone, 7, (it, day) => {
        const sc = cleanSchedule(it.schedule, today);
        return sc.mode === 'asNeeded' || isDue(sc, toDateKey(day));
      }),
      ...upcomingCustom(customReminders, now, customDone[today] ?? []),
    ];
    const tasks = withFollowUps(base, notif, now, { habit: habitLog[today] ?? [], supplement: suppDone, custom: customDone[today] ?? [] });
    for (const u of tasks) {
      planned.push({
        key: u.key,
        at: u.at,
        title: u.name,
        body: u.followUp > 0 ? t('notif.stillWaiting') : t(u.kind === 'habit' ? 'rem.habit.body' : u.kind === 'supplement' ? 'rem.supp.body' : 'notif.custom.body'),
        task: { kind: u.kind, id: u.id, date: toDateKey(u.at) },
      });
    }
    for (const s of liveSnoozes(snoozes, now)) planned.push({ key: s.key, at: new Date(s.at), title: s.title, body: s.body, task: s.data });
  }
  const list = capSchedule(planned, 60);
  const signature = JSON.stringify([notif.snoozeMin, ...list.map((u) => [u.key, u.at.getTime(), u.title])]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (!list.length || cancelled) return;
        // a reminder was just set: this is where the phone's "allow notifications" question appears the first time
        if ((await ensurePermission(Notifications.getPermissionsAsync, Notifications.requestPermissionsAsync)) !== 'granted') return;
        await ensureReminderChannel();
        // the Done / Snooze buttons on task notifications
        await Notifications.setNotificationCategoryAsync('task', [
          { identifier: 'done', buttonTitle: t('notif.done'), options: { opensAppToForeground: false } },
          { identifier: 'snooze', buttonTitle: t('notif.snooze', { min: notif.snoozeMin }), options: { opensAppToForeground: false } },
        ]);
        for (const u of list) {
          if (cancelled) return;
          await Notifications.scheduleNotificationAsync({
            content: { title: u.title, body: u.body, priority: Notifications.AndroidNotificationPriority.HIGH, ...(u.task ? { categoryIdentifier: 'task', data: u.task } : {}) },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: u.at, channelId: REMINDER_CHANNEL },
          });
        }
      } catch {
        /* reminders are a nicety: if the phone refuses, the app carries on */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, lang]);

  return null;
}
