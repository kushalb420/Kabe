import assert from 'node:assert/strict';
import { CARD_IDS, DEFAULT_LAYOUT, isDefault, move, sanitizeLayout, toggleHidden, visibleOrder } from '../src/lib/dashboard';

assert.equal(new Set(CARD_IDS).size, CARD_IDS.length, 'no duplicate card ids');
assert.deepEqual([...DEFAULT_LAYOUT.order].sort(), [...CARD_IDS].sort(), 'the default order holds every card once');
assert.equal(DEFAULT_LAYOUT.order[0], 'logFood', 'logging comes first');
assert.deepEqual(visibleOrder(DEFAULT_LAYOUT), DEFAULT_LAYOUT.order);
// cards from older versions (streak, insights, extras) are simply dropped, and the rest keep their order
const old = sanitizeLayout({ order: ['macros', 'extras', 'streak', 'kitchen', 'insights', 'logFood'], hidden: ['streak', 'kitchen', 'water'] });
assert.deepEqual(old.order.slice(0, 2), ['macros', 'logFood']);
assert.deepEqual(old.hidden, ['water'], 'hidden ids that no longer exist are dropped');
assert.ok(!old.order.includes('streak' as never));
assert.deepEqual(sanitizeLayout(null), DEFAULT_LAYOUT);
assert.deepEqual(sanitizeLayout('x'), DEFAULT_LAYOUT);
const messy = sanitizeLayout({ order: ['water', 'bogus', 'water', 'macros'], hidden: ['meals', 'nope', 'meals', 7] });
assert.deepEqual(messy.order.slice(0, 2), ['water', 'macros'], 'known ids keep their order, repeats and unknown ids are dropped');
assert.equal(messy.order.length, CARD_IDS.length, 'cards missing from the stored order are added back');
assert.equal(new Set(messy.order).size, CARD_IDS.length);
assert.deepEqual(messy.hidden, ['meals']);

// ---- hiding and moving ----
const hid = toggleHidden(DEFAULT_LAYOUT, 'meals');
assert.ok(!visibleOrder(hid).includes('meals'));
assert.equal(visibleOrder(hid).length, CARD_IDS.length - 1);
assert.deepEqual(toggleHidden(hid, 'meals'), DEFAULT_LAYOUT, 'toggling twice restores it');
assert.equal(isDefault(hid), false);

const up = move(DEFAULT_LAYOUT, 'water', -1);
assert.deepEqual(up.order.slice(0, 3), ['logFood', 'water', 'macros']);
const down = move(DEFAULT_LAYOUT, 'logFood', 1);
assert.deepEqual(down.order.slice(0, 2), ['macros', 'logFood']);
assert.equal(move(DEFAULT_LAYOUT, 'logFood', -1), DEFAULT_LAYOUT, 'the first card cannot go up');
assert.equal(move(DEFAULT_LAYOUT, 'extras', 1), DEFAULT_LAYOUT, 'the last card cannot go down');
assert.equal(isDefault(up), false);
assert.equal(move(hid, 'macros', 1).hidden.length, 1, 'hidden cards stay hidden while others move');
assert.deepEqual([...up.order].sort(), [...CARD_IDS].sort(), 'moving never loses a card');

// ---- everything hidden is allowed (the calorie ring stays) ----
const none = CARD_IDS.reduce((l, id) => toggleHidden(l, id), DEFAULT_LAYOUT);
assert.deepEqual(visibleOrder(none), []);

console.log('Dashboard tests passed.');
