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
  dot: '#000000', // the dot grid on the page
  water: '#C6E6F8', // the glass on the Today TV
  waterOver: '#F5B5C0', // the glass once a keep-under number is passed
  tagGoodBg: '#DDF3E6', // little tags (kitchen: you have it)
  tagGoodLine: '#1B6B3A',
  tagWarnBg: '#FFE9D6', // (kitchen: you need it)
  tagWarnLine: '#B34A00',
};

export type Colors = typeof baseColors;
/** Kept so older imports keep working: the one palette is the light one. */
export const lightColors: Colors = baseColors;

// ---------------------------------------------------------------- colour themes (page tints, from THEMES in the config)
export type AccentId = (typeof THEMES)[number]['id'];
export const ACCENT_IDS = THEMES.map((t) => t.id) as readonly AccentId[];
export const isAccentId = (v: unknown): v is AccentId => typeof v === 'string' && THEMES.some((t) => t.id === v);

/** Themes unlock as the person levels up (the first is there from the start). */
export const ACCENT_UNLOCK_LEVEL = Object.fromEntries(THEMES.map((t) => [t.id, t.level])) as Record<AccentId, number>;
export const isAccentUnlocked = (id: AccentId, level: number): boolean => level >= ACCENT_UNLOCK_LEVEL[id];

/** The dark theme: black page, white ink, the greenish-grey of the light theme for surfaces, and a burnt orange for accents and the hard shadows. */
export const darkColors: Colors = {
  ...baseColors,
  bg: '#0D0F0E',
  card: '#171C19',
  cardBorder: '#E9EEEA',
  ink: '#F3F5F1',
  inkSoft: '#A8B3AD',
  line: '#E9EEEA',
  primary: '#F3F5F1',
  onPrimary: '#0D0F0E',
  primaryDark: '#FFFFFF',
  primarySoft: '#2A332F',
  strong: '#000000',
  shadowInk: '#B5481A',
  accent: '#F0661F',
  warn: '#FFB383',
  danger: '#FF8279',
  good: '#7ED99B',
  info: '#7FB9F2',
  protein: '#6C95FF',
  carbs: '#F5A623',
  fat: '#F27AA2',
  satFat: '#B83A66',
  fiber: '#8CC85A',
  dot: '#FFFFFF',
  water: '#1F5666',
  waterOver: '#7A2338',
  tagGoodBg: '#15301F',
  tagGoodLine: '#7ED99B',
  tagWarnBg: '#3A2112',
  tagWarnLine: '#FFB383',
};

/** True for a dark palette (its page is dark): used for the status bar and the logo colour. */
export const isDarkColors = (c: Pick<Colors, 'bg'>): boolean => {
  const n = parseInt(c.bg.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
};

const cache = new Map<string, Colors>();
export const paletteFor = (accent: AccentId = 'forest'): Colors => {
  const theme = THEMES.find((t) => t.id === accent) ?? THEMES[0];
  if ('dark' in theme && theme.dark) return darkColors;
  if (theme.bg === baseColors.bg && theme.soft === baseColors.primarySoft) return baseColors;
  let p = cache.get(theme.id);
  if (!p) {
    p = { ...baseColors, bg: theme.bg, primarySoft: theme.soft };
    cache.set(theme.id, p);
  }
  return p;
};
