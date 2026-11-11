// Nutrition-label scan. The AI model only TRANSCRIBES the numbers printed on the pack (like OCR); it is told to answer null
// for anything it cannot read and never to work anything out. Kabe then converts to "per 100 g", checks that the numbers
// agree with each other and shows every value in editable boxes. Nothing is saved until the user confirms.
import type { Food } from '../data/foods';
import { MODELS } from './photo';

export type Basis = 'per100' | 'perServing';
export type LabelNumbers = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null; sugar: number | null; satFat: number | null; sodiumMg: number | null }; // sugar = ADDED sugars when the label lists them, else total sugars
export type LabelRead = { name: string; basis: Basis | 'unclear'; servingG: number | null; values: LabelNumbers };

export const EMPTY_VALUES: LabelNumbers = { kcal: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null, satFat: null, sodiumMg: null };

// ---------------------------------------------------------------- reading the photo
export const buildLabelPrompt = () =>
  [
    'You are reading the nutrition facts table printed on a food package, like an OCR tool.',
    'Copy the numbers exactly as printed. If a number is missing, cut off, blurry or you are not sure, answer null for it.',
    'NEVER calculate, convert or estimate anything yourself, and never use your own knowledge of the product.',
    '',
    'Give:',
    '- product_name: the product name printed on the pack, or null',
    '- basis: "per100" if you are giving the "per 100 g" / "per 100 ml" column, "perServing" if you are giving the "per serving" column, "unclear" if you cannot tell. If both columns are printed, give the per 100 g / per 100 ml column.',
    '- serving_size: the serving size in grams or ml as printed (a number), or null',
    '- kcal: energy in kcal (NOT kJ; null if only kJ is printed)',
    '- protein, carbs (total carbohydrate), fat (total fat), saturated_fat (saturated fat), fiber (dietary fibre): grams',
    '- sugar: ADDED sugars in grams if the table lists added sugars; otherwise the total sugars',
    '- sodium_mg: sodium in milligrams (null if the label shows only salt)',
    '',
    'If the image does not show a nutrition table, answer null for every number.',
  ].join('\n');

const NUM = { type: ['number', 'null'] };
const SCHEMA = {
  type: 'object',
  properties: {
    product_name: { type: ['string', 'null'] },
    basis: { type: 'string', enum: ['per100', 'perServing', 'unclear'] },
    serving_size: NUM,
    kcal: NUM,
    protein: NUM,
    carbs: NUM,
    fat: NUM,
    fiber: NUM,
    sugar: NUM,
    saturated_fat: NUM,
    sodium_mg: NUM,
  },
  required: ['basis'],
};

export const buildLabelRequest = (model: string, base64: string, mime: string) => ({
  model,
  input: [
    { type: 'text', text: buildLabelPrompt() },
    { type: 'image', data: base64, mime_type: mime },
  ],
  response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
});
export { MODELS };

type Step = { type?: string; content?: { type?: string; text?: string }[] };

/** A printed value must be a real, non-negative number below a ceiling; anything else becomes "unknown" (null), never a guess. */
export const cleanNumber = (v: unknown, max: number): number | null => {
  if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > max) return null;
  return Math.round(v * 100) / 100;
};

export function parseLabelResponse(json: unknown): LabelRead {
  const r = json as { status?: string; steps?: Step[] };
  if (!r || typeof r !== 'object') throw new Error('The AI returned an unreadable response.');
  if (r.status && r.status !== 'completed') throw new Error(`The AI request did not finish (status: ${r.status}).`);
  const text = (r.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('');
  if (!text) throw new Error('The AI returned no answer. Try another photo.');
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('The AI answer was not valid JSON. Try again.');
  }
  if (!d || typeof d !== 'object') throw new Error('The AI answer was empty.');
  const serving = cleanNumber(d.serving_size, 2000);
  return {
    name: typeof d.product_name === 'string' ? d.product_name.trim().slice(0, 80) : '',
    basis: d.basis === 'per100' || d.basis === 'perServing' ? d.basis : 'unclear',
    servingG: serving !== null && serving >= 1 ? serving : null,
    values: {
      kcal: cleanNumber(d.kcal, 4000),
      protein: cleanNumber(d.protein, 1000),
      carbs: cleanNumber(d.carbs, 1000),
      fat: cleanNumber(d.fat, 1000),
      fiber: cleanNumber(d.fiber, 1000),
      sugar: cleanNumber(d.sugar, 1000),
      satFat: cleanNumber(d.saturated_fat, 1000),
      sodiumMg: cleanNumber(d.sodium_mg, 100000),
    },
  };
}

/** Did the photo yield anything at all? (an empty table means "not a label / unreadable") */
export const hasAnyNumber = (v: LabelNumbers): boolean => Object.values(v).some((x) => x !== null);

// ---------------------------------------------------------------- converting and checking
export type Warning = 'unclearBasis' | 'noServing' | 'kcalMissing' | 'atwater' | 'sugarOverCarbs' | 'fiberOverCarbs' | 'tooMuchMass' | 'kcalTooHigh';

const r2 = (n: number) => Math.round(n * 100) / 100;
const scale = (v: number | null, k: number): number | null => (v === null ? null : r2(v * k));

/** Values per 100 g from what is printed, or null when a per-serving label has no serving size to convert with. */
export function toPer100(values: LabelNumbers, basis: Basis, servingG: number | null): LabelNumbers | null {
  if (basis === 'per100') return { ...values };
  if (!servingG || servingG <= 0) return null;
  const k = 100 / servingG;
  return { kcal: scale(values.kcal, k), protein: scale(values.protein, k), carbs: scale(values.carbs, k), fat: scale(values.fat, k), fiber: scale(values.fiber, k), sugar: scale(values.sugar, k), satFat: scale(values.satFat, k), sodiumMg: scale(values.sodiumMg, k) };
}

/** Energy implied by the macros (4 kcal per g protein and carbohydrate, 9 per g fat). Only used when the user asks for it. */
export const kcalFromMacros = (v: Pick<LabelNumbers, 'protein' | 'carbs' | 'fat'>): number | null =>
  v.protein === null || v.carbs === null || v.fat === null ? null : Math.round(v.protein * 4 + v.carbs * 4 + v.fat * 9);

/** Problems that make the numbers doubtful. The screen shows them; the user decides. Works on per-100 g values. */
export function checkLabel(per100: LabelNumbers | null, readBasis: Basis | 'unclear', basisUsed: Basis, servingG: number | null): Warning[] {
  const w: Warning[] = [];
  if (readBasis === 'unclear') w.push('unclearBasis');
  if (basisUsed === 'perServing' && !servingG) w.push('noServing');
  if (!per100) return w;
  const { kcal, protein, carbs, fat, fiber, sugar } = per100;
  if (kcal === null) w.push('kcalMissing');
  if (kcal !== null && protein !== null && carbs !== null && fat !== null) {
    const atw = protein * 4 + carbs * 4 + fat * 9;
    if (Math.abs(atw - kcal) > Math.max(25, kcal * 0.2)) w.push('atwater'); // printed labels round, but not by this much
  }
  if (sugar !== null && carbs !== null && sugar > carbs + 1) w.push('sugarOverCarbs');
  if (fiber !== null && carbs !== null && fiber > carbs + 1) w.push('fiberOverCarbs');
  if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > 105) w.push('tooMuchMass'); // more than 100 g of nutrients in 100 g of food
  if (kcal !== null && kcal > 900) w.push('kcalTooHigh'); // pure fat is about 900 kcal per 100 g
  return w;
}

/** A custom food from confirmed per-100 g values. kcal, protein, carbs and fat must be known; optional values stay unknown, never zero. */
export function labelToFood(name: string, per100: LabelNumbers, servingG: number | null): Omit<Food, 'id' | 'custom'> | null {
  const n = name.trim();
  if (!n || per100.kcal === null || per100.kcal <= 0) return null;
  const serving = servingG && servingG > 0 ? Math.round(servingG) : 100;
  return {
    name: n.slice(0, 80),
    category: 'Label',
    kcal: per100.kcal,
    protein: per100.protein ?? 0,
    carbs: per100.carbs ?? 0,
    fat: per100.fat ?? 0,
    ...(per100.fiber !== null ? { fiber: per100.fiber } : {}),
    ...(per100.sugar !== null ? { sugar: per100.sugar } : {}),
    ...(per100.satFat !== null ? { satFat: per100.satFat } : {}),
    ...(per100.sodiumMg !== null ? { sodium: per100.sodiumMg } : {}),
    servingG: serving,
    servingLabel: `${serving} g`,
  };
}

/** What a box on the screen holds → a number, or null for an empty or invalid box. */
export const parseBox = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : null;
};

export const valuesToBoxes = (v: LabelNumbers): Record<keyof LabelNumbers, string> => ({
  kcal: v.kcal === null ? '' : String(v.kcal),
  protein: v.protein === null ? '' : String(v.protein),
  carbs: v.carbs === null ? '' : String(v.carbs),
  fat: v.fat === null ? '' : String(v.fat),
  fiber: v.fiber === null ? '' : String(v.fiber),
  sugar: v.sugar === null ? '' : String(v.sugar),
  satFat: v.satFat === null ? '' : String(v.satFat),
  sodiumMg: v.sodiumMg === null ? '' : String(v.sodiumMg),
});

export const boxesToValues = (b: Record<keyof LabelNumbers, string>): LabelNumbers => ({
  kcal: parseBox(b.kcal),
  protein: parseBox(b.protein),
  carbs: parseBox(b.carbs),
  fat: parseBox(b.fat),
  fiber: parseBox(b.fiber),
  sugar: parseBox(b.sugar),
  satFat: parseBox(b.satFat),
  sodiumMg: parseBox(b.sodiumMg),
});
