// Kabe's own small "learning" for portions (pure, tested in scripts/test-portions.ts). No AI is involved.
// When you save a meal, the amount you ended up with is remembered for that food in that bowl, plate or glass.
// The next time the same food is logged with the same utensil, Kabe starts from your usual amount instead of a guess,
// so you correct less and the AI's estimate is used less.
import type { MealItem } from './gemFood';

export type Portion = { grams: number; n: number; at: number };
export type PortionMemory = Record<string, Portion>;

export const MAX_PORTIONS = 300;

const UTENSILS: [string, RegExp][] = [
  ['katori', /\b(katori|katoris|vati|small bowl|bowl|bowls)\b/i],
  ['plate', /\b(plate|plates|thali|dinner plate)\b/i],
  ['cup', /\b(cup|cups|mug|mugs)\b/i],
  ['glass', /\b(glass|glasses|tumbler)\b/i],
  ['tablespoon', /\b(tablespoon|tablespoons|tbsp|serving spoon|ladle|ladles)\b/i],
  ['teaspoon', /\b(teaspoon|teaspoons|tsp)\b/i],
  ['spoon', /\b(spoon|spoons)\b/i],
  ['bottle', /\b(bottle|bottles)\b/i],
];

/** The utensil named in some words ("a katori of rice", "one cup"), or null. */
export function utensilOf(text: string): string | null {
  for (const [name, re] of UTENSILS) if (re.test(text)) return name;
  return null;
}

/** A food's name reduced to what identifies it: lower case, no brackets, numbers or units, simple plural removed. */
export function foodKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9.,/]+/g, ' ')
    .replace(/\b(g|gm|gms|grams?|ml|kg|cooked|boiled|fried|homemade|home made|fresh|plain|a|an|the|of|with|and)\b/g, ' ')
    .replace(/[^a-zऀ-෿ ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
    .trim();
}

/** The part of what the person wrote that talks about this food (split at commas, "and", plus signs and new lines). */
function clauseFor(name: string, hint: string): string {
  const words = foodKey(name).split(' ').filter((w) => w.length >= 3);
  if (!words.length) return '';
  for (const c of hint.split(/[,;\n+]|\band\b/i)) {
    const low = c.toLowerCase();
    if (words.some((w) => low.includes(w))) return c;
  }
  return '';
}

/** The utensil an item was served in: from the AI's own note about it, or from what the person wrote about this food. */
export function itemUtensil(item: Pick<MealItem, 'name' | 'note'>, hint: string): string | null {
  return utensilOf(item.note) ?? utensilOf(clauseFor(item.name, hint)) ?? null;
}

const slot = (food: string, utensil: string) => `${food}|${utensil}`;

/** Remember the amounts of a saved meal. Items without a clear utensil, or without grams, teach nothing. */
export function learnPortions(mem: PortionMemory, items: { item: Pick<MealItem, 'name' | 'note'>; grams: number }[], hint: string, now: number): PortionMemory {
  const next: PortionMemory = { ...mem };
  for (const { item, grams } of items) {
    const u = itemUtensil(item, hint);
    const f = foodKey(item.name);
    if (!u || !f || !(grams >= 1) || grams > 3000) continue;
    const k = slot(f, u);
    const old = next[k];
    if (!old) next[k] = { grams: Math.round(grams), n: 1, at: now };
    else {
      const a = Math.max(1 / (old.n + 1), 0.25); // recent meals count a bit more than old ones
      next[k] = { grams: Math.round(old.grams * (1 - a) + grams * a), n: Math.min(old.n + 1, 20), at: now };
    }
  }
  const keys = Object.keys(next);
  if (keys.length > MAX_PORTIONS) {
    for (const k of keys.sort((a, b) => next[a].at - next[b].at).slice(0, keys.length - MAX_PORTIONS)) delete next[k];
  }
  return next;
}

/** Items the person did not give an amount for start from their usual amount, once that food in that utensil has been logged twice. */
export function applyPortions(mem: PortionMemory, items: MealItem[], hint: string): MealItem[] {
  return items.map((it) => {
    if (it.stated) return it;
    const u = itemUtensil(it, hint);
    const f = foodKey(it.name);
    const p = u && f ? mem[slot(f, u)] : undefined;
    if (!p || p.n < 2 || it.unitGrams <= 0) return it;
    const count = Math.round((p.grams / it.unitGrams) * 100) / 100;
    if (!(count >= 0.25 && count <= (it.unit === 'g' || it.unit === 'ml' ? 5000 : 50))) return it; // grams and ml counts can be large
    const note = [it.note, `your usual: about ${p.grams} g`].filter(Boolean).join('; ').slice(0, 160);
    return { ...it, count, note };
  });
}

/** Anything read back from storage is checked before use. */
export function sanitizePortions(raw: unknown): PortionMemory {
  const out: PortionMemory = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, Portion>)) {
    if (v && typeof v.grams === 'number' && v.grams > 0 && typeof v.n === 'number' && v.n >= 1 && typeof v.at === 'number' && k.includes('|')) out[k] = { grams: v.grams, n: v.n, at: v.at };
  }
  return out;
}
