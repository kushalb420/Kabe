import assert from 'node:assert/strict';
import { MICROS, MICRO_SCHEMA, buildMicroPrompt, intakeOf, microKey, missingFoods, parseMicro, shareOf } from '../src/lib/micro';

const full = { iron: 3.3, calcium: 28, magnesium: 36, potassium: 369, zinc: 1.2, vitaminA: 14, vitaminC: 10, vitaminD: 0, vitaminB12: 0, folate: 180, vitaminE: 0.5, vitaminK: 5 };

// ---- parsing the AI's answer ----
assert.deepEqual(parseMicro(full), full);
assert.equal(parseMicro(null), null);
assert.equal(parseMicro('x'), null);
assert.equal(parseMicro({}), null);
assert.equal(parseMicro({ ...full, iron: 500 })!.iron, undefined, 'an impossible amount is dropped, not kept');
assert.equal(parseMicro({ ...full, calcium: -3 })!.calcium, undefined);
assert.equal(parseMicro({ ...full, zinc: 'lots' })!.zinc, undefined);
assert.equal(parseMicro({ ...full, folate: null })!.folate, undefined);
assert.equal(parseMicro({ iron: 3, calcium: 20, magnesium: 30, potassium: 300, zinc: 1 }), null, 'fewer than 6 usable values: skipped, never guessed');
assert.equal(parseMicro({ ...full, iron: 3.456 })!.iron, 3.46);
assert.equal(MICROS.length, 12);
assert.deepEqual(MICRO_SCHEMA.required.length, 12);

// ---- keys and prompt ----
assert.equal(microKey('  Lassi (AI estimate) '), 'lassi');
assert.equal(microKey('Dal   Tadka'), 'dal tadka');
assert.equal(microKey('x'.repeat(200)).length, 60);
const p = buildMicroPrompt('Toor Dal (AI estimate)');
assert.match(p, /"toor dal"/);
assert.match(p, /iron \(mg\)/);
assert.match(p, /vitaminB12 \(mcg\)/);
assert.match(p, /Do not explain/);

// ---- adding up a day ----
const table = { rice: { iron: 1, vitaminC: 0, calcium: 10 }, spinach: { iron: 2.7, vitaminC: 28, calcium: 99 } };
const day = [
  { name: 'Rice', grams: 200, kcal: 260 },
  { name: 'Spinach (AI estimate)', grams: 100, kcal: 23 },
  { name: 'Mystery food', grams: 100, kcal: 100 },
];
const r = intakeOf(day, table);
assert.equal(r.total.iron, 2 + 2.7);
assert.equal(r.total.calcium, 20 + 99);
assert.equal(r.total.vitaminC, 28);
assert.equal(r.total.zinc, 0);
assert.ok(Math.abs(r.coverage - 283 / 383) < 1e-9, 'coverage = share of calories with data');
assert.equal(intakeOf([], table).coverage, 0);
assert.equal(intakeOf([{ name: 'a', grams: 100, kcal: 0 }], table).coverage, 0);

// ---- levels ----
const iron = MICROS[0];
assert.equal(shareOf(4, iron).level, 'low');
assert.equal(shareOf(9, iron).level, 'ok', 'exactly half is on track');
assert.equal(shareOf(18, iron).level, 'ok');
assert.equal(shareOf(36, iron).level, 'ok', 'up to double is fine');
assert.equal(shareOf(40, iron).level, 'plenty');
assert.equal(Math.round(shareOf(9, iron).pct), 50);

// ---- what still needs looking up ----
assert.deepEqual(missingFoods(day, table), ['mystery food']);
assert.deepEqual(missingFoods([{ name: 'A', grams: 1, kcal: 10 }, { name: 'B', grams: 1, kcal: 50 }, { name: 'a', grams: 1, kcal: 10 }], {}), ['b', 'a'], 'biggest calories first, each food once');
assert.deepEqual(missingFoods([], {}), []);

console.log('Micronutrient tests passed.');
