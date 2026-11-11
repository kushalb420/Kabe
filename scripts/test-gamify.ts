import assert from 'node:assert/strict';
import { Activity } from '../src/lib/activity';
import { BADGES, CHALLENGES, RawData, buildCtx, challengesForWeek, evaluateBadges, evaluateChallenges, levelFor, nudge, streakOf, totalPoints, weekStart } from '../src/lib/gamify';
import { addDays } from '../src/lib/tracker';

const today = '2026-03-11'; // a Wednesday
const days = (...offsets: number[]) => new Set(offsets.map((o) => addDays(today, o)));
const base = (over: Partial<RawData> = {}): RawData => ({
  today, entries: [], goals: { kcal: 2000, protein: 100 }, water: {}, waterGoal: 2500, steps: {}, stepGoal: 8000, workouts: [], activities: [],
  weights: [], goalWeight: null, goalDirection: 'maintain', checkins: {}, restDays: [], plan: {}, pantryCount: 0, ...over,
});
const meal = (offset: number, protein = 20, foodId?: string) => ({ date: addDays(today, offset), kcal: 500, protein, foodId });
const run = (km: number, minutes: number, offset = 0): Activity => ({ id: `r${km}${offset}`, date: addDays(today, offset), type: 'run', minutes, km });
const status = (raw: RawData, id: string) => evaluateBadges(buildCtx(raw), true).find((x) => x.id === id)!;

// ---- weeks start on Monday ----
assert.equal(weekStart('2026-03-11'), '2026-03-09'); // Wed → Mon
assert.equal(weekStart('2026-03-09'), '2026-03-09');
assert.equal(weekStart('2026-03-15'), '2026-03-09'); // Sunday belongs to the week that started Monday
assert.equal(weekStart('2026-03-16'), '2026-03-16');

// ---- streaks ----
assert.deepEqual(streakOf(days(0, -1, -2), today), { current: 3, longest: 3, todayDone: true });
assert.deepEqual(streakOf(days(-1, -2, -3), today), { current: 3, longest: 3, todayDone: false }, 'today not done yet: the streak is still alive');
assert.deepEqual(streakOf(days(-2, -3), today), { current: 0, longest: 2, todayDone: false }, 'a missed day breaks it');
assert.deepEqual(streakOf(days(0, -1, -3, -4, -5, -6), today), { current: 2, longest: 4, todayDone: true }, 'longest run is remembered');
assert.deepEqual(streakOf(new Set(), today), { current: 0, longest: 0, todayDone: false });
assert.equal(streakOf(days(-1, -1, -2), today).longest, 2, 'duplicates ignored');

// ---- logging badges follow real streaks, with progress ----
const week = base({ entries: [0, -1, -2, -3, -4, -5, -6].map((o) => meal(o)) });
assert.equal(status(week, 'log-7').unlocked, true);
assert.equal(status(week, 'log-30').unlocked, false);
assert.equal(status(week, 'log-30').current, 7);
assert.ok(Math.abs(status(week, 'log-30').progress - 7 / 30) < 1e-9);
assert.equal(status(week, 'first-meal').unlocked, true);
assert.equal(status(base(), 'first-meal').unlocked, false);
assert.equal(status(base(), 'log-7').progress, 0);
// a gap means no 7-day badge
assert.equal(status(base({ entries: [0, -1, -2, -4, -5, -6, -7].map((o) => meal(o)) }), 'log-7').unlocked, false);

// ---- nutrition & water ----
const proteinDays = base({ entries: Array.from({ length: 10 }, (_, i) => meal(-i, 95)) }); // ≥ 90% of 100 g
assert.equal(status(proteinDays, 'protein-10').unlocked, true);
assert.equal(status(base({ entries: Array.from({ length: 10 }, (_, i) => meal(-i, 80)) }), 'protein-10').current, 0, 'below 90% of the goal does not count');
const water = Object.fromEntries([0, -1, -2, -3, -4, -5, -6].map((o) => [addDays(today, o), 2600]));
assert.equal(status(base({ water }), 'water-7').unlocked, true);
assert.equal(status(base({ water: { ...water, [addDays(today, -3)]: 1000 } }), 'water-7').unlocked, false);

// ---- training / activity ----
assert.equal(status(base({ workouts: [{ date: today }] }), 'first-workout').unlocked, true);
assert.equal(status(base({ workouts: Array.from({ length: 10 }, (_, i) => ({ date: addDays(today, -i) })) }), 'workouts-10').unlocked, true);
assert.equal(status(base({ activities: [run(5, 30)] }), 'run-5k').unlocked, true);
assert.equal(status(base({ activities: [run(4.9, 30)] }), 'run-5k').unlocked, false);
assert.equal(status(base({ activities: [run(10.2, 60)] }), 'run-10k').unlocked, true);
assert.equal(status(base({ steps: { [today]: 10000 } }), 'steps-10k').unlocked, true);
assert.equal(status(base({ steps: { [today]: 9999 } }), 'steps-10k').unlocked, false);
// WHO week = best rolling 7 days
const spread = [-20, -19, -18, -17, -16].map((o) => run(3, 30, o)); // 150 min within 5 days
assert.equal(status(base({ activities: spread }), 'who-week').unlocked, true);
const tooSpread = [-30, -20, -10, 0].map((o) => run(3, 40, o)); // 160 min but never within 7 days
assert.equal(status(base({ activities: tooSpread }), 'who-week').unlocked, false);
assert.equal(status(base({ activities: tooSpread }), 'who-week').current, 40);

// ---- body: progress is measured toward the goal's direction ----
const w = (offset: number, kg: number) => ({ date: addDays(today, offset), kg });
const losing = base({ weights: [w(-30, 80), w(-15, 78.5), w(0, 77.5)], goalDirection: 'lose', goalWeight: 72 });
assert.equal(status(losing, 'progress-2kg').unlocked, true);
assert.equal(status(losing, 'progress-5kg').unlocked, false);
assert.equal(status(losing, 'progress-2kg').current, 2.5);
const gainedWhileLosing = base({ weights: [w(-30, 70), w(0, 74)], goalDirection: 'lose' });
assert.equal(status(gainedWhileLosing, 'progress-2kg').current, 0, 'moving the wrong way earns nothing');
assert.equal(status(base({ weights: [w(-30, 60), w(0, 63)], goalDirection: 'gain' }), 'progress-2kg').unlocked, true);
assert.equal(status(base({ weights: [w(-30, 70), w(0, 60)], goalDirection: 'maintain' }), 'progress-2kg').unlocked, false, 'maintain has no direction');
assert.equal(status(base({ weights: [w(-30, 80), w(0, 72.2)], goalWeight: 72, goalDirection: 'lose' }), 'goal-reached').unlocked, true);
assert.equal(status(base({ weights: [w(-30, 80), w(0, 71)], goalWeight: 72, goalDirection: 'lose' }), 'goal-reached').unlocked, true, 'passing the goal counts');
assert.equal(status(base({ weights: [w(-30, 80), w(0, 75)], goalWeight: 72, goalDirection: 'lose' }), 'goal-reached').unlocked, false);
assert.equal(status(base({ weights: [w(0, 75)], goalWeight: 72 }), 'goal-reached').unlocked, false, 'one weigh-in is not enough');

// ---- recovery & kitchen ----
const ck = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [addDays(today, -i), {}]));
assert.equal(status(base({ checkins: ck }), 'checkin-7').unlocked, true);
assert.equal(status(base({ checkins: ck }), 'checkin-30').current, 7);
assert.equal(status(base({ entries: [meal(0, 20, 'recipe-dal-tadka')] }), 'first-recipe').unlocked, true);
assert.equal(status(base({ entries: [meal(0, 20, 'usda-123')] }), 'first-recipe').unlocked, false);
assert.equal(status(base({ plan: { r1: 1 } }), 'meal-plan').unlocked, true);
assert.equal(status(base({ pantryCount: 10 }), 'pantry').unlocked, true);

// ---- the badge list itself ----
assert.equal(new Set(BADGES.map((x) => x.id)).size, BADGES.length, 'duplicate badge ids');
assert.ok(BADGES.length >= 28);
for (const x of BADGES) assert.ok(x.target > 0 && x.name && x.desc && x.icon, x.id);
const nothing = evaluateBadges(buildCtx(base()));
assert.ok(nothing.every((x) => !x.unlocked && x.progress === 0), 'a brand-new user has no badges');

// ---- weekly challenges ----
const mon = weekStart(today);
const c1 = challengesForWeek(mon);
assert.equal(c1.length, 3);
assert.equal(new Set(c1.map((x) => x.id)).size, 3, 'three different challenges');
assert.deepEqual(challengesForWeek(mon), c1, 'same week → same challenges');
assert.notDeepEqual(challengesForWeek(addDays(mon, 7)).map((x) => x.id), c1.map((x) => x.id), 'next week rotates');
for (let i = 0; i < 40; i++) assert.equal(new Set(challengesForWeek(addDays(mon, i * 7)).map((x) => x.id)).size, 3);
// progress only counts the current Mon–Sun week
const forced = CHALLENGES.find((x) => x.id === 'log-6')!;
const idx = Array.from({ length: 40 }, (_, i) => addDays(mon, i * 7)).find((m) => challengesForWeek(m).some((x) => x.id === 'log-6'))!;
const todayInThatWeek = addDays(idx, 2); // a Wednesday
const raw = base({ today: todayInThatWeek, entries: [0, -1, -2].map((o) => ({ date: addDays(todayInThatWeek, o), kcal: 500, protein: 20 })).concat([{ date: addDays(idx, -1), kcal: 500, protein: 20 }]) });
const ch = evaluateChallenges(buildCtx(raw)).find((x) => x.id === forced.id)!;
assert.equal(ch.current, 3, 'the entry from last Sunday is not counted');
assert.equal(ch.done, false);
assert.equal(ch.key, `${idx}:log-6`);
assert.ok(Math.abs(ch.progress - 0.5) < 1e-9);

// ---- levels ----
assert.deepEqual([0, 24, 25, 74, 75, 1499, 1500].map((p) => levelFor(p).level), [1, 1, 2, 2, 3, 9, 10]);
assert.equal(levelFor(0).title, 'Starter');
const lv = levelFor(100);
assert.equal(lv.level, 3);
assert.equal(lv.into, 25);
assert.equal(lv.needed, 75);
assert.equal(levelFor(1900).level, 11, 'levels continue past 10');
let prevLevel = 1;
for (let p = 0; p < 4000; p += 10) {
  const l = levelFor(p).level;
  assert.ok(l >= prevLevel, 'levels never go down');
  prevLevel = l;
}
const pts = totalPoints(evaluateBadges(buildCtx(week)), 2);
// week streak earns: first-meal (10) + log-7 (10) = 20, plus 2 challenges × 10
assert.equal(pts, 40);

// ---- nudges ----
const nudgeFor = (r: RawData) => { const c = buildCtx(r); return nudge(c, evaluateBadges(c), evaluateChallenges(c)); };
assert.match(nudgeFor(base({ entries: [-1, -2, -3].map((o) => meal(o)) })), /3-day logging streak.*log something today/);
assert.match(nudgeFor(base({ entries: [0, -1, -2, -3, -4].map((o) => meal(o)) })), /2 more to unlock “One week strong”/, 'close to a badge');
assert.match(nudgeFor(base()), /log your next meal/);
assert.match(nudgeFor(base({ entries: [meal(0)] })), /1 day logged in a row/);
console.log(`Gamification tests passed (${BADGES.length} badges, ${CHALLENGES.length} challenges).`);
