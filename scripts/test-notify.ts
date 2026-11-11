import assert from 'node:assert/strict';
import { DEFAULT_PREFS, NotifPrefs, capSchedule, liveSnoozes, sanitizeCustom, sanitizePrefs, shouldNudgeIdle, snoozeAt, upcomingCustom, withFollowUps } from '../src/lib/notify';

// ---- preferences ----
assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
assert.deepEqual(sanitizePrefs({}), DEFAULT_PREFS);
const p = sanitizePrefs({ repeatEveryMin: 45, repeatTimes: 99, snoozeMin: 15, allOn: false, idle: { on: true, afterMin: 90, from: 8, to: 22, minSteps: 100 } });
assert.equal(p.repeatEveryMin, 45);
assert.equal(p.repeatTimes, DEFAULT_PREFS.repeatTimes, 'out of range falls back');
assert.equal(p.snoozeMin, 15);
assert.equal(p.allOn, false);
assert.deepEqual(p.idle, { on: true, afterMin: 90, from: 8, to: 22, minSteps: 100 });
assert.deepEqual(sanitizePrefs({ idle: { on: true, from: 20, to: 10 } }).idle.from, DEFAULT_PREFS.idle.from, 'a window that ends before it starts is reset');
assert.equal(sanitizePrefs({ repeatUntilDone: false }).repeatUntilDone, false);
assert.equal(sanitizePrefs({ repeatUntilDone: 'no' }).repeatUntilDone, true, 'only a real false turns it off');

// ---- own reminders ----
const list = sanitizeCustom([
  { id: 'a', title: '  Drink   warm water ', hour: 7, minute: 30, days: [3, 1, 1, 9, 'x'], on: true },
  { id: 'b', title: '', hour: 8, minute: 0, days: [] },
  { id: 'c', title: 'Bad time', hour: 25, minute: 0, days: [] },
  { id: 'a', title: 'Duplicate id', hour: 9, minute: 0, days: [] },
  { id: 'd', title: 'Off one', hour: 18, minute: 0, days: [], on: false },
  null,
]);
assert.deepEqual(list.map((r) => r.id), ['a', 'd']);
assert.equal(list[0].title, 'Drink warm water');
assert.deepEqual(list[0].days, [1, 3], 'days are checked, sorted and unique');
assert.equal(list[1].on, false);
assert.deepEqual(sanitizeCustom('x'), []);
assert.equal(sanitizeCustom(Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, title: 't', hour: 1, minute: 0, days: [] }))).length, 30, 'a sensible maximum');

// 2026-11-10 is a Tuesday (2)
const now = new Date(2026, 10, 10, 8, 0);
const ups = upcomingCustom(list, now, [], 9);
assert.ok(ups.every((u) => u.id === 'a'), 'switched-off reminders never schedule');
assert.deepEqual(ups.map((u) => u.at.getDay()), [3, 1, 3], 'only Mon and Wed, and the first Wednesday is tomorrow');
assert.equal(ups[0].kind, 'custom');
assert.equal(ups[0].name, 'Drink warm water');
const daily = sanitizeCustom([{ id: 'x', title: 'Stretch', hour: 9, minute: 0, days: [] }]);
assert.equal(upcomingCustom(daily, now, [], 3).length, 3, 'no days means every day');
assert.equal(upcomingCustom(daily, now, ['x'], 3).length, 2, "done today skips today's time");
assert.equal(upcomingCustom(daily, new Date(2026, 10, 10, 9, 30), [], 1).length, 0, 'a time that has passed is not scheduled');

// ---- follow-ups until done ----
const base = upcomingCustom(daily, now, [], 1); // Tuesday 09:00
const prefs: NotifPrefs = { ...DEFAULT_PREFS, repeatEveryMin: 30, repeatTimes: 3 };
const withF = withFollowUps(base, prefs, now, { habit: [], supplement: [], custom: [] });
assert.deepEqual(withF.map((x) => [x.at.getHours(), x.at.getMinutes(), x.followUp]), [[9, 0, 0], [9, 30, 1], [10, 0, 2], [10, 30, 3]]);
assert.equal(new Set(withF.map((x) => x.key)).size, 4, 'unique keys');
assert.equal(withFollowUps(base, { ...prefs, repeatUntilDone: false }, now, { habit: [], supplement: [], custom: [] }).length, 1, 'switched off: just the reminder');
assert.equal(withFollowUps(base, prefs, now, { habit: [], supplement: [], custom: ['x'] }).length, 1, 'done today: no follow-ups (the reminder itself is dropped by the schedule)');
const late = upcomingCustom([{ id: 'l', title: 'Late', hour: 23, minute: 45, days: [], on: true }], now, [], 1);
assert.deepEqual(withFollowUps(late, prefs, now, { habit: [], supplement: [], custom: [] }).map((x) => x.followUp), [0], 'follow-ups never run past midnight');
const tomorrowBase = upcomingCustom(daily, now, [], 2).slice(1);
assert.equal(withFollowUps(tomorrowBase, prefs, now, { habit: [], supplement: [], custom: ['x'] }).length, 4, "today's Done does not silence tomorrow");

// ---- snooze ----
assert.equal(snoozeAt(now, { ...DEFAULT_PREFS, snoozeMin: 15 }).getTime() - now.getTime(), 15 * 60_000);
const sn = [
  { key: 'a', at: now.getTime() + 60_000, title: 't', body: 'b', data: { kind: 'habit', id: '1', date: '2026-11-10' } },
  { key: 'b', at: now.getTime() - 60_000, title: 't', body: 'b', data: { kind: 'habit', id: '1', date: '2026-11-10' } },
];
assert.deepEqual(liveSnoozes(sn, now).map((s) => s.key), ['a'], 'past snoozes are dropped');
assert.equal(capSchedule(withF, 2).length, 2);

// ---- idle ----
const idlePrefs = sanitizePrefs({ idle: { on: true, afterMin: 60, from: 9, to: 21, minSteps: 60 } });
const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m);
const base2 = { prefs: idlePrefs, lastNudgeAt: null as number | null };
assert.equal(shouldNudgeIdle({ ...base2, now: at(11), stepsInWindow: 10 }), true, 'still for an hour');
assert.equal(shouldNudgeIdle({ ...base2, now: at(11), stepsInWindow: 500 }), false, 'moving');
assert.equal(shouldNudgeIdle({ ...base2, now: at(11), stepsInWindow: null }), false, 'unknown steps never trigger it');
assert.equal(shouldNudgeIdle({ ...base2, now: at(8, 30), stepsInWindow: 0 }), false, 'before waking hours');
assert.equal(shouldNudgeIdle({ ...base2, now: at(21, 5), stepsInWindow: 0 }), false, 'after waking hours');
assert.equal(shouldNudgeIdle({ ...base2, now: at(9, 30), stepsInWindow: 0 }), false, 'the window must start inside waking hours');
assert.equal(shouldNudgeIdle({ ...base2, now: at(10, 0), stepsInWindow: 0 }), true, 'an hour after the window opens');
assert.equal(shouldNudgeIdle({ ...base2, now: at(12), stepsInWindow: 0, lastNudgeAt: at(11, 30).getTime() }), false, 'not again within the window');
assert.equal(shouldNudgeIdle({ ...base2, now: at(12), stepsInWindow: 0, lastNudgeAt: at(10, 30).getTime() }), true);
assert.equal(shouldNudgeIdle({ prefs: { ...idlePrefs, idle: { ...idlePrefs.idle, on: false } }, now: at(11), stepsInWindow: 0, lastNudgeAt: null }), false, 'off');
assert.equal(shouldNudgeIdle({ prefs: { ...idlePrefs, allOn: false }, now: at(11), stepsInWindow: 0, lastNudgeAt: null }), false, 'all notifications off');

console.log('Notification tests passed.');
