import assert from 'node:assert/strict';
import { addDays, defaultWaterGoal, streak, toggleId, trendSeries, upsertWeight, weeklyChange } from '../src/lib/tracker';

assert.equal(addDays('2026-03-01', -1), '2026-02-28');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');

// upsert replaces the same day and keeps order
let w = upsertWeight([], '2026-01-02', 70);
w = upsertWeight(w, '2026-01-01', 71);
w = upsertWeight(w, '2026-01-02', 69);
assert.deepEqual(w, [{ date: '2026-01-01', kg: 71 }, { date: '2026-01-02', kg: 69 }]);

// trend smooths: avg of both days on day 2
assert.equal(trendSeries(w)[1].avg, 70);

// weekly change: needs both windows
const today = '2026-01-20';
let list = [{ date: '2026-01-19', kg: 70 }, { date: '2026-01-18', kg: 70.2 }];
assert.equal(weeklyChange(list, today), null);
list = [...list, { date: '2026-01-10', kg: 71 }, { date: '2026-01-09', kg: 71.2 }];
const ch = weeklyChange(list, today)!;
assert.ok(Math.abs(ch - (70.1 - 71.1)) < 1e-9, `got ${ch}`);

// streaks
const log = { '2026-01-18': ['a'], '2026-01-19': ['a', 'b'], '2026-01-20': ['b'] };
assert.equal(streak(log, 'a', '2026-01-20'), 2); // today not done yet → counts through yesterday
assert.equal(streak(log, 'b', '2026-01-20'), 2);
assert.equal(streak(log, 'zzz', '2026-01-20'), 0);
assert.equal(streak({ '2026-01-18': ['a'] }, 'a', '2026-01-20'), 0); // gap breaks streak

// toggle
let l = toggleId({}, '2026-01-01', 'x');
assert.deepEqual(l['2026-01-01'], ['x']);
l = toggleId(l, '2026-01-01', 'x');
assert.deepEqual(l['2026-01-01'], []);

assert.equal(defaultWaterGoal(60), 2000);
assert.equal(defaultWaterGoal(40), 1500);
console.log('Tracker tests passed.');
