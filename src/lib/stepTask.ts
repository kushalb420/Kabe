// Reading steps while Kabe is closed (Android). Health Connect keeps the day's steps; a background job wakes up every so often,
// reads today's total and writes it into Kabe's saved data, so the number is already right when the app is opened.
// This needs a build that includes expo-background-task. In a build without it, nothing here runs and steps are read the moment
// Kabe opens instead (see components/StepCounter.tsx). Nothing here can fail loudly: every step is guarded.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { loadHealthConnect, readStepsBetween } from './healthConnect';
import { toDateKey } from './nutrition';
import { mergeSteps, startOfDay } from './steps';

export const STEP_TASK = 'kabe-steps';
const TRACKER_KEY = 'kabe:tracker:v1';

async function readIntoStorage(): Promise<void> {
  const hc = loadHealthConnect();
  if (!hc) return;
  const now = new Date();
  const steps = await readStepsBetween(hc, startOfDay(now), now); // never opens a permission dialog
  if (steps === null) return;
  const merged = mergeSteps(await AsyncStorage.getItem(TRACKER_KEY), toDateKey(now), steps);
  if (merged) await AsyncStorage.setItem(TRACKER_KEY, merged);
}

if (Platform.OS === 'android') {
  try {
    TaskManager.defineTask(STEP_TASK, async () => {
      try {
        await readIntoStorage();
      } catch {
        /* the next run tries again */
      }
    });
  } catch {
    /* task manager is not available here */
  }
}

/** Schedules the background job when this build has it (about every 15 minutes, as often as the phone allows). */
export async function registerStepTask(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android' || !requireOptionalNativeModule('ExpoBackgroundTask')) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundTask = require('expo-background-task') as { registerTaskAsync: (n: string, o?: { minimumInterval?: number }) => Promise<void> };
    await BackgroundTask.registerTaskAsync(STEP_TASK, { minimumInterval: 15 });
    return true;
  } catch {
    return false;
  }
}
