import assert from 'node:assert/strict';
import { Fix, routeOf } from '../src/lib/gps';
import { base64ToBytes, projectRoute, thin } from '../src/lib/routeCard';
import { lastMovement } from '../src/lib/idleSchedule';

// a walk north-east: about 15 m every 10 s
const fixes: Fix[] = Array.from({ length: 30 }, (_, i) => ({ lat: 12.9 + i * 0.0001, lon: 77.6 + i * 0.0001, t: i * 10_000, acc: 5 }));
const route = routeOf(fixes, 'walk');
assert.equal(route.length, 30);
// a GPS jump and a bad fix are left out of the drawn route
const noisy: Fix[] = [...fixes.slice(0, 5), { lat: 13.5, lon: 78.2, t: 51_000, acc: 5 }, { lat: 12.9005, lon: 77.6005, t: 52_000, acc: 200 }, ...fixes.slice(5)];
assert.equal(routeOf(noisy, 'walk').length, 30);
// standing still adds nothing
assert.equal(routeOf([fixes[0], { ...fixes[0], t: 20_000 }], 'walk').length, 1);

const p = projectRoute(route, 300, 200, 10)!;
assert.ok(p && p.path.startsWith('M'));
assert.ok(p.start.x < p.end.x, 'north-east: the end is to the right');
assert.ok(p.start.y > p.end.y, 'north is up: the end is higher on the screen');
for (const q of [p.start, p.end]) assert.ok(q.x >= 10 && q.x <= 290 && q.y >= 10 && q.y <= 190, 'inside the padding');
assert.equal(projectRoute(route.slice(0, 1), 300, 200), null, 'one point is not a route');
assert.equal(projectRoute([fixes[0], { ...fixes[0], lon: fixes[0].lon + 0.00001 }], 300, 200), null, 'a one metre move is not drawn');
assert.equal(thin([1, 2, 3], 10).length, 3);
const big = Array.from({ length: 5000 }, (_, i) => i);
const t = thin(big, 400);
assert.equal(t.length, 400);
assert.equal(t[0], 0);
assert.equal(t[399], 4999);

// ---- the idle reminder starts counting from the last real walking ----
const min = (m: number) => m * 60_000;
assert.equal(lastMovement([]), null);
assert.equal(lastMovement([{ start: 0, end: min(10), count: 10 }]), null, 'a few steps (a trip to the kettle) is not walking');
const walk = [{ start: 0, end: min(5), count: 40 }, { start: min(5), end: min(10), count: 60 }, { start: min(10), end: min(15), count: 80 }];
assert.equal(lastMovement(walk), min(15), 'the walk ended at minute 15');
// a long record with plenty of steps counts, the late small one on its own does not
assert.equal(lastMovement([{ start: 0, end: min(60), count: 500 }, { start: min(100), end: min(101), count: 5 }]), min(60));
assert.deepEqual([...base64ToBytes('SGVsbG8=')], [72, 101, 108, 108, 111], 'Hello');
assert.deepEqual([...base64ToBytes('SGk')], [72, 105], 'no padding');
assert.deepEqual([...base64ToBytes('data:x')].length > 0, true);
console.log('Route card and movement tests passed.');
