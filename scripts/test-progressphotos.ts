import assert from 'node:assert/strict';
import { comparePair, newestFirst, nearestWeight, photoFileName } from '../src/lib/progressPhotos';

const ph = (id: string, date: string) => ({ id, date, uri: `file:///${id}.jpg` });

assert.deepEqual(newestFirst([ph('a', '2026-01-01'), ph('c', '2026-03-01'), ph('b', '2026-02-01')]).map((p) => p.id), ['c', 'b', 'a']);
assert.deepEqual(newestFirst([ph('a', '2026-01-01'), ph('b', '2026-01-01')]).map((p) => p.id), ['b', 'a'], 'same day: stable order');
assert.deepEqual(newestFirst([]), []);

const pair = comparePair([ph('b', '2026-02-01'), ph('a', '2026-01-01'), ph('c', '2026-03-01')])!;
assert.equal(pair.before.id, 'a');
assert.equal(pair.after.id, 'c');
assert.equal(pair.days, 59);
assert.equal(comparePair([ph('a', '2026-01-01')]), null, 'one photo cannot be compared');
assert.equal(comparePair([ph('a', '2026-01-01'), ph('b', '2026-01-01')]), null, 'two photos on the same day are not a before/after');
assert.equal(comparePair([]), null);
assert.equal(comparePair([ph('a', '2026-02-27'), ph('b', '2026-03-01')])!.days, 2, 'across a month boundary');

const w = [{ date: '2026-01-02', kg: 80 }, { date: '2026-01-20', kg: 78 }];
assert.equal(nearestWeight(w, '2026-01-01'), 80);
assert.equal(nearestWeight(w, '2026-01-19'), 78);
assert.equal(nearestWeight(w, '2026-01-10'), null, 'nothing within a week');
assert.equal(nearestWeight(w, '2026-01-10', 10), 80, 'a wider window finds the closer one');
assert.equal(nearestWeight([], '2026-01-01'), null);

assert.equal(photoFileName('17-abc'), 'progress-17-abc.jpg');
assert.equal(photoFileName('../../evil name!'), 'progress-evilname.jpg', 'no path tricks in file names');

console.log('Progress photo tests passed.');
