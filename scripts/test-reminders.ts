import assert from 'node:assert/strict';
import { cleanRemind, mergeSchedule, stepRemind, upcomingItems } from '../src/lib/itemReminders';
import { DEFAULT_REMINDERS, MAX_SCHEDULED, REMINDER_IDS, formatTime, plan, sanitizeReminders, stepTime, upcoming } from '../src/lib/reminders';

// ---- defaults: everything off, so nothing is ever scheduled until the person asks ----
assert.deepEqual(plan(DEFAULT_REMINDERS), []);
assert.ok(REMINDER_IDS.every((id) => DEFAULT_REMINDERS[id].on === false));

// ---- cleaning ----
assert.deepEqual(sanitizeReminders(null), DEFAULT_REMINDERS);
assert.deepEqual(sanitizeReminders('x'), DEFAULT_REMINDERS);
const messy = sanitizeReminders({ logFood: { on: true, hour: 25, minute: 7 }, water: { on: 'yes', hour: 1.5 }, bogus: { on: true } });
assert.equal(messy.logFood.on, true);
assert.equal(messy.logFood.hour, 20, 'an impossible hour falls back to the default');
assert.equal(messy.logFood.minute, 7);
assert.equal(messy.water.on, false, 'only a real true turns a reminder on');
assert.equal(messy.water.hour, 10);
assert.deepEqual(Object.keys(messy).sort(), [...REMINDER_IDS].sort());

// ---- moving times ----
assert.deepEqual(stepTime({ on: true, hour: 20, minute: 30 }, 30), { on: true, hour: 21, minute: 0 });
assert.deepEqual(stepTime({ on: true, hour: 20, minute: 30 }, -30), { on: true, hour: 20, minute: 0 });
assert.deepEqual(stepTime({ on: true, hour: 23, minute: 45 }, 30), { on: true, hour: 0, minute: 15 }, 'wraps past midnight');
assert.deepEqual(stepTime({ on: true, hour: 0, minute: 10 }, -30), { on: true, hour: 23, minute: 40 }, 'wraps before midnight');
assert.deepEqual(stepTime({ on: false, hour: 8, minute: 0 }, 1440), { on: false, hour: 8, minute: 0 });
assert.equal(formatTime(8, 5), '08:05');
assert.equal(formatTime(20, 30), '20:30');

// ---- the schedule ----
const all = sanitizeReminders({ water: { on: true }, logFood: { on: true, hour: 21, minute: 15 }, checkin: { on: true }, weigh: { on: true } });
const slots = plan(all);
assert.equal(slots.length, 4 + 1 + 1 + 1);
assert.deepEqual(slots.filter((s) => s.id === 'water').map((s) => s.hour), [10, 13, 16, 19]);
assert.deepEqual(slots.find((s) => s.id === 'logFood'), { key: 'logFood', id: 'logFood', hour: 21, minute: 15 });
assert.equal(slots.find((s) => s.id === 'weigh')!.weekday, 1, 'weigh-in is weekly, on Sunday');
assert.equal(slots.find((s) => s.id === 'checkin')!.weekday, undefined, 'the others are daily');
assert.equal(new Set(slots.map((s) => s.key)).size, slots.length, 'every slot has its own key');
assert.deepEqual(plan(sanitizeReminders({ checkin: { on: true } })).map((s) => s.id), ['checkin']);

// ---- the smart schedule ----
const none = { logFood: false, checkin: false, weigh: false, water: false };
const evening = sanitizeReminders({ logFood: { on: true, hour: 20, minute: 30 } });
const at = (d: Date) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
// Friday 6 Nov 2026, 18:00
const now = new Date(2026, 10, 6, 18, 0);
assert.deepEqual(upcoming(DEFAULT_REMINDERS, now, none), [], 'everything off: nothing scheduled');
const a = upcoming(evening, now, none);
assert.equal(a.length, 7, 'seven evenings');
assert.equal(at(a[0].at), '6 20:30', 'tonight is included while it is still ahead');
assert.equal(at(a[6].at), '12 20:30');
const b = upcoming(evening, now, { ...none, logFood: true });
assert.equal(b.length, 6, 'food already logged today: tonight is skipped');
assert.equal(at(b[0].at), '7 20:30', 'but tomorrow still reminds');
assert.equal(upcoming(evening, new Date(2026, 10, 6, 21, 0), none).length, 6, 'past times are dropped');
const wk = sanitizeReminders({ weigh: { on: true, hour: 8, minute: 30 } });
const w = upcoming(wk, now, none, 14);
assert.deepEqual(w.map((x) => at(x.at)), ['8 8:30', '15 8:30'], 'the weigh-in is Sundays only');
assert.equal(upcoming(wk, new Date(2026, 10, 8, 7, 0), { ...none, weigh: true }).length, 0, 'weighed already this Sunday: skipped for 7 days');
const wat = upcoming(sanitizeReminders({ water: { on: true } }), now, { ...none, water: true });
assert.equal(wat.filter((x) => x.at.getDate() === 6).length, 0, 'water goal reached: no more water reminders today');
assert.ok(wat.filter((x) => x.at.getDate() === 7).length === 4, 'four tomorrow');
const everything = sanitizeReminders({ water: { on: true }, logFood: { on: true }, checkin: { on: true }, weigh: { on: true } });
const many = upcoming(everything, now, none, 30);
assert.ok(many.length <= MAX_SCHEDULED, 'never more than the phone allows');
assert.deepEqual([...many].sort((x, y) => x.at.getTime() - y.at.getTime()), many, 'in time order');
assert.equal(new Set(many.map((x) => x.key)).size, many.length, 'unique keys');
assert.equal(upcoming(evening, new Date(2026, 11, 29, 9, 0), none)[3].at.getFullYear(), 2027, 'across the new year');

// ---- habits and supplements ----
assert.deepEqual(cleanRemind({ hour: 8, minute: 30 }), { hour: 8, minute: 30 });
assert.equal(cleanRemind({ hour: 24, minute: 0 }), undefined);
assert.equal(cleanRemind({ hour: 8 }), undefined);
assert.equal(cleanRemind('x'), undefined);
assert.equal(cleanRemind(null), undefined);
assert.deepEqual(stepRemind({ hour: 23, minute: 50 }, 20), { hour: 0, minute: 10 }, 'wraps past midnight');
assert.deepEqual(stepRemind({ hour: 0, minute: 5 }, -10), { hour: 23, minute: 55 });
const now8 = new Date(2026, 10, 10, 8, 0);
const items = [
  { id: 'a', name: 'Vitamin D', remind: { hour: 9, minute: 0 } },
  { id: 'b', name: 'Stretch', remind: { hour: 7, minute: 0 } },
  { id: 'c', name: 'No reminder' },
  { id: 'd', name: 'Broken', remind: { hour: 99, minute: 0 } as never },
];
const ups = upcomingItems(items, 'supplement', now8, [], 3);
assert.deepEqual([...new Set(ups.map((u) => u.id))].sort(), ['a', 'b'], 'only items with a valid time');
assert.equal(ups.length, 5, "today's 07:00 has passed (Stretch starts tomorrow); today 09:00 is still ahead");
assert.equal(ups[0].name, 'Vitamin D');
assert.equal(ups[0].at.getHours(), 9);
assert.deepEqual(upcomingItems(items, 'habit', now8, ['a'], 1).map((u) => u.id), [], 'done today: skipped (Stretch is past, Vitamin D is done)');
assert.equal(upcomingItems(items, 'habit', now8, ['a'], 2).length, 2, 'done today does not stop tomorrow');
assert.equal(new Set(ups.map((u) => u.key)).size, ups.length, 'unique keys');
const merged = mergeSchedule([{ at: new Date(2026, 10, 10, 20, 0), x: 1 }], upcomingItems(items, 'habit', now8, [], 7), 4);
assert.equal(merged.length, 4, 'respects the phone limit');
assert.ok(merged.every((m, i, a) => i === 0 || a[i - 1].at.getTime() <= m.at.getTime()), 'earliest first');

console.log('Reminder tests passed.');
