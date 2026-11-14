import assert from 'node:assert/strict';
import { stepDetector } from '../src/lib/webSteps';

// walking: about 2 steps a second, the phone feels gravity plus a 2 m/s² bounce, read 60 times a second
const run = (seconds: number, hz: number, amp: number, noise = 0.05) => {
  const d = stepDetector();
  let n = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const t = (i / 60) * 1000;
    const bounce = amp * Math.sin(2 * Math.PI * hz * (i / 60));
    n += d.push(0.3, 0.2, 9.81 + bounce + (Math.random() - 0.5) * noise, t);
  }
  return n;
};
const walk = run(20, 2, 2.2); // 40 real steps
assert.ok(walk >= 34 && walk <= 44, `walking counted ${walk} of 40`);
const slow = run(20, 1.5, 1.8); // 30 real steps
assert.ok(slow >= 25 && slow <= 33, `slow walking counted ${slow} of 30`);
assert.equal(run(20, 2, 0, 0.1), 0, 'a phone lying still counts nothing');
assert.ok(run(20, 0.3, 0.8) === 0, 'gentle swaying is not walking');
assert.ok(run(20, 9, 3) <= 20 * 3.6, 'shaking is capped by the minimum gap between steps');
assert.equal(stepDetector().push(NaN, 0, 0, 0), 0, 'bad readings are ignored');
console.log('Web step tests passed.');
