import assert from 'node:assert/strict';
import { addFriend, cleanName, fetchBoard, fetchMyProfile, friendsOf, normalizeCode, pointsOf, rank, removeFriend, sanitizeBoard, saveProfile, weeklyTotals, type SocialClient } from '../src/lib/social';

// ---- names and codes ----
assert.equal(cleanName('  Asha   K  '), 'Asha K');
assert.equal(cleanName('a\nb\tc'), 'a b c');
assert.equal(cleanName('   '), null);
assert.equal(cleanName('x'.repeat(40))!.length, 30);
assert.equal(cleanName('ఆశా'), 'ఆశా', 'native script names are fine');
assert.equal(normalizeCode(' ab12-cd34 '), 'AB12CD34');
assert.equal(normalizeCode('short'), null);
assert.equal(normalizeCode('ABCDEFGHI'), null);

// ---- points and weekly totals (2026-11-09 is a Monday) ----
assert.equal(pointsOf({ steps: 12_400, activeMinutes: 95, loggedDays: 4 }), 12 + 9 + 20);
assert.equal(pointsOf({ steps: 999, activeMinutes: 9, loggedDays: 0 }), 0);
const t = weeklyTotals(
  '2026-11-11',
  { '2026-11-08': 9000, '2026-11-09': 5000, '2026-11-10': 7000, '2026-11-12': 4000, 'bad': 100, '2026-11-11': -5 },
  [{ date: '2026-11-09', minutes: 30 }, { date: '2026-11-07', minutes: 60 }, { date: '2026-11-11', minutes: 25 }],
  ['2026-11-09', '2026-11-09', '2026-11-10', '2026-11-06'],
);
assert.equal(t.week, '2026-11-09');
assert.equal(t.steps, 12000, 'only Monday to today; the day before the week and future days are left out');
assert.equal(t.activeMinutes, 55);
assert.equal(t.loggedDays, 2, 'a day counts once');
assert.equal(t.points, 12 + 5 + 10);
assert.equal(weeklyTotals('2026-11-15', {}, [], []).points, 0);
assert.equal(weeklyTotals('2026-11-15', {}, [], []).week, '2026-11-09', 'Sunday belongs to the week that started Monday');

// ---- ranking ----
const row = (name: string, points: number, isMe = false) => ({ userId: name, name, isMe, steps: points * 1000, activeMinutes: 0, loggedDays: 0, points });
const ranked = rank([row('Ravi', 10), row('Asha', 30), row('Me', 10, true), row('Zed', 0)], 'points');
assert.deepEqual(ranked.map((r) => [r.name, r.rank]), [['Asha', 1], ['Me', 2], ['Ravi', 2], ['Zed', 4]], 'ties share a rank, then name order');
assert.deepEqual(rank([], 'steps'), []);

// ---- server rows are checked ----
const rows = sanitizeBoard([
  { user_id: 'u1', display_name: ' Asha ', steps: 5000.4, active_minutes: 20, logged_days: 3, points: 28, is_me: true },
  { user_id: 'u2', display_name: '', steps: 1 },
  { display_name: 'x' },
  { user_id: 'u3', display_name: 'Ravi', steps: -4, active_minutes: 'many', logged_days: null, points: NaN, is_me: 'yes' },
  null,
]);
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { userId: 'u1', name: 'Asha', isMe: true, steps: 5000, activeMinutes: 20, loggedDays: 3, points: 28 });
assert.deepEqual(rows[1], { userId: 'u3', name: 'Ravi', isMe: false, steps: 0, activeMinutes: 0, loggedDays: 0, points: 0 });
assert.deepEqual(sanitizeBoard('nope'), []);

// ---- the server calls, with a fake client ----
const calls: [string, Record<string, unknown> | undefined][] = [];
const fake = (reply: (fn: string) => { data?: unknown; error?: { message?: string; code?: string } | null }): SocialClient => ({
  rpc: async (fn, args) => {
    calls.push([fn, args]);
    const r = reply(fn);
    return { data: r.data ?? null, error: r.error ?? null };
  },
});
const week = { week: '2026-11-09', steps: 100, activeMinutes: 20, loggedDays: 2, points: 12 };
(async () => {
  assert.equal(await saveProfile(fake(() => ({ data: 'ab12cd34' })), '  Asha ', week), 'AB12CD34');
  assert.deepEqual(calls[0], ['kabe_save_profile', { p_name: 'Asha', p_week: '2026-11-09', p_steps: 100, p_minutes: 20, p_days: 2, p_points: 12 }]);
  await assert.rejects(saveProfile(fake(() => ({ data: 'x' })), '   ', week), /name/);
  await assert.rejects(saveProfile(fake(() => ({ data: 12 })), 'A', week), /Something went wrong/, 'a strange reply is not trusted');
  assert.equal((await fetchBoard(fake(() => ({ data: [{ user_id: 'u', display_name: 'A', points: 3 }] })), '2026-11-09')).length, 1);
  assert.equal(calls[calls.length - 1][1]!.p_week, '2026-11-09');
  assert.equal(await addFriend(fake(() => ({ data: 'Ravi' })), 'ab12-cd34'), 'Ravi');
  assert.deepEqual(calls[calls.length - 1], ['kabe_add_friend', { p_code: 'AB12CD34' }]);
  await assert.rejects(addFriend(fake(() => ({})), 'abc'), /8 letters/);
  await assert.rejects(addFriend(fake(() => ({ error: { message: 'check the code' } })), 'ABCD1234'), /Check the code/);
  await assert.rejects(addFriend(fake(() => ({ error: { message: 'that is your own code' } })), 'ABCD1234'), /your own code/);
  await assert.rejects(addFriend(fake(() => ({ error: { code: 'PGRST202', message: 'Could not find the function public.kabe_add_friend' } })), 'ABCD1234'), /updated setup SQL/);
  await assert.rejects(addFriend(fake(() => ({ error: { message: 'boom 500' } })), 'ABCD1234'), /Something went wrong/);
  await removeFriend(fake(() => ({})), 'u9');
  assert.deepEqual(calls[calls.length - 1], ['kabe_remove_friend', { p_friend: 'u9' }]);
  assert.deepEqual(await fetchMyProfile(fake(() => ({ data: [{ display_name: ' Asha ', friend_code: 'ab12cd34' }] }))), { name: 'Asha', code: 'AB12CD34' });
  assert.equal(await fetchMyProfile(fake(() => ({ data: [] }))), null, 'no profile yet');
  assert.equal(await fetchMyProfile(fake(() => ({ data: [{ display_name: 'A', friend_code: 'bad' }] }))), null, 'a broken code is not trusted');
  assert.deepEqual(friendsOf([row('Me', 50, true), row('Ravi', 10), row('Asha', 30)], 'points').map((r) => r.name), ['Asha', 'Ravi'], 'friends only, best first');
  console.log('Social tests passed.');
})();
