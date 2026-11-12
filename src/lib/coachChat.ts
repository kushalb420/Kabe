// AI coach chat (Gemini free tier, user's own key). The model never sees raw logs — it gets a computed summary
// (coachContext) and can call lookup_food to read real nutrition values. Rules below keep it honest and safe.
import type { Food } from '../data/foods';
import { searchFoods } from './foodSearch';
import { r0, r1 } from './nutrition';
import { MODELS } from './photo';
import { callGemini, friendlyError } from './vision';
import { lookupFood } from './mealAi';

import { plainText } from './coachText';
export { plainText, splitGoalProposal, type GoalProposal } from './coachText';

export type ChatMsg = { id: string; role: 'user' | 'coach'; text: string };

export const COACH_RULES = [
  'You are Kabe Coach, a friendly, practical fitness and nutrition coach inside a mobile app. The user may be a beginner: use plain words, metric units, and keep answers short (under ~150 words) unless asked for more. Be aware of Indian foods and eating habits.',
  'USE ONLY REAL NUMBERS. Quote calories/macros/weights/dates only if they appear in USER DATA below or in a lookup_food result. To know a food\'s nutrition, call lookup_food. If you have no reliable number, say so plainly — never guess or invent nutrition values.',
  'The analysis in USER DATA was computed by the app from the user\'s own logs. Explain it; do not recompute it or contradict it. If data is missing (e.g. few weigh-ins), say what is missing and what to log.',
  'Photo-based and typed portion sizes are estimates; mention uncertainty when relevant.',
  'You are not a doctor. Do not diagnose or treat. For medical conditions, pregnancy or breastfeeding, eating disorders, under-18s, diabetes, or any very low calorie plan, advise seeing a doctor or registered dietitian. Never encourage eating below the minimums in USER DATA or losing weight faster than ~1% of body weight per week.',
  'Free sugar always means ADDED sugar only (sugar, jaggery, honey, syrups, sweetened drinks and sweets), never the natural sugar in fruit, vegetables or plain milk. Do not tell the user to cut fruit or milk because of sugar.',
  'USER DATA includes limitsExceeded: the nutrients to keep under (free sugar, carbs, fat, saturated fat) that went over their daily limit today, and on how many of the last logged days. Mention it only when it helps the question, calmly and without shaming, and suggest one simple swap.',
  'Do not give supplement dosages or recommend extreme diets. You cannot change app data; tell the user where in the app to do it (Today, Diary, Train, Progress, Me).',
  'USER DATA includes recoveryAndActivity (sleep, readiness, rest days, activity). Use it when advising on training: if readiness is low or sleep is short, suggest lighter training or rest; never push through pain, dizziness or illness.',
  'FORMAT: plain text only. Never use asterisks, markdown, headings, tables or emoji. Write short, clear sentences and short paragraphs. For a list use lines that start with a bullet and a space. Keep it easy to read for a beginner.',
  'If your advice or suggestions mean the daily targets should change, finish with ONE last line exactly like: GOALS: {"kcal":2000,"protein":120,"carbs":220,"fat":65} using your recommended daily numbers (4 x protein + 4 x carbs + 9 x fat must be close to kcal; never below the minimums in USER DATA). The app asks the user before changing anything. Leave the line out when no change is needed.',
  'When suggesting what to eat next, prefer foods from the user\'s favourites/recents in USER DATA (their numbers are given) and fit the REMAINING calories and protein for today.',
].join('\n');

/** `language` is e.g. "Hindi": the coach then answers in that language (numbers and food names stay accurate). */
export const buildSystemInstruction = (contextJson: string, language?: string | null) =>
  `${COACH_RULES}${language ? `\nThe user reads ${language}. Reply in ${language} (simple, everyday words); keep numbers, units and food names exact.` : ''}\n\nUSER DATA (JSON):\n${contextJson}`;

export const LOOKUP_TOOL = {
  type: 'function',
  name: 'lookup_food',
  description: 'Look up real nutrition values (per 100 g) for a food or dish from the app\'s food databases. Use before quoting any food\'s calories or macros.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Food name, e.g. "chicken curry" or "paneer"' } },
    required: ['query'],
  },
};

/** Build the lookup the model can call: the user's own foods first, then the bundled USDA database. */
export const makeLookup = (ownFoods: Food[]) => (query: string): string => {
  const q = query.trim().toLowerCase();
  if (!q) return 'Empty query.';
  const mine = ownFoods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 3);
  const rows = [...mine, ...searchFoods(q, 5)].filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i).slice(0, 5);
  if (!rows.length) return `No reliable nutrition data found for "${query}". Do not guess numbers; tell the user you don't have data for it.`;
  return rows
    .map(
      (f) =>
        `${f.name} — per 100 g: ${r0(f.kcal)} kcal, protein ${r1(f.protein)} g, carbs ${r1(f.carbs)} g, fat ${r1(f.fat)} g` +
        (f.fiber !== undefined ? `, fiber ${r1(f.fiber)} g` : '') +
        (f.servingLabel && f.servingG !== 100 && f.servingLabel !== `${f.servingG} g` ? `; typical serving ${f.servingLabel} = ${f.servingG} g` : ''),
    )
    .join('\n');
};

const NO_DATA = 'No reliable nutrition data found';

/** The lookup the coach can call: the person's own foods and the built-in list first, then Gemini for anything else. */
export const makeFoodLookup = (key: string, ownFoods: Food[], find: (q: string) => Promise<Food | null> = (q) => lookupFood(key, q)) => {
  const local = makeLookup(ownFoods);
  return async (query: string): Promise<string> => {
    const db = local(query);
    if (!db.startsWith(NO_DATA)) return db;
    try {
      const f = await find(query);
      if (f) {
        return `${f.name} — per 100 g: ${r0(f.kcal)} kcal, protein ${r1(f.protein)} g, carbs ${r1(f.carbs)} g, free sugar ${r1(f.sugar ?? 0)} g, fiber ${r1(f.fiber ?? 0)} g, saturated fat ${r1(f.satFat ?? 0)} g, total fat ${r1(f.fat)} g; typical serving ${f.servingLabel}`;
      }
    } catch {
      /* fall through to "no data" */
    }
    return db;
  };
};

export const historyToSteps =(history: ChatMsg[]): object[] =>
  history.flatMap((m): object[] =>
    m.role === 'user' ? [{ type: 'user_input', content: m.text }] : [{ type: 'model_output', content: [{ type: 'text', text: m.text }] }],
  );

export type Call = (body: unknown) => Promise<{ status: number; json: any }>;

class ModelUnavailable extends Error {}

const textOf = (steps: any[]) =>
  steps
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
    .map((c: any) => c.text as string)
    .join('')
    .trim();

/** Run one coach turn, letting the model call lookup_food (stateless: we resend the full history each round). */
export async function runCoach(opts: {
  call: Call;
  models?: string[];
  history: ChatMsg[];
  question: string;
  system: string;
  lookup: (query: string) => string | Promise<string>;
  maxRounds?: number;
}): Promise<string> {
  const { call, history, question, system, lookup, models = MODELS, maxRounds = 3 } = opts;
  let lastErr: Error | null = null;
  for (const model of models) {
    try {
      let steps: any[] = [...historyToSteps(history.slice(-12)), { type: 'user_input', content: question }];
      for (let round = 0; round <= maxRounds; round++) {
        const { status, json } = await call({ model, input: steps, system_instruction: system, tools: [LOOKUP_TOOL], store: false });
        if (status !== 200) {
          const msg = json?.error?.message ? String(json.error.message) : '';
          if (status === 404 || (status === 400 && /model/i.test(msg))) throw new ModelUnavailable(msg);
          throw friendlyError(status, json);
        }
        const out: any[] = json?.steps ?? [];
        const calls = out.filter((s) => s.type === 'function_call');
        if (!calls.length) {
          const text = textOf(out);
          if (!text) throw new Error('The coach had no answer this time. Try rephrasing your question.');
          return text;
        }
        const results = await Promise.all(
          calls.map(async (c) => ({
            type: 'function_result',
            name: c.name,
            call_id: c.id,
            result: [{ type: 'text', text: c.name === 'lookup_food' ? await lookup(String(c.arguments?.query ?? '')) : 'Unknown tool.' }],
          })),
        );
        steps = [
          ...steps,
          ...out, // model steps exactly as received (thoughts, function calls)
          ...results,
        ];
      }
      throw new Error('The coach got stuck looking things up. Please try again.');
    } catch (e) {
      if (e instanceof ModelUnavailable) {
        lastErr = e;
        continue; // try the next free model
      }
      throw e;
    }
  }
  throw lastErr ? new Error('No free AI model was available right now. Try again later.') : new Error('Coach unavailable.');
}

/** Real network call with the user's key. */
export const coachReply = (key: string, history: ChatMsg[], question: string, system: string, lookup: (q: string) => string | Promise<string>) =>
  runCoach({ call: (body) => callGemini(key, body), history, question, system, lookup }).then(plainText);
