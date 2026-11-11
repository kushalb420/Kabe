import { CAFFEINE_LIMIT_MG } from './tracker';

/** Typical caffeine per 100 g or ml of a drink or food, matched on words in its name (averages; real products vary). */
const TABLE: { words: RegExp; mgPer100: number }[] = [
  { words: /\b(espresso|ristretto)\b/i, mgPer100: 210 },
  { words: /\b(energy drink|red bull|monster)\b/i, mgPer100: 32 },
  { words: /\b(cold brew)\b/i, mgPer100: 30 },
  { words: /\b(coffee|cappuccino|latte|americano|mocha|macchiato|filter coffee|kaapi)\b/i, mgPer100: 40 },
  { words: /\b(green tea|black tea|iced tea|tea|chai|chaya)\b/i, mgPer100: 20 },
  { words: /\b(cola|coke|pepsi)\b/i, mgPer100: 10 },
  { words: /\b(dark chocolate)\b/i, mgPer100: 43 },
];

/** Estimated caffeine (mg) in an amount of food, from its name. 0 when it is not a caffeine source. */
export function caffeineMg(name: string, grams: number): number {
  const hit = TABLE.find((r) => r.words.test(name));
  return hit ? Math.round((hit.mgPer100 * Math.max(0, grams)) / 100) : 0;
}

/** Caffeine (mg) in everything logged on one day. */
export const caffeineOnDay = (entries: { date: string; name: string; grams: number }[], date: string): number =>
  entries.filter((e) => e.date === date).reduce((a, e) => a + caffeineMg(e.name, e.grams), 0);

export { CAFFEINE_LIMIT_MG };
