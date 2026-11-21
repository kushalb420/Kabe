// Which picture sits at the top of Today: the glass orb (default) or the old TV. A device-only choice, kept in Settings.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type HeroStyle = 'orb' | 'tv';
const KEY = 'kabe:hero:v1';
let current: HeroStyle = 'orb';
let loaded = false;
const listeners = new Set<(s: HeroStyle) => void>();

export const isHeroStyle = (v: unknown): v is HeroStyle => v === 'orb' || v === 'tv';

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (isHeroStyle(raw) && raw !== current) {
      current = raw;
      listeners.forEach((l) => l(current));
    }
  } catch {
    /* storage blocked: the default stays */
  }
}

export function setHeroStyle(s: HeroStyle) {
  current = s;
  listeners.forEach((l) => l(s));
  AsyncStorage.setItem(KEY, s).catch(() => {});
}

export function useHeroStyle(): [HeroStyle, (s: HeroStyle) => void] {
  const [s, setS] = useState<HeroStyle>(current);
  useEffect(() => {
    listeners.add(setS);
    void load();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return [s, setHeroStyle];
}
