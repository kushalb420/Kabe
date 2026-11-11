// Kabe AI proxy (Supabase Edge Function, Deno). The Google key lives here as a secret and never ships inside the app.
//
// Deploy:   supabase functions deploy ai
//           supabase secrets set GEMINI_API_KEY=your-free-tier-key
// Optional: supabase secrets set AI_DAILY_LIMIT=150   (requests per person per day, default 150)
//
// Each request must carry a signed-in (or anonymous) Supabase session. The function checks it, counts the request in
// kabe_ai_hit (see supabase/schema.sql), then forwards the body to Google and returns Google's answer unchanged.
import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const REVISION = '2026-05-20';
const MAX_BODY_BYTES = 12 * 1024 * 1024; // photos are sent inline; this is well above a phone photo after resizing

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (status: number, message: string) => reply(status, { error: { message } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'Use POST.');

  const googleKey = Deno.env.get('GEMINI_API_KEY');
  if (!googleKey) return fail(500, 'The AI service is not configured yet.');

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await supabase.auth.getUser();
  if (!who?.user) return fail(401, 'Sign in again.');

  const limit = Math.max(1, parseInt(Deno.env.get('AI_DAILY_LIMIT') ?? '150', 10) || 150);
  const { data: allowed, error: limitError } = await supabase.rpc('kabe_ai_hit', { p_limit: limit });
  if (limitError) return fail(500, 'The AI service is not set up yet (run the setup SQL).');
  if (!allowed) return fail(429, 'You have used today\'s AI allowance. It resets tomorrow.');

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, 'That photo is too large.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'Bad request.');
  }

  const upstream = await fetch(GOOGLE, {
    method: 'POST',
    headers: { 'x-goog-api-key': googleKey, 'Content-Type': 'application/json', 'Api-Revision': REVISION },
    body: JSON.stringify(body),
  });
  return new Response(await upstream.text(), { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
