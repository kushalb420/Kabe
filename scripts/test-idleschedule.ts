import assert from 'node:assert/strict';
import { idleTimes, movedEnough } from '../src/lib/idleSchedule';

const at = (h: number, m = 0) => new Date(2026, 10, 11, h, m, 0, 0).getTime();
const hours = (d: Date[]) => d.map((x) => `${x.getHours()}:${String(x.getMinutes()).padStart(2, '0')}`);

// active at 10:00, nudge after 60 min, awake 9-21: 11:00, 12:00, 13:00
assert.deepEqual(hours(idleTimes({ now: at(10), lastActiveAt: at(10), afterMin: 60, from: 9, to: 21 })), ['11:00', '12:00', '13:00']);
// a different gap and count
assert.deepEqual(hours(idleTimes({ now: at(10), lastActiveAt: at(10), afterMin: 90, from: 9, to: 21, max: 2 })), ['11:30', '13:00']);
// nothing is ever scheduled in the past: you were last active long ago, it is 14:20 now
assert.deepEqual(hours(idleTimes({ now: at(14, 20), lastActiveAt: at(10), afterMin: 60, from: 9, to: 21 })), ['15:00', '16:00', '17:00']);
// only inside waking hours: last active 19:30 -> 20:30 fits, 21:30 and later do not, next day is out of range (48 slots cover it but 9:xx comes later)
const late = hours(idleTimes({ now: at(19, 30), lastActiveAt: at(19, 30), afterMin: 60, from: 9, to: 21 }));
assert.equal(late[0], '20:30');
assert.ok(!late.includes('21:30') && !late.includes('22:30'));
// before the waking window opens: the first slot is the one inside it
assert.deepEqual(hours(idleTimes({ now: at(6), lastActiveAt: at(6), afterMin: 60, from: 9, to: 21, max: 1 })), ['9:00']);
// the minimum gap is 10 minutes, whatever is asked
assert.deepEqual(hours(idleTimes({ now: at(10), lastActiveAt: at(10), afterMin: 1, from: 9, to: 21, max: 2 })), ['10:10', '10:20']);

assert.equal(movedEnough(120, 60), true);
assert.equal(movedEnough(20, 60), false);
assert.equal(movedEnough(null, 60), false, 'unknown steps count as not moved');
console.log('Idle schedule tests passed.');
