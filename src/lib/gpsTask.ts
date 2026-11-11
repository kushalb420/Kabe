// Background GPS (needs a development build; in Expo Go every call here fails quietly and the screen
// falls back to foreground tracking). The task only appends fixes to storage; see gpsSession.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { TrackKind } from './gps';
import { Session, appendFixes, sanitizeSession } from './gpsSession';

export const TASK = 'kabe-gps';
const KEY = 'kabe.gpsSession.v1';

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? sanitizeSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

try {
  TaskManager.defineTask(TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const s = await loadSession();
    if (!s || !locations.length) return;
    const next = appendFixes(
      s,
      locations.map((l) => ({ lat: l.coords.latitude, lon: l.coords.longitude, t: l.timestamp, acc: l.coords.accuracy })),
    );
    if (next !== s) await AsyncStorage.setItem(KEY, JSON.stringify(next));
  });
} catch {
  /* task manager not available here */
}

/** Starts background tracking. Returns false (and leaves nothing running) when the phone or build cannot do it. */
export async function startBackground(kind: TrackKind, startedAt: number, notificationTitle: string, notificationBody: string): Promise<boolean> {
  try {
    if (!(await TaskManager.isAvailableAsync())) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    await AsyncStorage.setItem(KEY, JSON.stringify({ kind, startedAt, fixes: [] } satisfies Session));
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 3,
      timeInterval: 2000,
      pausesUpdatesAutomatically: false,
      foregroundService: { notificationTitle, notificationBody },
    });
    return true;
  } catch {
    await clearSession();
    return false;
  }
}

export async function stopBackground(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    /* already stopped */
  }
}

export async function isBackgroundRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK);
  } catch {
    return false;
  }
}
