import { BOX } from './config/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccentId, Colors, isAccentId, lightColors, paletteFor } from './palette';

export { ACCENT_IDS, ACCENT_UNLOCK_LEVEL, lightColors, isAccentId, isAccentUnlocked, paletteFor } from './palette';
export type { AccentId, Colors } from './palette';

/**
 * Screens never use a colour value directly: they ask for `useColors()` / `useThemedStyles()`, so switching between
 * light and dark restyles the whole app at once.
 */
export const radius = { sm: BOX.radiusInput, md: BOX.radiusButton, lg: BOX.radiusCard, pill: 999 }; // all from src/config/app.ts
/** Neo-brutalist rules: every box has a 2px border, and its shadow is a solid copy moved 4px down and right. */
export const BORDER = BOX.border;
export const SHADOW_OFFSET = BOX.shadowOffset;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

const ACCENT_KEY = 'kabe:accent:v1'; // device-only, never synced

type Ctx = { accent: AccentId; colors: Colors; setAccent: (a: AccentId) => void };
const ThemeContext = createContext<Ctx>({ accent: 'forest', colors: lightColors, setAccent: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>('forest');

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_KEY)
      .then((raw) => isAccentId(raw) && setAccentState(raw))
      .catch(() => {});
  }, []);

  const setAccent = useCallback((a: AccentId) => {
    setAccentState(a);
    AsyncStorage.setItem(ACCENT_KEY, a).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({ accent, colors: paletteFor(accent), setAccent }), [accent, setAccent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = (): Colors => useContext(ThemeContext).colors;

/** Styles that depend on the palette: `const makeStyles = (colors: Colors) => StyleSheet.create({...})`, then `const styles = useThemedStyles(makeStyles)`. */
export function useThemedStyles<T>(make: (c: Colors) => T): T {
  const colors = useColors();
  return useMemo(() => make(colors), [make, colors]);
}
