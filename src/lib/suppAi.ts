// The network side of supplements: one Gemini call to learn what a supplement contains, from its name or a photo of its label.
// All checking is in supplements.ts (pure, tested); `ask` is injectable so tests never touch the network.
import { SUPP_SCHEMA, SuppComposition, buildSuppLabelPrompt, buildSuppPrompt, parseSupp } from './supplements';
import { askJson } from './vision';

type Ask = (key: string, input: unknown, schema: object) => Promise<unknown>;
export type SuppRead = { name: string; composition: SuppComposition };

/** What one dose of a supplement holds, worked out from its name (and dose). Null when nothing reliable can be said. */
export async function readSupplementByName(key: string, name: string, dose: string, ask: Ask = askJson): Promise<SuppRead | null> {
  const r = parseSupp(await ask(key, buildSuppPrompt(name, dose), SUPP_SCHEMA), 'estimate');
  return r ? { name: r.name || name, composition: r.composition } : null;
}

/** The same, read from a photo of the label or facts panel (exact printed numbers). */
export async function readSupplementLabel(key: string, base64: string, mime: string, dose: string, ask: Ask = askJson): Promise<SuppRead | null> {
  const r = parseSupp(await ask(key, [{ type: 'text', text: buildSuppLabelPrompt(dose) }, { type: 'image', data: base64, mime_type: mime }], SUPP_SCHEMA), 'label');
  return r ? { name: r.name, composition: r.composition } : null;
}
