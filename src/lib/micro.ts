// Vitamins and minerals (pure logic, tested in scripts/test-micro.ts).
// Values per 100 g come from the AI (asked once per food and remembered), so they are shown as estimates of typical values.
// Anything outside a believable range is thrown away, and a food with too few usable values is skipped, never guessed.

export type MicroId = 'iron' | 'calcium' | 'magnesium' | 'potassium' | 'zinc' | 'vitaminA' | 'vitaminC' | 'vitaminD' | 'vitaminB12' | 'folate' | 'vitaminE' | 'vitaminK';
export type MicroDef = { id: MicroId; unit: 'mg' | 'mcg'; dv: number; max: number };

/** dv = typical adult daily value (the common labelling reference); max = the most any food has per 100 g (to catch nonsense). */
export const MICROS: MicroDef[] = [
  { id: 'iron', unit: 'mg', dv: 18, max: 60 },
  { id: 'calcium', unit: 'mg', dv: 1300, max: 1500 },
  { id: 'magnesium', unit: 'mg', dv: 420, max: 800 },
  { id: 'potassium', unit: 'mg', dv: 4700, max: 3500 },
  { id: 'zinc', unit: 'mg', dv: 11, max: 80 },
  { id: 'vitaminA', unit: 'mcg', dv: 900, max: 30000 },
  { id: 'vitaminC', unit: 'mg', dv: 90, max: 2500 },
  { id: 'vitaminD', unit: 'mcg', dv: 20, max: 250 },
  { id: 'vitaminB12', unit: 'mcg', dv: 2.4, max: 120 },
  { id: 'folate', unit: 'mcg', dv: 400, max: 1500 },
  { id: 'vitaminE', unit: 'mg', dv: 15, max: 200 },
  { id: 'vitaminK', unit: 'mcg', dv: 120, max: 2000 },
];

export type MicroRow = Partial<Record<MicroId, number>>; // per 100 g

export const MICRO_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(MICROS.map((m) => [m.id, { type: 'number' }])),
  required: MICROS.map((m) => m.id),
};

/** Cache key for a food: its name, lower-cased, trimmed and without the "(AI estimate)" style suffix. */
export const microKey = (name: string): string => name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export function buildMicroPrompt(food: string): string {
  const units = MICROS.map((m) => `${m.id} (${m.unit})`).join(', ');
  return [
    `Give typical vitamin and mineral amounts per 100 g of "${microKey(food)}" as commonly eaten (use the Indian home-style version if it is an Indian dish).`,
    `Return numbers per 100 g in these units: ${units}.`,
    'Be realistic, based on standard food composition tables. Use 0 only when the amount is truly negligible. Do not explain.',
  ].join('\n');
}

/** Keeps only believable numbers. Returns null when fewer than 6 of the 12 are usable (the food is then left out, never guessed). */
export function parseMicro(raw: unknown): MicroRow | null {
  const o = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!o) return null;
  const row: MicroRow = {};
  for (const m of MICROS) {
    const v = o[m.id];
    // only real numbers count: null, text and missing values are "unknown", never 0
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= m.max) row[m.id] = Math.round(v * 100) / 100;
  }
  return Object.keys(row).length >= 6 ? row : null;
}

export type Intake = Record<MicroId, number>;
export type Logged = { name: string; grams: number; kcal: number };

/** Sum the day's vitamins and minerals. `coverage` is the share of the logged calories whose food has data (so the person knows how complete it is). */
export function intakeOf(logged: Logged[], table: Record<string, MicroRow | undefined>): { total: Intake; coverage: number } {
  const total = Object.fromEntries(MICROS.map((m) => [m.id, 0])) as Intake;
  let kcalAll = 0;
  let kcalKnown = 0;
  for (const e of logged) {
    kcalAll += e.kcal;
    const row = table[microKey(e.name)];
    if (!row) continue;
    kcalKnown += e.kcal;
    for (const m of MICROS) total[m.id] += ((row[m.id] ?? 0) * e.grams) / 100;
  }
  return { total, coverage: kcalAll > 0 ? kcalKnown / kcalAll : 0 };
}

export type Level = 'low' | 'ok' | 'plenty';
/** Share of the daily value, and a plain level: under half is low, half to double is on track, above that plenty. */
export function shareOf(amount: number, def: MicroDef): { pct: number; level: Level } {
  const pct = def.dv > 0 ? (amount / def.dv) * 100 : 0;
  return { pct, level: pct < 50 ? 'low' : pct <= 200 ? 'ok' : 'plenty' };
}

/** The foods in a list whose vitamins and minerals are still unknown (each name once, biggest calories first). */
export function missingFoods(logged: Logged[], table: Record<string, MicroRow | undefined>): string[] {
  const kcal = new Map<string, number>();
  for (const e of logged) {
    const k = microKey(e.name);
    if (!k || table[k]) continue;
    kcal.set(k, (kcal.get(k) ?? 0) + e.kcal);
  }
  return [...kcal.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
