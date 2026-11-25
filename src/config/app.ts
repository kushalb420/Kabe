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
  { id: 'noir', level: 1, bg: '#0D0F0E', soft: '#2A332F', dark: true }, // the dark theme: black page, off-white cards, greenish-grey, burnt orange
  { id: 'noirwine', level: 1, bg: '#0D0F0E', soft: '#2A332F', dark: true }, // the same dark theme with red wine in place of every orange
  // (the dark themes are the ones with dark: true)
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
  photoThinking: 'minimal', // how much the model "thinks" about a photo: less is faster
  photoModels: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'], // plate photos need the strongest eyes, so the full model goes first and the lighter ones are the fallback
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
  idle: false, // the "time to move" reminder: hidden until it is reliable
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
