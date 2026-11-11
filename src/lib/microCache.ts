// Remembers each food's vitamins and minerals on this phone so the AI is asked only once per food.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MicroRow } from './micro';

const KEY = 'kabe:micro:v1';

export async function loadMicroCache(): Promise<Record<string, MicroRow>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveMicroCache(cache: Record<string, MicroRow>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* the numbers are just looked up again next time */
  }
}

export async function clearMicroCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

// Foods the AI answered for but without usable numbers: remembered for a week so they are not asked about again on every visit.
const MISS_KEY = 'kabe:microMiss:v1';
export const MISS_DAYS = 7;

export async function loadMicroMisses(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(MISS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveMicroMisses(misses: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(MISS_KEY, JSON.stringify(misses));
  } catch {
    /* worst case the food is asked about once more */
  }
}

/** True when this food was tried recently without a usable answer. */
export const recentlyMissed = (misses: Record<string, number>, name: string, now = Date.now()): boolean =>
  typeof misses[name] === 'number' && now - misses[name] < MISS_DAYS * 86_400_000;
