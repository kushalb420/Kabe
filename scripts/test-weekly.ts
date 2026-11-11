import assert from 'node:assert/strict';
import { buildFacts, buildWeeklyPrompt, checkNarrative, highlights, isEmpty, nextStep, numbersIn } from '../src/lib/weekly';

const TODAY = '2026-03-14';
const goals = { kcal: 2000, protein: 100 };
const base = { today: TODAY, goals, entries: [], workoutDates: [], activities: [], checkins: {}, weights: [] };
const food = (date: string, kcal: number, protein: number) => ({ date, kcal, protein, carbs: 0, fat: 0 });

// ---- empty ----
const empty = buildFacts(base);
assert.equal(isEmpty(empty), true);
assert.equal(empty.weightChangeKg, null);
assert.equal(nextStep(empty), 'logMore');
assert.deepEqual(highlights(empty).map((h) => h.id), [], 'an empty week has nothing to say, and never nags about workouts');

// ---- a real week ----
const entries = [
  food('2026-03-08', 2000, 110), food('2026-03-09', 2100, 105), food('2026-03-10', 1900, 95),
  food('2026-03-11', 2000, 100), food('2026-03-12', 2200, 120), food('2026-03-13', 1800, 100),
  food('2026-03-07', 1000, 40), // 7 days before the end of this week: belongs to the PREVIOUS window (03-01..03-07)
];
const facts = buildFacts({
  ...base,
  entries,
  workoutDates: ['2026-03-09', '2026-03-12', '2026-03-12', '2026-03-05', '2026-03-01', '2026-02-20'],
  activities: [{ date: '2026-03-10', minutes: 60 }, { date: '2026-03-13', minutes: 100 }, { date: '2026-03-05', minutes: 30 }],
  checkins: { '2026-03-12': { sleepH: 7, sleepQ: 3, soreness: 1, fatigue: 1, stress: 1 }, '2026-03-13': { sleepH: 8, sleepQ: 3, soreness: 1, fatigue: 1, stress: 1 } },
  weights: [{ date: '2026-03-08', kg: 70.4 }, { date: '2026-03-14', kg: 69.9 }, { date: '2026-03-01', kg: 72 }],
});
assert.equal(facts.food.loggedDays, 6);
assert.equal(facts.food.avgKcal, 2000);
assert.equal(facts.food.avgProtein, 105);
assert.equal(facts.food.daysProteinMet, 6);
assert.equal(facts.prevFood.loggedDays, 1, 'the day 7 days back counts for the previous week only');
assert.equal(facts.prevFood.avgKcal, 1000);
assert.equal(facts.workouts, 3, 'three workouts in the 7 days (09, 12, 12)');
assert.equal(facts.prevWorkouts, 2);
assert.equal(facts.activeMinutes, 160);
assert.equal(facts.prevActiveMinutes, 30);
assert.deepEqual(facts.sleep, { avgH: 7.5, nights: 2 });
assert.equal(facts.weightChangeKg, -0.5, 'first to last weigh-in inside the week; the older one is ignored');
assert.equal(isEmpty(facts), false);
assert.equal(buildFacts({ ...base, weights: [{ date: '2026-03-13', kg: 70 }] }).weightChangeKg, null, 'one weigh-in is not a change');

const ids = (f: typeof facts) => highlights(f).map((h) => h.id);
assert.deepEqual(ids(facts), ['loggedMost', 'kcalOn', 'proteinMet', 'workouts', 'active', 'sleepGood', 'weight']);
assert.equal(nextStep(facts), 'keep');

// ---- the rules ----
const with_ = (p: Partial<typeof facts> & { food?: Partial<typeof facts.food> }) => ({ ...facts, ...p, food: { ...facts.food, ...p.food } });
assert.ok(ids(with_({ food: { avgKcal: 2400 } })).includes('kcalOver'));
assert.equal(nextStep(with_({ food: { avgKcal: 2400 } })), 'portion');
assert.ok(ids(with_({ food: { avgKcal: 1400 } })).includes('kcalUnder'));
assert.equal(nextStep(with_({ food: { avgKcal: 1400 } })), 'eatEnough');
assert.ok(ids(with_({ food: { daysProteinMet: 1, avgProtein: 60 } })).includes('proteinLow'));
assert.equal(nextStep(with_({ food: { daysProteinMet: 1, avgProtein: 60 } })), 'protein');
assert.equal(nextStep(with_({ sleep: { avgH: 5.5, nights: 4 } })), 'sleep');
assert.ok(ids(with_({ sleep: { avgH: 5.5, nights: 4 } })).includes('sleepShort'));
assert.ok(!ids(with_({ sleep: { avgH: 5.5, nights: 1 } })).some((i) => i.startsWith('sleep')), 'one night says nothing');
assert.equal(nextStep(with_({ workouts: 0, activeMinutes: 0 })), 'move');
assert.equal(nextStep(with_({ food: { loggedDays: 2 } })), 'logMore');
assert.ok(!ids(with_({ food: { loggedDays: 2 } })).some((i) => i.startsWith('kcal') || i.startsWith('protein')), 'under 3 logged days: no food conclusions');
assert.ok(ids(with_({ food: { loggedDays: 3 } })).includes('loggedFew'));
assert.equal(highlights(with_({ weightChangeKg: 0.3 })).find((h) => h.id === 'weight')!.params.kg, '+0.3');

// ---- reading numbers, including Indian digits ----
assert.deepEqual(numbersIn('You logged 6 of 7 days and 7.5 h'), [6, 7, 7.5]);
assert.deepEqual(numbersIn('७ दिन में ६ बार'), [7, 6]);
assert.deepEqual(numbersIn('౭ రోజులు'), [7]);
assert.deepEqual(numbersIn('௭ நாட்கள்'), [7]);
assert.deepEqual(numbersIn('no numbers here'), []);
assert.deepEqual(numbersIn('7.5 kg and 7,5 h'), [7.5, 7.5]);

// ---- the guard on the AI's wording ----
const good = { headline: 'A steady week', summary: 'You logged food on 6 of 7 days and averaged 2000 kcal, close to your goal. You did 3 workouts and slept 7.5 hours.', tip: 'Add one 45 minute walk.' };
assert.deepEqual(checkNarrative(good, facts), null, '45 is not a fact, so a made-up number is rejected');
assert.ok(checkNarrative({ ...good, tip: 'Keep your protein near 100 g a day.' }, facts), 'goal numbers are facts');
assert.ok(checkNarrative({ ...good, tip: 'Try the same again.' }, facts));
assert.equal(checkNarrative({ ...good, tip: 'Try the same again.', summary: 'You averaged 2300 kcal.' }, facts), null, 'invented number');
assert.equal(checkNarrative({ ...good, tip: 'Try the same again.', summary: 'Your weight fell 0.5 kg.' }, facts)?.summary, 'Your weight fell 0.5 kg.', 'absolute value of a fact is allowed');
assert.ok(checkNarrative({ headline: 'ठीक सप्ताह', summary: '७ में से ६ दिन दर्ज किए।', tip: 'ऐसे ही चलते रहें।' }, facts), 'Hindi digits are checked too');
assert.equal(checkNarrative({ headline: 'ठीक सप्ताह', summary: '७ में से ९ दिन दर्ज किए।', tip: 'ऐसे ही चलते रहें।' }, facts), null);
assert.equal(checkNarrative({ headline: '', summary: 'x', tip: 'y' }, facts), null);
assert.equal(checkNarrative({ headline: 'a', summary: 'x'.repeat(701), tip: 'y' }, facts), null);
assert.equal(checkNarrative(null, facts), null);
assert.equal(checkNarrative({ headline: 1, summary: 'x', tip: 'y' }, facts), null);

// ---- the prompt ----
const prompt = buildWeeklyPrompt(facts, 'Hindi');
assert.match(prompt, /Use only numbers that appear in the facts/);
assert.match(prompt, /Write in Hindi/);
assert.ok(prompt.includes('"avgKcal":2000'));
assert.ok(!/entries|name/i.test(JSON.stringify(facts)), 'no food names or notes are ever in the facts');

console.log('Weekly tests passed.');
