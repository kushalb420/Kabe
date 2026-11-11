import assert from 'node:assert/strict';
import { PROXY_KEY, Sender, aiFunctionUrl, chooseAiRoute, effectiveAiKey, sendAi, sendAiWithRetry } from '../src/lib/backend';

const backend = { url: 'https://abcdefgh.supabase.co/', key: 'sb_publishable_abcdefghijklmnopqrstuvwxyz' };
assert.equal(aiFunctionUrl(backend.url), 'https://abcdefgh.supabase.co/functions/v1/ai', 'no double slash');

// ---- which route a request takes ----
assert.deepEqual(chooseAiRoute({ backend, directKey: 'AIza-dev' }), { kind: 'proxy', url: 'https://abcdefgh.supabase.co/functions/v1/ai', anonKey: backend.key }, 'the proxy wins, so no Google key is needed in the app');
assert.deepEqual(chooseAiRoute({ backend: null, directKey: ' AIza-dev ' }), { kind: 'direct', key: 'AIza-dev' });
assert.deepEqual(chooseAiRoute({ backend: null, directKey: '  ' }), { kind: 'none' });

// ---- the key the app sees ----
assert.equal(effectiveAiKey('', backend, 'AIza-dev'), PROXY_KEY, 'with a backend, AI is on and the Google key is never used');
assert.equal(effectiveAiKey('saved', null, 'AIza-dev'), 'AIza-dev', 'a build-time developer key beats an old saved one');
assert.equal(effectiveAiKey(' saved ', null, ''), 'saved');
assert.equal(effectiveAiKey('', null, ''), '', 'nothing set: AI stays off');

// ---- sending ----
const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
const ok: Sender = async (url, init) => {
  calls.push({ url, headers: init.headers, body: init.body });
  return { status: 200, json: async () => ({ hello: 'world' }) };
};
(async () => {
  const body = { model: 'm', input: 'hi' };
  const direct = await sendAi({ kind: 'direct', key: 'K' }, body, async () => 'T', ok);
  assert.deepEqual(direct, { status: 200, json: { hello: 'world' } });
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(calls[0].headers['x-goog-api-key'], 'K');
  assert.equal(calls[0].headers.Authorization, undefined, 'a direct call never carries the session token');
  assert.equal(calls[0].body, JSON.stringify(body));

  const proxied = await sendAi({ kind: 'proxy', url: 'https://x.supabase.co/functions/v1/ai', anonKey: 'ANON' }, body, async () => 'TOKEN', ok);
  assert.equal(proxied.status, 200);
  assert.equal(calls[1].url, 'https://x.supabase.co/functions/v1/ai');
  assert.equal(calls[1].headers.Authorization, 'Bearer TOKEN');
  assert.equal(calls[1].headers.apikey, 'ANON');
  assert.equal(calls[1].headers['x-goog-api-key'], undefined, 'the proxy call never carries a Google key');

  const noToken = await sendAi({ kind: 'proxy', url: 'u', anonKey: 'a' }, body, async () => null, ok);
  assert.equal(noToken.status, 401);
  assert.equal(calls.length, 2, 'nothing is sent without a session');
  assert.equal((await sendAi({ kind: 'none' }, body, async () => 'T', ok)).status, 401);

  const badBody: Sender = async () => ({ status: 502, json: async () => { throw new Error('not json'); } });
  assert.deepEqual(await sendAi({ kind: 'direct', key: 'K' }, body, async () => null, badBody), { status: 502, json: null }, 'a non-JSON error body is tolerated');
  // one retry on a 503, never on anything else
  let n = 0;
  const flaky: Sender = async () => ({ status: ++n === 1 ? 503 : 200, json: async () => ({ n }) });
  const waits: number[] = [];
  assert.equal((await sendAiWithRetry({ kind: 'direct', key: 'K' }, body, async () => null, flaky, async (ms) => void waits.push(ms))).status, 200);
  assert.equal(n, 2);
  assert.deepEqual(waits, [1500]);
  n = 0;
  const always503: Sender = async () => ({ status: (n++, 503), json: async () => null });
  assert.equal((await sendAiWithRetry({ kind: 'direct', key: 'K' }, body, async () => null, always503, async () => {})).status, 503);
  assert.equal(n, 2, 'only one retry');
  n = 0;
  const bad: Sender = async () => ({ status: (n++, 429), json: async () => null });
  assert.equal((await sendAiWithRetry({ kind: 'direct', key: 'K' }, body, async () => null, bad, async () => {})).status, 429);
  assert.equal(n, 1, 'a 429 is not retried');
  console.log('Backend tests passed.');
})();
