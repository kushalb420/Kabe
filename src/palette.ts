// The colour palette. Pure (no React Native), so it can be tested on its own (scripts/test-theme.ts checks contrast).
// Nothing is hard-coded here: the colours come from src/config/app.ts (BRAND and THEMES). Change them there.
import { BRAND, THEMES } from './config/app';

export const baseColors = {
  bg: BRAND.yellow, // the page
  card: BRAND.white,
  cardBorder: BRAND.black,
  ink: BRAND.black,
  inkSoft: '#3A3F3C',
  line: BRAND.black, // borders of inputs, chips and dividers
  primary: BRAND.black, // button fills, links and icons
  onPrimary: BRAND.white, // text and icons on a primary fill
  primaryDark: BRAND.black, // strong headings and numbers
  primarySoft: BRAND.sage, // secondary surfaces (secondary buttons, selected tints)
  strong: BRAND.charcoal, // a deep fill that always takes white text (the rest-timer bar)
  shadowInk: BRAND.black, // the hard offset shadow
  accent: BRAND.accent, // orange fills, icons and chart marks (free sugar)
  warn: '#6E3200', // orange TEXT
  danger: '#8E1A12',
  good: '#14532D',
  info: '#174B78',
  protein: '#4F7CFF',
  carbs: '#F5A623',
  fat: '#E86A92',
  satFat: '#8E1F4B', // the saturated part of fat
  fiber: '#7AB648',
};

export type Colors = typeof baseColors;
/** Kept so older imports keep working: the one palette is the light one. */
export const lightColors: Colors = baseColors;

// ---------------------------------------------------------------- colour themes (page tints, from THEMES in the config)
export const ACCENT_IDS = THEMES.map((t) => t.id) as unknown as readonly ['forest', 'ocean', 'sunset', 'berry'];
export type AccentId = (typeof THEMES)[number]['id'];
export const isAccentId = (v: unknown): v is AccentId => typeof v === 'string' && THEMES.some((t) => t.id === v);

/** Themes unlock as the person levels up (the first is there from the start). */
export const ACCENT_UNLOCK_LEVEL = Object.fromEntries(THEMES.map((t) => [t.id, t.level])) as Record<AccentId, number>;
export const isAccentUnlocked = (id: AccentId, level: number): boolean => level >= ACCENT_UNLOCK_LEVEL[id];

const cache = new Map<string, Colors>();
export const paletteFor = (accent: AccentId = 'forest'): Colors => {
  const theme = THEMES.find((t) => t.id === accent) ?? THEMES[0];
  if (theme.bg === baseColors.bg && theme.soft === baseColors.primarySoft) return baseColors;
  let p = cache.get(theme.id);
  if (!p) {
    p = { ...baseColors, bg: theme.bg, primarySoft: theme.soft };
    cache.set(theme.id, p);
  }
  return p;
};
