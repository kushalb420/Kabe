// THE place to change how Kabe looks and behaves. Nothing below is wired into a screen by hand: screens read these values,
// so editing a number here changes the whole app. (See docs/CUSTOMIZE.md.)

/** Brand colours. The palette (src/palette.ts) is built from these. */
export const BRAND = {
  name: 'Kabe',
  yellow: '#FFE17C', // pages
  charcoal: '#171E19', // dark fills (rest timer, splash)
  sage: '#B7C6C2', // secondary surfaces
  black: '#000000', // text, borders, buttons
  white: '#FFFFFF', // cards
  accent: '#FF8A3D', // orange marks (sugar)
};

/** Page tints the person can unlock (Settings → Colour theme). `level` = the level that unlocks it. */
export const THEMES = [
  { id: 'forest', level: 1, bg: BRAND.yellow, soft: BRAND.sage },
  { id: 'ocean', level: 3, bg: BRAND.sage, soft: BRAND.yellow },
  { id: 'sunset', level: 5, bg: '#FFB98F', soft: BRAND.yellow },
  { id: 'berry', level: 7, bg: '#F6B8D4', soft: BRAND.yellow },
  { id: 'mint', level: 1, bg: '#BFF0D4', soft: '#FFF0B0' },
  { id: 'lavender', level: 1, bg: '#DCD0FF', soft: '#FFF0B0' },
  { id: 'sky', level: 1, bg: '#BFE3FF', soft: '#FFF0B0' },
  { id: 'paper', level: 1, bg: '#F3F1EA', soft: '#DDE8D6' },
  { id: 'sand', level: 2, bg: '#EBDDBE', soft: '#C9E4D4' },
  { id: 'coral', level: 2, bg: '#FFA9A0', soft: '#FFF0B0' },
] as const;

/** The dot pattern behind pages. */
export const DOTS = { enabled: true, size: 32, radius: 2, opacity: 0.1, color: '#000000' };

/** Box style: every card and button. */
export const BOX = { border: 2, shadowOffset: 4, radiusCard: 16, radiusButton: 12, radiusInput: 8 };

/** Daily limits behind the bars on Today. Percent of the calorie goal. */
export const NUTRITION = {
  freeSugarMaxPctKcal: 10, // keep added (free) sugar under 10% of energy, the usual WHO advice
  satFatMaxPctKcal: 10, // keep saturated fat under 10% of energy
  kcalPerGramSugar: 4,
  kcalPerGramFat: 9,
};

/** Animation. All durations in milliseconds; set `enabled` to false to switch every animation off. */
export const MOTION = {
  enabled: true,
  enterMs: 320, // a card sliding in
  staggerMs: 70, // delay between neighbouring cards
  enterRise: 14, // how far (px) a card travels while sliding in
  ringMs: 800, // the calorie ring filling
  barMs: 650, // nutrient bars filling
  countMs: 800, // numbers counting up
  tabBounceMs: 260,
};

/** Meal logging and AI. */
export const AI = {
  models: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'], // tried in this order (the next one is used when a model is missing or overloaded)
  retryOn503: true,
  retryDelayMs: 1500,
  maxMealItems: 20,
  maxMealChars: 1500,
  maxAudioBytes: 4_000_000,
  dailyRequestsPerPerson: 150, // enforced by the server function (supabase/functions/ai); keep in step
};

/** Switch whole features on or off. A switched-off feature disappears from every screen. */
export const FEATURES = {
  friends: true,
  kitchen: true,
  restaurant: true,
  nextMeal: true,
  coachChat: true,
  voice: true,
  reminders: true,
  progressPhotos: true,
  vitamins: true,
  cloudBackup: true,
};

/** Tabs, in order. `show: false` hides one. */
export type TabName = 'index' | 'diary' | 'workouts' | 'progress' | 'profile';
export const TABS: { name: TabName; show: boolean }[] = [
  { name: 'index', show: true },
  { name: 'diary', show: true },
  { name: 'workouts', show: true },
  { name: 'progress', show: true },
  { name: 'profile', show: true },
];
