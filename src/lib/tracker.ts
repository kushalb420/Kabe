export type WeightEntry = { date: string; kg: number };
export type Measurement = { date: string; waist?: number; neck?: number; chest?: number; hips?: number; arm?: number; thigh?: number };
export type DayLog = Record<string, string[]>; // date -> ids done

export const MEASURE_KEYS = ['waist', 'neck', 'chest', 'hips', 'arm', 'thigh'] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (key: string, days: number) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return keyOf(d);
};

/** Whole days since 1970-01-01 (local date) — handy as a chart x value. */
export const dayIndex = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const daysBetween = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);

/** One weight per day; re-logging a day replaces it. Result is sorted oldest → newest. */
export const upsertWeight = (list: WeightEntry[], date: string, kg: number): WeightEntry[] =>
  [...list.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date));

export const upsertMeasurement = (list: Measurement[], m: Measurement): Measurement[] =>
  [...list.filter((x) => x.date !== m.date), m].sort((a, b) => a.date.localeCompare(b.date));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Trailing average of entries from the 7 days up to and including each entry's date. Smooths daily water/food noise. */
export const trendSeries = (list: WeightEntry[]) =>
  list.map((w) => {
    const near = list.filter((x) => daysBetween(x.date, w.date) >= 0 && daysBetween(x.date, w.date) < 7);
    return { date: w.date, kg: w.kg, avg: mean(near.map((x) => x.kg)) };
  });

/**
 * kg change per week: average of the last 7 days vs the average of the 7 days before that.
 * Returns null unless both windows have at least one entry — never extrapolates from nothing.
 */
export const weeklyChange = (list: WeightEntry[], today: string): number | null => {
  const inRange = (from: number, to: number) =>
    list.filter((w) => {
      const ago = daysBetween(w.date, today);
      return ago >= from && ago <= to;
    });
  const recent = inRange(0, 6);
  const prior = inRange(7, 13);
  if (!recent.length || !prior.length) return null;
  return mean(recent.map((w) => w.kg)) - mean(prior.map((w) => w.kg));
};

/** Consecutive days an id was done, ending today (or yesterday if today isn't done yet). */
export const streak = (log: DayLog, id: string, today: string): number => {
  let day = log[today]?.includes(id) ? today : addDays(today, -1);
  let n = 0;
  while (log[day]?.includes(id)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
};

/** Rule of thumb ~35 ml per kg body weight, rounded to 250 ml. A starting point, user-editable. */
export const defaultWaterGoal = (kg: number) => Math.max(1500, Math.round((kg * 35) / 250) * 250);

export const toggleId = (log: DayLog, date: string, id: string): DayLog => {
  const cur = log[date] ?? [];
  return { ...log, [date]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
};

/** Approximate caffeine per typical serving (mg). Real values vary a lot by brand and brew strength. */
export const CAFFEINE_PRESETS = [
  { name: 'Coffee (cup)', mg: 95 },
  { name: 'Espresso shot', mg: 63 },
  { name: 'Tea (cup)', mg: 47 },
  { name: 'Cola (can)', mg: 34 },
  { name: 'Energy drink (can)', mg: 80 },
];
export const CAFFEINE_LIMIT_MG = 400; // commonly cited upper guidance for healthy adults
