// The app's own backend (one Supabase project that YOU run): an AI proxy, friends, and optional account backup.
// Set at build time with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY (see .env.example and docs/DEPLOY.md).
// Pure and tested in scripts/test-backend.ts. Nothing here imports React Native.
import { CloudConfig, validateConfig } from './cloudConfig';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const key = (process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '').trim();

/** The built-in project, or null when this build has none (then people may connect their own project in the Cloud screen). */
export const BUILTIN_BACKEND: CloudConfig | null = url && key && !validateConfig({ url, key }) ? { url, key } : null;

/** Stands in for the AI key everywhere: "AI is available, send it through the backend". The real Google key never leaves the server. */
export const PROXY_KEY = 'kabe-ai-proxy';

export const aiFunctionUrl = (base: string): string => `${base.trim().replace(/\/+$/, '')}/functions/v1/ai`;

export type AiRoute = { kind: 'direct'; key: string } | { kind: 'proxy'; url: string; anonKey: string } | { kind: 'none' };

/** Which way an AI request goes. The proxy wins whenever the build has a backend, so no Google key has to ship in the app. */
export function chooseAiRoute(opts: { backend: CloudConfig | null; directKey: string }): AiRoute {
  if (opts.backend) return { kind: 'proxy', url: aiFunctionUrl(opts.backend.url), anonKey: opts.backend.key };
  const k = opts.directKey.trim();
  return k ? { kind: 'direct', key: k } : { kind: 'none' };
}

/** The key the rest of the app treats as "AI is on". */
export const effectiveAiKey = (saved: string, backend: CloudConfig | null, builtinDirect: string): string => (backend ? PROXY_KEY : builtinDirect.trim() || saved.trim());

const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const REVISION = '2026-05-20';

export type Sender = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ status: number; json: () => Promise<unknown> }>;

/**
 * Sends one AI request and returns Google's status and JSON, either straight to Google (a developer's own key)
 * or through the proxy with the person's session token.
 */
export async function sendAi(
  route: AiRoute,
  body: unknown,
  getToken: () => Promise<string | null>,
  send: Sender,
): Promise<{ status: number; json: unknown }> {
  if (route.kind === 'none') return { status: 401, json: { error: { message: 'AI is not set up in this build.' } } };
  let url = GOOGLE;
  let headers: Record<string, string> = { 'Content-Type': 'application/json', 'Api-Revision': REVISION };
  if (route.kind === 'direct') headers['x-goog-api-key'] = route.key;
  else {
    const token = await getToken();
    if (!token) return { status: 401, json: { error: { message: 'Could not start a session. Check your connection and try again.' } } };
    url = route.url;
    headers = { 'Content-Type': 'application/json', apikey: route.anonKey, Authorization: `Bearer ${token}` };
  }
  const res = await send(url, { method: 'POST', headers, body: JSON.stringify(body) });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, json };
}

/** Google answers 503 ("overloaded") now and then. One quiet retry after a short pause fixes most of those. */
export async function sendAiWithRetry(
  route: AiRoute,
  body: unknown,
  getToken: () => Promise<string | null>,
  send: Sender,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ status: number; json: unknown }> {
  const first = await sendAi(route, body, getToken, send);
  if (first.status !== 503) return first;
  await wait(1500);
  return sendAi(route, body, getToken, send);
}

// ---------------------------------------------------------------- the session token provider (set by the cloud store)
let tokenProvider: () => Promise<string | null> = async () => null;
export const setTokenProvider = (fn: () => Promise<string | null>) => {
  tokenProvider = fn;
};
export const getAccessToken = (): Promise<string | null> => tokenProvider();
