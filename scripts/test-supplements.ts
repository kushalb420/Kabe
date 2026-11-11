import assert from 'node:assert/strict';
import { readSupplementByName, readSupplementLabel } from '../src/lib/suppAi';
import { amountsStated, parseMeal } from '../src/lib/gemFood';
import { refineItem } from '../src/lib/mealAi';
import {
  addDays, addDose, buildSuppLabelPrompt, buildSuppPrompt, cleanSchedule, daysBetween, defaultSchedule, dosesDue, dosesTaken, isDue, nextDue, parseSupp, progressOn, removeDose, streakOf, supplementIntake, topAmounts,
} from '../src/lib/supplements';

const D = '2026-11-11'; // a Wednesday
const base = defaultSchedule(D);

// ---- dates
assert.equal(addDays('2026-11-30', 1), '2026-12-01');
assert.equal(addDays('2026-01-01', -1), '2025-12-31');
assert.equal(daysBetween('2026-11-08', D), 3);

// ---- schedules: every day, several times a day, every few days, weekdays, as needed
assert.equal(dosesDue({ ...base, times: 3 }, D), 3);
const every3 = { ...base, mode: 'every' as const, every: 3, start: '2026-11-08' };
assert.equal(isDue(every3, '2026-11-08'), true);
assert.equal(isDue(every3, '2026-11-09'), false);
assert.equal(isDue(every3, D), true, '3 days after the start');
assert.equal(isDue(every3, '2026-11-05'), false, 'not before the start');
assert.equal(nextDue(every3, '2026-11-12'), '2026-11-14');
const mwf = { ...base, mode: 'weekdays' as const, days: [1, 3, 5] };
assert.equal(isDue(mwf, D), true, 'Wednesday');
assert.equal(isDue(mwf, '2026-11-12'), false, 'Thursday');
assert.equal(nextDue(mwf, '2026-11-12'), '2026-11-13');
const prn = { ...base, mode: 'asNeeded' as const };
assert.equal(isDue(prn, D), false);
assert.equal(nextDue(prn, D), null);
assert.equal(dosesDue({ ...every3, times: 2 }, D), 2, 'twice on the days it is due');

// ---- stored schedules are checked
assert.deepEqual(cleanSchedule(undefined, D), defaultSchedule(D), 'older supplements: every day, once');
assert.equal(cleanSchedule({ mode: 'every', every: 1 }, D).every, 2);
assert.equal(cleanSchedule({ mode: 'every', every: 400 }, D).every, 2);
assert.equal(cleanSchedule({ mode: 'every', every: 45 }, D).every, 45);
assert.equal(cleanSchedule({ times: 9 }, D).times, 1);
assert.equal(cleanSchedule({ times: 6 }, D).times, 6);
assert.equal(cleanSchedule({ mode: 'weird' }, D).mode, 'daily');
assert.deepEqual(cleanSchedule({ mode: 'weekdays', days: [9, 'x', 2, 2] }, D).days, [2]);
assert.deepEqual(cleanSchedule({ mode: 'weekdays', days: [] }, D).days, [1, 2, 3, 4, 5]);
assert.equal(cleanSchedule({ start: 'tomorrow' }, D).start, D);

// ---- doses taken (one entry per dose)
let log = addDose({}, D, 'a');
log = addDose(log, D, 'a');
log = addDose(log, D, 'b');
assert.equal(dosesTaken(log[D], 'a'), 2);
assert.equal(dosesTaken(log[D], 'b'), 1);
assert.equal(dosesTaken(undefined, 'a'), 0);
log = removeDose(log, D, 'a');
assert.equal(dosesTaken(log[D], 'a'), 1);
assert.equal(removeDose({}, D, 'zzz')['x'], undefined);
assert.deepEqual(removeDose(log, D, 'nope'), log);

// ---- progress counts only what is due, and never above it
const supps = [{ id: 'a', schedule: { ...base, times: 2 } }, { id: 'b', schedule: every3 }, { id: 'c', schedule: mwf }, { id: 'd', schedule: { ...every3, start: '2026-11-10' } }];
assert.deepEqual(progressOn(supps, {}, D), { done: 0, total: 4 }, 'd is not due today');
assert.deepEqual(progressOn(supps, { [D]: ['a', 'a', 'a', 'b', 'd'] }, D), { done: 3, total: 4 }, 'extra doses and not-due doses are not counted');

// ---- streaks skip the days a supplement is not due
const s2 = { ...base, mode: 'every' as const, every: 2, start: '2026-11-05' }; // due 5,7,9,11
const l2 = { '2026-11-05': ['x'], '2026-11-07': ['x'], '2026-11-09': ['x'], [D]: ['x'] };
assert.equal(streakOf(s2, l2, 'x', D), 4);
assert.equal(streakOf(s2, { ...l2, '2026-11-07': [] }, 'x', D), 2, 'a missed due day ends the streak');
assert.equal(streakOf(s2, { ...l2, [D]: [] }, 'x', D), 3, 'today not done yet does not break it');
assert.equal(streakOf(base, {}, 'x', D), 0);

// ---- reading what a supplement contains
const good = { recognised: true, name: 'Vitamin D3 60000 IU', serving: '1 capsule', iron: 0, calcium: 0, magnesium: 0, potassium: 0, zinc: 0, vitaminA: 0, vitaminC: 0, vitaminD: 1500, vitaminB12: 0, folate: 0, vitaminE: 0, vitaminK: 0, others: [] };
const r = parseSupp(good, 'estimate')!;
assert.deepEqual(r.composition.perDose, { vitaminD: 1500 }, 'zeros mean "none in it"');
assert.equal(r.composition.source, 'estimate');
assert.equal(r.composition.serving, '1 capsule');
assert.equal(parseSupp({ ...good, recognised: false }, 'estimate'), null);
assert.equal(parseSupp({ ...good, vitaminD: 0 }, 'label'), null, 'nothing learned');
assert.equal(parseSupp({ ...good, vitaminD: 99999 }, 'label'), null, 'an impossible amount is dropped');
assert.equal(parseSupp({ ...good, vitaminD: 0, others: ['Omega-3 500 mg', '  '] }, 'label')!.composition.others.length, 1);
assert.equal(parseSupp(null, 'label'), null);
assert.equal(parseSupp({ ...good, others: Array.from({ length: 20 }, (_, i) => `x${i}`) }, 'label')!.composition.others.length, 8);
assert.match(buildSuppPrompt('Centrum', '1 tablet'), /"Centrum"/);
assert.match(buildSuppPrompt('Centrum', ''), /did not say the dose/);
assert.match(buildSuppPrompt('x', ''), /1 IU = 0.025 mcg/);
assert.match(buildSuppLabelPrompt('2 tablets'), /"2 tablets"/);

// ---- what taking them adds up to
const comp = { perDose: { vitaminD: 1500, calcium: 500 }, others: [], serving: '1', source: 'label' as const };
const tot = supplementIntake([{ id: 'a', composition: comp }, { id: 'b' }], { [D]: ['a', 'a', 'b'], '2026-11-10': ['a'] }, [D]);
assert.equal(tot.total.vitaminD, 3000);
assert.equal(tot.total.calcium, 1000);
assert.equal(tot.total.iron, 0);
assert.equal(tot.doses, 3, 'doses of an unread supplement are counted but add nothing');
assert.equal(supplementIntake([{ id: 'a', composition: comp }], { [D]: ['a'], '2026-11-10': ['a'] }, [D, '2026-11-10']).total.calcium, 1000);
assert.deepEqual(topAmounts(comp, 1), [{ id: 'vitaminD', amount: 1500, unit: 'mcg' }], 'largest share of the daily value first');

// ---- the network side, with a pretend AI
void (async () => {
  let asked = '';
  const fake = async (_k: string, input: unknown) => {
    asked = JSON.stringify(input);
    return good;
  };
  const byName = await readSupplementByName('k', 'Sunny D', '1 cap', fake);
  assert.equal(byName!.composition.perDose.vitaminD, 1500);
  assert.match(asked, /Sunny D/);
  const byLabel = await readSupplementLabel('k', 'AAAA', 'image/jpeg', '', fake);
  assert.equal(byLabel!.composition.source, 'label');
  assert.match(asked, /image/);
  assert.equal(await readSupplementByName('k', 'x', '', async () => ({ recognised: false })), null);

  // ---- typed meals: brackets stay with their item, the whole serving stays the amount
  assert.deepEqual(amountsStated('Pepper paneer curry 250ml (45g of paneer), curd, 2 rotis', ['Pepper paneer curry', 'Curd', 'Roti']), [true, false, true]);
  assert.deepEqual(amountsStated('curd (loose, thin)\nbanana', ['Curd', 'Banana']), [false, false], 'a bracket without an amount is not an amount');
  assert.deepEqual(amountsStated('150g curd (loose)\ndal', ['Curd', 'Dal']), [true, false]);
  assert.deepEqual(amountsStated('dal (1 katori, with tadka), rice', ['Dal', 'Rice']), [true, false], 'a comma inside brackets does not split the item');
  const per100 = { kcal: 100, protein: 5, carbs: 10, fat: 4, saturated_fat: 1, free_sugar: 0, fiber: 1 };
  const m = parseMeal({ meal: null, items: [{ name: 'Pepper paneer curry', unit: 'ml', unit_grams: 1, count: 250, quantity_stated: true, note: '45 g of the 250 ml is paneer', per100 }] });
  assert.equal(m.items[0].note, '45 g of the 250 ml is paneer');
  assert.equal(m.items[0].count, 250);
  assert.equal(parseMeal({ items: [{ name: 'x', unit: 'g', unit_grams: 1, count: 5, quantity_stated: false, per100 }] }).items[0].note, '', 'no note is an empty note');
  const refined = await refineItem('k', m.items[0], 'only 45 g paneer', async () => ({ meal: null, items: [{ name: 'Curry', unit: 'g', unit_grams: 1, count: 10, quantity_stated: false, note: 'x', per100: { ...per100, kcal: 80 } }] }));
  assert.equal(refined!.count, 250, 'the amount the person set stays');
  assert.equal(refined!.unit, 'ml');
  assert.equal(refined!.per100.kcal, 80, 'the nutrition is the new one');
  assert.equal(refined!.stated, true);
  assert.match(refined!.note, /only 45 g paneer/);
  assert.equal(await refineItem('k', m.items[0], '   ', async () => ({})), null);
  console.log('supplements: ok');
})();
