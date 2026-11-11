/**
 * A group of strings for one screen, with all four languages side by side.
 * The generic makes TypeScript reject the file if any language is missing a key
 * (or has an extra one), exactly like the main dictionaries do.
 */
export type Part<K extends string> = { en: Record<K, string>; hi: Record<K, string>; te: Record<K, string>; ta: Record<K, string> };
export const part = <K extends string>(p: Part<K>): Part<K> => p;
