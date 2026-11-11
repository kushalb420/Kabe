import assert from 'node:assert/strict';
import { bucketSize, countsPerBucket, mealShares, mondayOf, topContributors, weekBudget, bucketize, daysOf, macroSplit, noteFor, summarize } from '../src/lib/stats';

const e = (date: string, kcal: number, protein = 0, carbs = 0, fat = 0) => ({ date, kcal, protein, carbs, fat });

// ---- one row per day, oldest first, across a month boundary ----
const days = daysOf([e('2026-03-01', 500, 20), e('2026-03-01', 700, 30), e('2026-02-28', 1800, 90)], '2026-03-02', 4);
assert.deepEqual(days.map((d) => d.key), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
assert.deepEqual(days.map((d) => d.logged), [false, true, true, false]);
assert.equal(days[2].kcal, 1200, 'entries of the same day add up');
assert.equal(days[2].protein, 50);
assert.equal(daysOf([], '2026-03-02', 90).length, 90);
assert.equal(daysOf([], '2026-03-30', 7)[0].key, '2026-03-24');
assert.equal(daysOf([], '2024-03-01', 2)[0].key, '2024-02-29', 'leap day');
assert.equal(daysOf([e('1999-01-01', 5)], '2026-03-02', 7).every((d) => !d.logged), true, 'old entries are outside the window');

// ---- buckets average logged days only ----
const week = daysOf([e('2026-03-01', 2000), e('2026-03-03', 1000)], '2026-03-07', 7);
const b = bucketize(week, 7);
assert.equal(b.length, 1);
assert.equal(b[0].kcal, 1500, 'two logged days: (2000+1000)/2, the five empty days do not count as 0');
assert.equal(b[0].loggedDays, 2);
assert.equal(bucketize(week, 1).length, 7);
assert.equal(bucketize(week, 5).length, 2);
assert.equal(bucketize(week, 5)[1].days, 2, 'the last bucket may be shorter');
assert.equal(bucketize(daysOf([], '2026-03-07', 7), 7)[0].kcal, 0, 'no data is 0, not NaN');
assert.deepEqual([7, 30, 90].map((p) => bucketize(daysOf([], '2026-06-30', p), bucketSize(p as 7)).length), [7, 6, 6]);

// ---- calorie split from the macros themselves ----
const sp = macroSplit({ protein: 100, carbs: 250, fat: 70 })!;
assert.ok(Math.abs(sp.protein + sp.carbs + sp.fat - 100) < 1e-9);
assert.ok(Math.abs(sp.protein - (400 / 2030) * 100) < 1e-9);
assert.equal(macroSplit({ protein: 0, carbs: 0, fat: 0 }), null);

// ---- summary ----
const goals = { kcal: 2000, protein: 100 };
const many = daysOf(
  [e('2026-03-01', 2500, 120), e('2026-03-02', 1500, 50), e('2026-03-03', 2000, 95)],
  '2026-03-07',
  7,
);
const s = summarize(many, goals);
assert.equal(s.loggedDays, 3);
assert.equal(s.totalDays, 7);
assert.equal(s.avg.kcal, 2000);
assert.equal(s.daysOver, 1);
assert.equal(s.daysProteinMet, 2, '120 and 95 reach 90% of 100; 50 does not');
assert.deepEqual(s.best, { key: '2026-03-01', protein: 120 });
const none = summarize(daysOf([], '2026-03-07', 7), goals);
assert.equal(none.loggedDays, 0);
assert.equal(none.avg.kcal, 0);
assert.equal(none.best, null);

// ---- the one observation ----
const mk = (kcal: number, protein: number, n = 5) => summarize(daysOf(Array.from({ length: n }, (_, i) => e(`2026-03-0${i + 1}`, kcal, protein)), '2026-03-07', 7), goals);
assert.equal(noteFor(mk(2000, 100, 2), goals), 'few', 'under 3 logged days: no conclusions');
assert.equal(noteFor(mk(2400, 100), goals), 'over');
assert.equal(noteFor(mk(1400, 100), goals), 'under');
assert.equal(noteFor(mk(1900, 70), goals), 'protein');
assert.equal(noteFor(mk(2000, 100), goals), 'steady');
assert.equal(noteFor(mk(2200, 100), goals), 'steady', 'exactly 10% over is still fine');

// ---- counts per day / per complete week ----
const it = [{ date: '2026-03-14', value: 1 }, { date: '2026-03-14', value: 1 }, { date: '2026-03-12', value: 1 }, { date: '2026-03-07', value: 1 }, { date: '2026-03-08', value: 1 }, { date: '2026-02-01', value: 1 }];
const daily = countsPerBucket(it, '2026-03-14', 7);
assert.equal(daily.length, 7);
assert.deepEqual(daily.map((c) => c.value), [1, 0, 0, 0, 1, 0, 2]);
assert.equal(daily[6].start.getDate(), 14);
assert.equal(daily[0].start.getDate(), 8);
const weeks = countsPerBucket(it, '2026-03-14', 30);
assert.equal(weeks.length, 4, '30 days = 4 complete weeks');
assert.deepEqual(weeks.map((c) => c.value), [0, 0, 1, 4]);
assert.equal(countsPerBucket([], '2026-03-14', 90).length, 12);
assert.ok(countsPerBucket([], '2026-03-14', 90).every((c) => c.value === 0));
assert.equal(countsPerBucket([{ date: '2026-03-14', value: 45 }, { date: '2026-03-10', value: 20 }], '2026-03-14', 90)[11].value, 65, 'minutes add up');
assert.equal(countsPerBucket([], '2024-03-01', 7)[0].start.getDate(), 24, 'month boundary');

// ---- weekly budget ----
assert.equal(mondayOf('2026-03-14'), '2026-03-09', 'a Saturday belongs to the week that started on Monday the 9th');
assert.equal(mondayOf('2026-03-09'), '2026-03-09');
assert.equal(mondayOf('2026-03-15'), '2026-03-09', 'Sunday ends the week');
assert.equal(mondayOf('2026-03-01'), '2026-02-23', 'across a month boundary');
const re = (date: string, kcal: number, o: Partial<{ meal: string; name: string; protein: number }> = {}) => ({ date, meal: o.meal ?? 'lunch', name: o.name ?? 'Food', kcal, protein: o.protein ?? 0, carbs: 0, fat: 0 });
const wb = weekBudget([re('2026-03-09', 2000), re('2026-03-10', 2400), re('2026-03-08', 9999)], '2026-03-11', { kcal: 2000, protein: 100 });
assert.equal(wb.weekStart, '2026-03-09');
assert.equal(wb.daysElapsed, 3);
assert.equal(wb.daysLeft, 5);
assert.equal(wb.eatenKcal, 4400, 'last week is not counted');
assert.equal(wb.budgetKcal, 14000);
assert.equal(wb.remainingKcal, 9600);
assert.equal(wb.perDayLeft, 1920);
assert.equal(wb.loggedDays, 2);
const over = weekBudget([re('2026-03-09', 20000)], '2026-03-15', { kcal: 2000, protein: 100 });
assert.equal(over.daysLeft, 1);
assert.ok(over.remainingKcal < 0 && over.perDayLeft === 0, 'over budget never shows a negative allowance');
assert.equal(weekBudget([], '2026-03-09', { kcal: 2000, protein: 100 }).daysLeft, 7, 'Monday: the whole week is ahead');

// ---- meal shares ----
const sh = mealShares([re('d', 300, { meal: 'breakfast' }), re('d', 500, { meal: 'lunch' }), re('d', 200, { meal: 'weird' })]);
assert.equal(sh.breakfast, 30);
assert.equal(sh.lunch, 50);
assert.equal(sh.snack, 20, 'unknown meals count as snacks');
assert.equal(sh.dinner, 0);
assert.deepEqual(mealShares([]), { breakfast: 0, lunch: 0, dinner: 0, snack: 0 });

// ---- top contributors ----
const tc = topContributors([re('d', 100, { name: 'Dal', protein: 10 }), re('d', 100, { name: 'dal', protein: 14 }), re('d', 50, { name: 'Egg', protein: 12 }), re('d', 50, { name: 'Tea', protein: 0 })], 'protein', 2);
assert.deepEqual(tc, [{ name: 'Dal', amount: 24, sharePct: 67 }, { name: 'Egg', amount: 12, sharePct: 33 }]);
assert.deepEqual(topContributors([], 'kcal'), []);
assert.equal(topContributors([re('d', 100, { name: 'Tea' })], 'protein').length, 0, 'foods with none of the nutrient are not listed');

console.log('Stats tests passed.');
