// Kabe's own memory of foods (pure, tested in scripts/test-foodmemory.ts). No AI is involved here.
// Every food the AI has worked out for the person (and every one the shared community cache holds) is remembered by name.
// The next time the same food is typed or spoken, Kabe builds the item itself, so the AI is asked only about foods it has never seen,
// and the same food always gets the same numbers.
import type { MealItem, Per100 } from './gemFood';
import { NUTRIENT_KEYS } from './gemFood';

export type Known = { name: string; unit: string; unitGrams: number; per100: Per100; n: number; at: number };
export type FoodMemory = Record<string, Known>;
export const MAX_KNOWN = 500;

/** A food's name reduced to what identifies it: lower case, no brackets, numbers or amount words. Descriptors such as "fried" are kept. */
export function memKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9.,/]+/g, ' ')
    .replace(/\b(g|gm|gms|grams?|ml|kg|l|litre|litres|a|an|the|of|some|one|x)\b/g, ' ')
    .replace(/[^\p{L}\p{M} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
    .trim()
    .slice(0, 60);
}

/** The separate foods in what was typed (new lines, commas, plus signs, "and"); commas inside brackets do not split. */
export function splitClauses(text: string): string[] {
  const protectedText = text.replace(/\([^)]*\)/g, (m) => m.replace(/[,;+&\n]/g, '\u0001'));
  return protectedText
    .split(/[\n,;+&]|\band\b/i)
    .map((c) => c.replace(/\u0001/g, ',').trim())
    .filter(Boolean);
}

type Amount = { kind: 'g' | 'ml' | 'count' | 'none'; value: number };
const MEASURE = /(\d+(?:\.\d+)?)\s*(kg|gms?|grams?|g|ml|litres?|l)\b/i;

/** A clause split into its amount and food name. `detail` is true when it carries a bracket or a qualifier we cannot judge. */
export function parseClause(clause: string): { name: string; amount: Amount; detail: boolean } {
  const detail = /[()]/.test(clause);
  let rest = clause.trim();
  const m = rest.match(MEASURE);
  if (m) {
    const unit = m[2].toLowerCase();
    const v = parseFloat(m[1]) * (unit === 'kg' || unit.startsWith('l') ? 1000 : 1);
    rest = rest.replace(m[0], ' ').trim();
    return { name: rest, amount: { kind: unit.startsWith('l') || unit === 'ml' ? 'ml' : 'g', value: v }, detail };
  }
  const c = rest.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)?\s+(.+)$/i);
  if (c) return { name: c[2], amount: { kind: 'count', value: parseFloat(c[1]) }, detail };
  return { name: rest, amount: { kind: 'none', value: 1 }, detail };
}

let counter = 0;
const newId = () => `k${Date.now().toString(36)}-${counter++}`;

/** The item for one clause, built from memory, or null when the food is unknown or the clause has details only the AI can judge. */
export function itemFromMemory(clause: string, mem: FoodMemory, minUses = 1): MealItem | null {
  const p = parseClause(clause);
  if (p.detail) return null;
  const k = mem[memKey(p.name)];
  if (!k || k.n < minUses || !memKey(p.name)) return null;
  const base = { id: newId(), name: k.name, note: '', per100: k.per100 };
  if (p.amount.kind === 'g' || p.amount.kind === 'ml') {
    if (!(p.amount.value > 0 && p.amount.value <= 5000)) return null;
    return { ...base, unit: p.amount.kind, unitGrams: 1, count: Math.round(p.amount.value), stated: true };
  }
  if (p.amount.kind === 'count') {
    if (!(p.amount.value > 0 && p.amount.value <= 50)) return null;
    return { ...base, unit: k.unit, unitGrams: k.unitGrams, count: p.amount.value, stated: true };
  }
  return { ...base, unit: k.unit, unitGrams: k.unitGrams, count: 1, stated: false };
}

/** Remember the foods of a saved meal. Items with a note (a detail such as "loose") are particular variants and are not learned. */
export function learnFoods(mem: FoodMemory, items: MealItem[], now: number): FoodMemory {
  const next: FoodMemory = { ...mem };
  for (const it of items) {
    const key = memKey(it.name);
    if (!key || it.note || !(it.unitGrams > 0)) continue;
    const old = next[key];
    if (!old) next[key] = { name: it.name, unit: it.unit === 'g' || it.unit === 'ml' ? 'serving' : it.unit, unitGrams: it.unit === 'g' || it.unit === 'ml' ? 100 : it.unitGrams, per100: it.per100, n: 1, at: now };
    else {
      const w = old.n / (old.n + 1); // average the numbers over every time the food was worked out
      const per100 = { ...old.per100 };
      for (const k of NUTRIENT_KEYS) per100[k] = Math.round((old.per100[k] * w + it.per100[k] * (1 - w)) * 10) / 10;
      next[key] = { ...old, per100, n: Math.min(old.n + 1, 50), at: now };
    }
  }
  const keys = Object.keys(next);
  if (keys.length > MAX_KNOWN) for (const k of keys.sort((a, b) => next[a].at - next[b].at).slice(0, keys.length - MAX_KNOWN)) delete next[k];
  return next;
}

/** Anything read back from storage or from the shared cache is checked before use. */
export function sanitizeKnown(raw: unknown): Known | null {
  const o = raw as Partial<Known> | null;
  if (!o || typeof o !== 'object' || typeof o.name !== 'string' || typeof o.unit !== 'string' || typeof o.unitGrams !== 'number' || !(o.unitGrams > 0 && o.unitGrams <= 5000)) return null;
  const p = o.per100 as Record<string, unknown> | undefined;
  if (!p || NUTRIENT_KEYS.some((k) => typeof p[k] !== 'number' || !Number.isFinite(p[k] as number) || (p[k] as number) < 0)) return null;
  const protein = p.protein as number;
  const carbs = p.carbs as number;
  const fat = p.fat as number;
  if (protein + carbs + fat > 101 || (p.kcal as number) > 910) return null;
  return { name: o.name.slice(0, 80), unit: o.unit.slice(0, 30), unitGrams: o.unitGrams, per100: p as unknown as Per100, n: typeof o.n === 'number' && o.n >= 1 ? o.n : 1, at: typeof o.at === 'number' ? o.at : 0 };
}

export function sanitizeMemory(raw: unknown): FoodMemory {
  const out: FoodMemory = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const known = sanitizeKnown(v);
    if (known && k.length >= 2) out[k] = known;
  }
  return out;
}

/** Splits what was typed into the items memory can build and the text of the foods still unknown (for the AI). */
export function resolveText(text: string, mem: FoodMemory): { known: MealItem[]; unknown: string[] } {
  const known: MealItem[] = [];
  const unknown: string[] = [];
  for (const c of splitClauses(text)) {
    const it = itemFromMemory(c, mem);
    if (it) known.push(it);
    else unknown.push(c);
  }
  return { known, unknown };
}
