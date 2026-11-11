// Network layer for photo analysis (Gemini free tier, user's own key). Pure logic lives in photo.ts.
import { BUILTIN_BACKEND, PROXY_KEY, chooseAiRoute, getAccessToken, sendAiWithRetry } from './backend';
import { LabelRead, buildLabelRequest, parseLabelResponse } from './label';
import { MenuDish, buildMenuRequest, parseMenuResponse } from './menu';
import { MICRO_SCHEMA, MicroRow, buildMicroPrompt, parseMicro } from './micro';
import { AiInsights, INSIGHT_SCHEMA, InsightFacts, buildInsightPrompt, checkInsights } from './insights';
import { NARRATIVE_SCHEMA, Narrative, WeekFacts, buildWeeklyPrompt, checkNarrative } from './weekly';
import { ParsedMeal, buildAudioRequest, buildTextRequest, parseSpeechResponse } from './voice';
import { MODELS, RawItem, buildRequest, parseResponse } from './photo';

/** One AI request. The app's "key" is PROXY_KEY when the build has a backend (the request goes through it, with the person's session), otherwise a real Google key. */
export async function callGemini(key: string, body: unknown): Promise<{ status: number; json: any }> {
  const route = key === PROXY_KEY ? chooseAiRoute({ backend: BUILTIN_BACKEND, directKey: '' }) : chooseAiRoute({ backend: null, directKey: key });
  return (await sendAiWithRetry(route, body, getAccessToken, (url, init) => fetch(url, init))) as { status: number; json: any };
}

const apiMessage = (json: any) => (json?.error?.message ? String(json.error.message).slice(0, 200) : '');

export function friendlyError(status: number, json: any): Error {
  const m = apiMessage(json);
  if (status === 400 && /api key/i.test(m)) return new Error('The AI service rejected its key. Please try again later.');
  if (status === 401 || status === 403) return new Error(`The AI service refused the request (${status}). ${m}`.trim());
  if (status === 429) return new Error(/allowance/i.test(m) ? m : 'Free AI limit reached for now. Wait a few minutes (or until tomorrow) and try again. You can still log food by search or barcode.');
  if (status >= 500) return new Error('Google’s AI service is having trouble. Try again shortly.');
  return new Error(`AI request failed (${status}). ${m}`.trim());
}

/** Send a plate photo; try each free model in turn if one isn't available. */
export async function analyzePlate(key: string, base64: string, mime: string, databaseNames: string[]): Promise<{ items: RawItem[]; notes: string }> {
  let lastErr: Error | null = null;
  for (const model of MODELS) {
    const { status, json } = await callGemini(key, buildRequest(model, base64, mime, databaseNames));
    if (status === 200) return parseResponse(json);
    const err = friendlyError(status, json);
    // a missing/unsupported model is worth trying the next one; anything else won't be fixed by switching
    if (status === 404 || status === 503 || (status === 400 && /model/i.test(apiMessage(json)))) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error('No free AI model was available.');
}

/** Send a menu photo; the model only reads dish names and guesses serving sizes (no nutrition). */
export async function readMenu(key: string, base64: string, mime: string): Promise<{ restaurant: string; dishes: MenuDish[] }> {
  let lastErr: Error | null = null;
  for (const model of MODELS) {
    const { status, json } = await callGemini(key, buildMenuRequest(model, base64, mime));
    if (status === 200) return parseMenuResponse(json);
    const err = friendlyError(status, json);
    if (status === 404 || status === 503 || (status === 400 && /model/i.test(apiMessage(json)))) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error('No free AI model was available.');
}

/** Work out what was eaten from a typed sentence or a short recording. Only names and amounts come back, never nutrition. */
export async function understandMeal(key: string, input: { text: string } | { base64: string; mime: string }): Promise<ParsedMeal> {
  let lastErr: Error | null = null;
  for (const model of MODELS) {
    const body = 'text' in input ? buildTextRequest(model, input.text) : buildAudioRequest(model, input.base64, input.mime);
    const { status, json } = await callGemini(key, body);
    if (status === 200) return parseSpeechResponse(json);
    const err = friendlyError(status, json);
    if (status === 404 || status === 503 || (status === 400 && /model/i.test(apiMessage(json)))) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error('No free AI model was available.');
}

/** Send a photo of a nutrition label; the model only transcribes the printed numbers (null when unreadable). */
export async function readLabel(key: string, base64: string, mime: string): Promise<LabelRead> {
  let lastErr: Error | null = null;
  for (const model of MODELS) {
    const { status, json } = await callGemini(key, buildLabelRequest(model, base64, mime));
    if (status === 200) return parseLabelResponse(json);
    const err = friendlyError(status, json);
    if (status === 404 || status === 503 || (status === 400 && /model/i.test(apiMessage(json)))) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error('No free AI model was available.');
}

/** Ask Gemini for a JSON answer matching `schema` (tries each free model). `call` is injectable for tests. */
export async function askJson(
  key: string,
  input: unknown,
  schema: object,
  call: (body: unknown) => Promise<{ status: number; json: any }> = (b) => callGemini(key, b),
): Promise<any> {
  let lastErr: Error | null = null;
  for (const model of MODELS) {
    const { status, json } = await call({ model, input, response_format: { type: 'text', mime_type: 'application/json', schema } });
    if (status === 200) {
      const text = ((json?.steps ?? []) as any[])
        .filter((s) => s.type === 'model_output')
        .flatMap((s) => s.content ?? [])
        .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
        .map((c: any) => c.text as string)
        .join('')
        .trim()
        .replace(/^```(?:json)?\s*|\s*```$/g, '');
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('The AI answer was not valid JSON.');
      }
    }
    const err = friendlyError(status, json);
    if (status === 404 || status === 503 || (status === 400 && /model/i.test(apiMessage(json)))) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr ?? new Error('No free AI model was available.');
}

/** AI wording of the weekly facts. Returns null when the AI's text uses any number that is not in the facts (see checkNarrative). */
export async function writeWeekly(key: string, facts: WeekFacts, language: string): Promise<Narrative | null> {
  return checkNarrative(await askJson(key, buildWeeklyPrompt(facts, language), NARRATIVE_SCHEMA), facts);
}

/** AI tips: what to eat more of, less of, and where to improve. Returns null when the text uses a number that is not in the facts. */
export async function writeInsights(key: string, facts: InsightFacts, language: string): Promise<AiInsights | null> {
  return checkInsights(await askJson(key, buildInsightPrompt(facts, language), INSIGHT_SCHEMA), facts);
}

/** Typical vitamins and minerals per 100 g of a food (AI estimate; implausible numbers are dropped). */
export async function lookupMicros(key: string, food: string): Promise<MicroRow | null> {
  return parseMicro(await askJson(key, buildMicroPrompt(food), MICRO_SCHEMA));
}

/** Tiny text-only request so users can check their key works. */
export async function testKey(key: string): Promise<string> {
  for (const model of MODELS) {
    const { status, json } = await callGemini(key, { model, input: 'Reply with the single word: OK' });
    if (status === 200) return model;
    if (status === 404) continue;
    throw friendlyError(status, json);
  }
  throw new Error('Your key works but no free model answered. Try again later.');
}

/** One cheap call for a typed list of dishes: calories of one basic serving each (no other nutrients, no per-dish searching). */
export async function estimateDishKcal(key: string, names: string[]): Promise<(number | null)[]> {
  const list = names.slice(0, 40);
  const schema = { type: 'object', properties: { kcal: { type: 'array', items: { type: ['number', 'null'] } } }, required: ['kcal'] };
  const out = await askJson(key, 'For each dish below, give the calories in ONE typical restaurant serving as a single number from standard food tables (null if it is not food). Answer {"kcal": [...]} in the same order, one number per dish.\n' + JSON.stringify(list), schema);
  const arr: unknown[] = Array.isArray(out?.kcal) ? out.kcal : [];
  return list.map((_, i) => {
    const n = arr[i];
    return typeof n === 'number' && isFinite(n) && n >= 10 && n <= 3500 ? Math.round(n) : null;
  });
}
