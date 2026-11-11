// Spoken or typed commands that are not meals: "drank 2 glasses of water", "I weigh 72.5 kg", "walked 30 minutes".
// Pure and tested in scripts/test-commands.ts. A command is always shown for confirmation before anything is saved.

export type Command =
  | { type: 'water'; ml: number }
  | { type: 'weight'; kg: number }
  | { type: 'activity'; kind: 'walk' | 'run' | 'cycle'; minutes: number; km?: number; assumedPace: boolean };

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const clean = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2') // decimal comma
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const t = s.trim();
  if (/^half/.test(t)) return 0.5;
  if (t in WORDS) return WORDS[t];
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

const UNIT_ML: [RegExp, number][] = [
  [/^(ml|millilit(?:re|er)s?)$/, 1],
  [/^(l|lit(?:re|er)s?)$/, 1000],
  [/^glass(?:es)?$/, 250],
  [/^cups?$/, 240],
  [/^bottles?$/, 500],
];

function water(t: string): Command | null {
  const m = t.match(/(?:(\d+(?:\.\d+)?|half(?: an?)?|an?|one|two|three|four|five|six|seven|eight)\s+)?(ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|glass(?:es)?|cups?|bottles?)\s+(?:of\s+)?water\b/);
  if (m) {
    const qty = m[1] === undefined ? 1 : num(m[1]);
    const unit = UNIT_ML.find(([re]) => re.test(m[2]));
    if (qty === null || !unit) return null;
    const ml = Math.round(qty * unit[1]);
    return ml >= 50 && ml <= 6000 ? { type: 'water', ml } : null;
  }
  return /^(i\s+)?(just\s+)?(drank|had|drink)\s+(some\s+)?water$/.test(t) ? { type: 'water', ml: 250 } : null;
}

function weight(t: string): Command | null {
  const m =
    t.match(/\bweigh(?:ed|ing|s)?\s+(?:is\s+|was\s+|about\s+|around\s+)?(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)?\b/) ??
    t.match(/\bmy\s+weight\s+(?:is|was)\s+(?:about\s+|around\s+)?(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)?\b/) ??
    t.match(/\bi\s+am\s+(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/);
  if (!m) return null;
  const kg = parseFloat(m[1]);
  return kg >= 20 && kg <= 300 ? { type: 'weight', kg: Math.round(kg * 10) / 10 } : null;
}

const KIND: Record<string, 'walk' | 'run' | 'cycle'> = { walked: 'walk', walk: 'walk', ran: 'run', run: 'run', jogged: 'run', cycled: 'cycle', biked: 'cycle', rode: 'cycle' };
const SPEED_KMH = { walk: 5, run: 9, cycle: 15 } as const;

function activity(t: string): Command | null {
  const v = t.match(/\b(walked|walk|ran|run|jogged|cycled|biked|rode)\b(.*)$/);
  if (!v) return null;
  const kind = KIND[v[1]];
  let minutes: number | null = null;
  let km: number | null = null;
  for (const m of v[2].matchAll(/(\d+(?:\.\d+)?)\s*(km|kms|kilomet(?:re|er)s?|min|mins|minutes?|hours?|hrs?|h)\b/g)) {
    const n = parseFloat(m[1]);
    if (/^(km|kms|kilo)/.test(m[2])) km = n;
    else if (/^(min)/.test(m[2])) minutes = n;
    else minutes = n * 60;
  }
  let assumedPace = false;
  if (minutes === null && km !== null) {
    minutes = Math.round((km / SPEED_KMH[kind]) * 60);
    assumedPace = true;
  }
  if (minutes === null) return null;
  minutes = Math.round(minutes);
  if (minutes < 1 || minutes > 600) return null;
  if (km !== null && (km <= 0 || km > 200)) return null;
  return { type: 'activity', kind, minutes, ...(km !== null ? { km: Math.round(km * 10) / 10 } : {}), assumedPace };
}

/** The command in a sentence, or null when it is not one (so the sentence is treated as a meal). */
export function parseCommand(raw: string): Command | null {
  const t = clean(raw);
  if (!t) return null;
  return water(t) ?? weight(t) ?? activity(t);
}
