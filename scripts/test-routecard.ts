import assert from 'node:assert/strict';
import { Fix, routeOf } from '../src/lib/gps';
import { EMPTY_TRACK, addFix } from '../src/lib/gps';
import { base64ToBytes, buildRoute, decodeRoute, encodeRoute, projectRoute, thin } from '../src/lib/routeCard';
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
// ---- the stray line: a stale first fix far from where the walk really starts ----
const stale: Fix = { lat: 12.95, lon: 77.7, t: 0, acc: 10 }; // an old location from somewhere else
const real: Fix[] = Array.from({ length: 40 }, (_, i) => ({ lat: 12.9 + Math.sin(i / 6) * 0.0004, lon: 77.6 + Math.cos(i / 6) * 0.0004, t: 2000 + i * 2000, acc: 6 }));
const fixed = routeOf([stale, ...real], 'walk');
let tk = EMPTY_TRACK;
for (const f of [stale, ...real]) tk = addFix(tk, f, 'walk');
assert.ok(tk.meters < 400, 'the jump from the stale point is not counted as distance, got ' + tk.meters);
const drawn = buildRoute(fixed);
assert.equal(drawn.length, 1, 'the stale point is a separate stretch of one point and is dropped');
assert.ok(drawn[0].every((p) => Math.abs(p.lat - 12.9) < 0.001), 'no point is left near the stale location');
// a pause longer than 90 seconds splits the route: no straight line across the gap
const gap = buildRoute([...fixes.slice(0, 10), ...fixes.slice(10).map((f) => ({ ...f, t: f.t + 300_000 }))]);
assert.equal(gap.length, 2);
// one point that wanders off and comes straight back is a spike and is removed
const spiky: Fix[] = fixes.slice(0, 12).map((f) => ({ ...f }));
spiky[6] = { ...spiky[6], lat: spiky[6].lat + 0.002 }; // about 220 m off
assert.equal(buildRoute(spiky)[0].length, 11);
assert.ok(buildRoute(fixes.slice(0, 1)).length === 0 && buildRoute([]).length === 0);
// ---- the short text form ----
const rt = decodeRoute(encodeRoute(drawn));
assert.equal(rt.length, 1);
assert.equal(rt[0].length, drawn[0].length);
assert.ok(Math.abs(rt[0][5].lat - drawn[0][5].lat) < 1e-5 && Math.abs(rt[0][5].lon - drawn[0][5].lon) < 1e-5);
assert.equal(decodeRoute(encodeRoute(gap)).length, 2, 'stretches survive');
assert.deepEqual(decodeRoute('!!!!'), [], 'garbage is ignored');
assert.deepEqual(decodeRoute(''), []);
assert.ok(encodeRoute(drawn).length < drawn[0].length * 12, 'compact');
console.log('Route card and movement tests passed.');

// ---- the link to the website card ----
import { parseStoryHash, routeOfStory, storyUrl, SITE } from '../src/lib/routeShare';
const data = { kind: 'RUN', date: '14 Nov', km: '6.09', distanceLabel: 'DISTANCE · KM', paceLabel: 'Pace', pace: '5:55 /min', timeLabel: 'समय', time: '36:07', footer: 'MOVED WITH KABE', route: encodeRoute(drawn) };
const url = storyUrl(data);
assert.ok(url.startsWith(SITE + '/route#'));
assert.ok(url.length < 2500, 'the link stays short, got ' + url.length);
assert.deepEqual(parseStoryHash(url.slice(url.indexOf('#'))), data, 'the card survives the trip, including non-English text');
assert.equal(routeOfStory(parseStoryHash(url.slice(url.indexOf('#')))!).length, 1);
assert.equal(parseStoryHash('#nonsense'), null);
assert.equal(parseStoryHash(''), null);
console.log('Route link tests passed.');
