import assert from 'node:assert/strict';
import { CAFFEINE_LIMIT_MG, caffeineMg, caffeineOnDay } from '../src/lib/caffeine';

assert.equal(caffeineMg('Filter coffee', 250), 100);
assert.equal(caffeineMg('Masala chai', 200), 40);
assert.equal(caffeineMg('Espresso', 30), 63);
assert.equal(caffeineMg('Idli', 200), 0);
assert.equal(caffeineMg('Coffee', -5), 0);
const day = [{ date: 'd1', name: 'Coffee', grams: 250 }, { date: 'd1', name: 'Idli', grams: 100 }, { date: 'd2', name: 'Coffee', grams: 250 }];
assert.equal(caffeineOnDay(day, 'd1'), 100);
assert.ok(CAFFEINE_LIMIT_MG > 0);
console.log('Caffeine tests passed.');
