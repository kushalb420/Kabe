// Saving Kabe's food memory on the phone (the logic is in foodMemory.ts). Failures are ignored: remembering is a nicety.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FoodMemory, sanitizeMemory } from './foodMemory';

const KEY = 'kabe.foods.v1';

export async function loadFoodMemory(): Promise<FoodMemory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? sanitizeMemory(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function saveFoodMemory(mem: FoodMemory): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* nothing to do */
  }
}
