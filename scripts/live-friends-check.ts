// LIVE check of friends against the deployed backend (uses two guest users). npx tsx scripts/live-friends-check.ts
import { readFileSync } from 'node:fs';
import { addFriend, fetchBoard, saveProfile, sharePlan, fetchFriendPlans, type SocialClient } from '../src/lib/social';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_KEY;

async function guest(): Promise<SocialClient> {
  const r = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' });
  const token = ((await r.json()) as any).access_token as string;
  return {
    rpc: async (fn, args) => {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args ?? {}) });
      const body: any = await res.json().catch(() => null);
      return res.ok ? { data: body, error: null } : { data: null, error: { message: body?.message ?? String(res.status), code: body?.code } };
    },
  };
}

(async () => {
  const a = await guest();
  const b = await guest();
  const week = { week: '2026-11-09', steps: 8200, activeMinutes: 40, loggedDays: 2, points: 22 };
  const codeA = await saveProfile(a, 'Asha', week);
  const codeB = await saveProfile(b, 'Ravi', { ...week, steps: 3000, points: 9 });
  console.log('codes:', codeA, codeB);
  console.log('B adds A:', await addFriend(b, codeA));
  console.log('B board:', (await fetchBoard(b, '2026-11-09')).map((r) => `${r.name}${r.isMe ? '*' : ''}=${r.points}`).join(', '));
  console.log('A board:', (await fetchBoard(a, '2026-11-09')).map((r) => `${r.name}${r.isMe ? '*' : ''}=${r.points}`).join(', '));
  await sharePlan(a, { '2026-11-12': { lunch: [{ recipeId: 'poha', servings: 1 }] } });
  console.log('B sees A plan days:', (await fetchFriendPlans(b)).map((p) => `${p.name}:${Object.keys(p.plan).join(',')}`).join(' | '));
  await addFriend(b, 'ZZZZZZZZ').catch((e) => console.log('wrong code ->', e.message));
})();
