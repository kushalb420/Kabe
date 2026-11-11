// Fills in free sugar and saturated fat for logged foods that do not have them yet (foods from the built-in list, custom
// foods, and anything logged before these two numbers existed). Pure and tested in scripts/test-enrich.ts.
// Gemini is asked once per food name; the per-100 g answer is remembered and scaled to each entry's grams.
import type { Food } from '../data/foods';

export type EnrichableEntry = { id: string; name: string; grams: number; date: string; sugar?: number; satFat?: number };
export type Per100Extras = { sugar: number; satFat: number };

/** One key per food, so "Roti", "roti " and "ROTI" are asked about once. */
export const nameKey = (name: string): string => name.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);

/** Entries still missing one of the two numbers, newest first, one representative per food name, at most `max`. */
export function needsFilling(entries: EnrichableEntry[], known: Record<string, Per100Extras | null>, skip: Set<string>, max = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    if (e.sugar !== undefined && e.satFat !== undefined) continue;
    if (!(e.grams > 0)) continue;
    const k = nameKey(e.name);
    if (!k || seen.has(k) || k in known || skip.has(k)) continue;
    seen.add(k);
    out.push(e.name);
    if (out.length >= max) break;
  }
  return out;
}

/** The entries with the known numbers applied. Only missing fields are filled; anything already there is never changed. */
export function applyFilling<T extends EnrichableEntry>(entries: T[], known: Record<string, Per100Extras | null>): T[] {
  let changed = false;
  const next = entries.map((e) => {
    const hit = known[nameKey(e.name)];
    if (!hit || !(e.grams > 0) || (e.sugar !== undefined && e.satFat !== undefined)) return e;
    changed = true;
    const k = e.grams / 100;
    return { ...e, sugar: e.sugar ?? Math.round(hit.sugar * k * 10) / 10, satFat: e.satFat ?? Math.round(hit.satFat * k * 10) / 10 };
  });
  return changed ? next : entries; // the same array when nothing changed, so nothing re-renders for nothing
}

/** From a looked-up food to the two numbers per 100 g. */
export const extrasOf = (f: Food | null): Per100Extras | null => (f ? { sugar: f.sugar ?? 0, satFat: f.satFat ?? 0 } : null);
