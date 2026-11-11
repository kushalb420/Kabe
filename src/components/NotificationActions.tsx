import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { snoozeAt } from '../lib/notify';
import { useTracker } from '../store/tracker';

type TaskData = { kind?: string; id?: string; date?: string };

/**
 * Handles the Done and Snooze buttons on task notifications (habits, supplements, your own reminders).
 * Done marks the task finished for that day, which also stops its follow-ups. Snooze brings the same notification back
 * after the snooze time (the scheduler puts it back whenever it rebuilds). If the phone had closed Kabe completely, the
 * tap is applied the next time Kabe opens. Renders nothing.
 */
export function NotificationActions() {
  const { markDone, addSnooze, notif } = useTracker();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (r: Notifications.NotificationResponse) => {
      const mark = `${r.notification.request.identifier}:${r.actionIdentifier}`;
      if (seen.current.has(mark)) return;
      seen.current.add(mark);
      const data = (r.notification.request.content.data ?? {}) as TaskData;
      const kind = data.kind === 'habit' || data.kind === 'supplement' || data.kind === 'custom' ? data.kind : null;
      if (!kind || !data.id || !data.date) return;
      if (r.actionIdentifier === 'done') {
        markDone(kind, data.id, data.date);
      } else if (r.actionIdentifier === 'snooze') {
        addSnooze({
          key: `snooze-${kind}-${data.id}`,
          at: snoozeAt(new Date(), notif).getTime(),
          title: r.notification.request.content.title ?? '',
          body: r.notification.request.content.body ?? '',
          data: { kind, id: data.id, date: data.date },
        });
      }
      Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && handle(r))
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [markDone, addSnooze, notif]);

  return null;
}
