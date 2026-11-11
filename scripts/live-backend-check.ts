// LIVE check of the deployed backend with the values in .env: guest sign-in, then an AI request through the proxy.
//   npx tsx scripts/live-backend-check.ts
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env first.');

(async () => {
  const guest = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' });
  const gj: any = await guest.json();
  console.log('guest sign-in:', guest.status, gj.user?.is_anonymous ? 'anonymous user created' : JSON.stringify(gj).slice(0, 200));
  const token = gj.access_token;
  if (!token) return;
  const ai = await fetch(`${url}/functions/v1/ai`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({ model: 'gemini-3.5-flash-lite', input: 'Reply with the single word: OK' }),
  });
  const text = await ai.text();
  console.log('ai proxy:', ai.status, text.slice(0, 300));
  const noAuth = await fetch(`${url}/functions/v1/ai`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' });
  console.log('without a session:', noAuth.status, '(should be 401)');
})();
