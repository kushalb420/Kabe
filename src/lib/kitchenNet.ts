// The network side of the kitchen: one Gemini call each for meal ideas, a recipe, a cooking question and a pantry photo.
// All checking is in kitchenAi.ts (pure, tested); `ask` is injectable so tests never touch the network.
import { CHAT_SCHEMA, DETAIL_SCHEMA, Detail, Equipment, PANTRY_PHOTO_PROMPT, PANTRY_PHOTO_SCHEMA, PantryItem, Request, SUGGEST_SCHEMA, Suggestion, Suggestions, Turn, buildChatPrompt, buildDetailPrompt, buildSuggestPrompt, parseAnswer, parseDetail, parsePantryPhoto, parseSuggestions } from './kitchenAi';
import { askJson } from './vision';

type Ask = (key: string, input: unknown, schema: object) => Promise<unknown>;

export async function suggestMeals(key: string, req: Request, ask: Ask = askJson): Promise<Suggestions> {
  return parseSuggestions(await ask(key, buildSuggestPrompt(req), SUGGEST_SCHEMA), req);
}

export async function recipeDetails(key: string, s: Suggestion, pantry: PantryItem[], equipment: Equipment, language?: string | null, ask: Ask = askJson): Promise<Detail | null> {
  return parseDetail(await ask(key, buildDetailPrompt(s, pantry, equipment, language), DETAIL_SCHEMA));
}

export async function askCook(key: string, s: Suggestion, detail: Detail | null, history: Turn[], question: string, language?: string | null, ask: Ask = askJson): Promise<string | null> {
  return parseAnswer(await ask(key, buildChatPrompt(s, detail, history, question, language), CHAT_SCHEMA));
}

export async function pantryFromPhoto(key: string, base64: string, mime: string, existing: PantryItem[], ask: Ask = askJson): Promise<{ name: string; qty: string }[]> {
  return parsePantryPhoto(await ask(key, [{ type: 'text', text: PANTRY_PHOTO_PROMPT }, { type: 'image', data: base64, mime_type: mime }], PANTRY_PHOTO_SCHEMA), existing);
}
