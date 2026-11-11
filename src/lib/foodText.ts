// Shared word handling for matching food names (used by the bundled search and photo matching).
import { nativeToEnglish } from '../data/nativeFoods';

const STOP = new Set(['cooked', 'with', 'the', 'and', 'a', 'of', 'in', 'nfs', 'raw']);

export const tokens = (s: string) =>
  nativeToEnglish(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));

/** Common Indian / everyday names → words used in the USDA data. Only used to widen a match, never to invent one. */
export const ALIASES: Record<string, string[]> = {
  dal: ['lentils', 'lentil'],
  daal: ['lentils', 'lentil'],
  dhal: ['lentils', 'lentil'],
  rajma: ['kidney'],
  chole: ['chickpeas'],
  chana: ['chickpeas'],
  curd: ['yogurt'],
  dahi: ['yogurt'],
  bhindi: ['okra'],
  aloo: ['potato', 'potatoes'],
  gobi: ['cauliflower'],
  palak: ['spinach'],
  methi: ['fenugreek'],
  atta: ['flour'],
  roti: ['chapati', 'roti'],
  chapati: ['roti'],
  egg: ['eggs'],
  eggs: ['egg'],
};

/** Does one query word appear in a name's words (whole word, prefix, or alias)? */
export const wordMatches = (q: string, nameTokens: string[], allowPrefix = false) =>
  nameTokens.some((t) => t === q || (allowPrefix && q.length >= 3 && t.startsWith(q))) ||
  (ALIASES[q] ?? []).some((alt) => nameTokens.includes(alt));
