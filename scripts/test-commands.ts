import assert from 'node:assert/strict';
import { parseCommand } from '../src/lib/commands';

const p = (s: string) => parseCommand(s);

// ---- water ----
assert.deepEqual(p('I drank 2 glasses of water'), { type: 'water', ml: 500 });
assert.deepEqual(p('drank a glass of water'), { type: 'water', ml: 250 });
assert.deepEqual(p('had 500 ml water'), { type: 'water', ml: 500 });
assert.deepEqual(p('drank 1.5 litres of water'), { type: 'water', ml: 1500 });
assert.deepEqual(p('half a litre of water'), { type: 'water', ml: 500 });
assert.deepEqual(p('two bottles of water.'), { type: 'water', ml: 1000 });
assert.deepEqual(p('I just drank water'), { type: 'water', ml: 250 });
assert.deepEqual(p('1,5 l water'), { type: 'water', ml: 1500 }, 'decimal comma');
assert.equal(p('had watermelon'), null, 'watermelon is food');
assert.equal(p('a glass of coconut water'), null, 'coconut water is a drink to log as food');
assert.equal(p('drank 100 litres of water'), null, 'absurd amounts are not commands');
assert.equal(p('2 glasses of lassi'), null);

// ---- weight ----
assert.deepEqual(p('I weigh 72.5 kg'), { type: 'weight', kg: 72.5 });
assert.deepEqual(p('weighed 68 today'), { type: 'weight', kg: 68 });
assert.deepEqual(p('my weight is 81.2'), { type: 'weight', kg: 81.2 });
assert.deepEqual(p('I am 70 kilos'), { type: 'weight', kg: 70 });
assert.equal(p('I am 30'), null, 'a bare number after "I am" is not a weight');
assert.equal(p('I weigh 5 kg'), null);
assert.equal(p('I weigh 700 kg'), null);

// ---- activity ----
assert.deepEqual(p('walked 30 minutes'), { type: 'activity', kind: 'walk', minutes: 30, assumedPace: false });
assert.deepEqual(p('I ran 5 km in 28 minutes'), { type: 'activity', kind: 'run', minutes: 28, km: 5, assumedPace: false });
assert.deepEqual(p('cycled for 1.5 hours'), { type: 'activity', kind: 'cycle', minutes: 90, assumedPace: false });
assert.deepEqual(p('walked 3 km'), { type: 'activity', kind: 'walk', minutes: 36, km: 3, assumedPace: true }, 'time is estimated from a typical pace and flagged');
assert.deepEqual(p('went for a run, 10 km'), { type: 'activity', kind: 'run', minutes: 67, km: 10, assumedPace: true });
assert.equal(p('walked'), null, 'no amount, no command');
assert.equal(p('ran 5000 minutes'), null);
assert.equal(p('walked 300 km'), null);

// ---- meals are not commands ----
assert.equal(p('I had two rotis with dal and a glass of lassi for lunch'), null);
assert.equal(p('2 idli and sambar'), null);
assert.equal(p(''), null);
assert.equal(p('   '), null);

console.log('Command tests passed.');
