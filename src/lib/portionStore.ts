// Saving Kabe's learned portions on the phone (the logic is in portionMemory.ts). Failures are ignored: learning is a nicety.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PortionMemory, sanitizePortions } from './portionMemory';

const KEY = 'kabe.portions.v1';

export async function loadPortions(): Promise<PortionMemory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? sanitizePortions(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function savePortions(mem: PortionMemory): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* nothing to do */
  }
}
