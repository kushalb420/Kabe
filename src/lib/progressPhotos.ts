// Progress photos: the list logic (pure, tested in scripts/test-progressphotos.ts). The image files stay on the phone only.

export type ProgressPhoto = { id: string; date: string; uri: string };

/** Newest first. */
export const newestFirst = (list: ProgressPhoto[]): ProgressPhoto[] => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export type Pair = { before: ProgressPhoto; after: ProgressPhoto; days: number };

/** The earliest and the latest photo, for a before/after view. Needs two photos taken on different days. */
export function comparePair(list: ProgressPhoto[]): Pair | null {
  if (list.length < 2) return null;
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const before = sorted[0];
  const after = sorted[sorted.length - 1];
  const days = Math.round((parse(after.date) - parse(before.date)) / 86400000);
  return days > 0 ? { before, after, days } : null;
}

/** The weigh-in closest to a date, within `maxDays`; null when there is none that close. */
export function nearestWeight(weights: { date: string; kg: number }[], date: string, maxDays = 7): number | null {
  let best: { kg: number; gap: number } | null = null;
  for (const w of weights) {
    const gap = Math.abs(parse(w.date) - parse(date)) / 86400000;
    if (gap <= maxDays && (!best || gap < best.gap)) best = { kg: w.kg, gap };
  }
  return best ? best.kg : null;
}

/** File name for a saved copy; only letters, digits and dashes, so it is safe on every phone. */
export const photoFileName = (id: string): string => `progress-${id.replace(/[^A-Za-z0-9-]/g, '')}.jpg`;
