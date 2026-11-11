// The Android notification channel every Kabe reminder uses. Channels cannot be changed once the phone has created them, so
// the lock-screen setting needed a new channel id; the old one ("reminders") is removed.
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_CHANNEL = 'kabe-reminders';

/** Reminders show on the lock screen (full text), pop up on screen, vibrate and play the default sound. Does nothing off Android. */
export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: false,
    sound: 'default',
  });
  await Notifications.deleteNotificationChannelAsync('reminders').catch(() => {});
}
