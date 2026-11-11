import assert from 'node:assert/strict';
import { EMPTY_VALUES, LabelNumbers, boxesToValues, buildLabelPrompt, buildLabelRequest, checkLabel, cleanNumber, hasAnyNumber, kcalFromMacros, labelToFood, parseBox, parseLabelResponse, toPer100, valuesToBoxes } from '../src/lib/label';
import { macrosFor } from '../src/lib/nutrition';

const reply = (obj: unknown) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(obj) }] }] });
const vals = (o: Partial<LabelNumbers>): LabelNumbers => ({ ...EMPTY_VALUES, ...o });

// ---- the AI only copies printed numbers ----
const prompt = buildLabelPrompt();
assert.match(prompt, /like an OCR tool/);
assert.match(prompt, /NEVER calculate, convert or estimate/);
assert.match(prompt, /answer null/);
assert.match(prompt, /NOT kJ/);
const req = buildLabelRequest('m', 'AAAA', 'image/jpeg');
assert.equal((req.input[1] as { type: string }).type, 'image');
assert.ok(JSON.stringify(req.response_format).includes('sodium_mg'));

// ---- cleaning numbers ----
assert.equal(cleanNumber(12.345, 100), 12.35);
assert.equal(cleanNumber(0, 100), 0);
assert.equal(cleanNumber(-1, 100), null);
assert.equal(cleanNumber(101, 100), null);
assert.equal(cleanNumber('12', 100), null, 'strings are not trusted');
assert.equal(cleanNumber(NaN, 100), null);
assert.equal(cleanNumber(null, 100), null);

// ---- parsing a label answer ----
const read = parseLabelResponse(
  reply({ product_name: '  Masala Oats  ', basis: 'perServing', serving_size: 40, kcal: 150, protein: 4.2, carbs: 26, fat: 3, fiber: 3.5, sugar: 2, saturated_fat: 1.2, sodium_mg: 380 }),
);
assert.equal(read.name, 'Masala Oats');
assert.equal(read.basis, 'perServing');
assert.equal(read.servingG, 40);
assert.deepEqual(read.values, { kcal: 150, protein: 4.2, carbs: 26, fat: 3, fiber: 3.5, sugar: 2, satFat: 1.2, sodiumMg: 380 });
const blurry = parseLabelResponse(reply({ basis: 'weird', serving_size: 0, kcal: 'lots', protein: null, carbs: -3, fat: 99999 }));
assert.equal(blurry.basis, 'unclear');
assert.equal(blurry.servingG, null, 'a zero serving is not a serving');
assert.deepEqual(blurry.values, EMPTY_VALUES, 'unreadable numbers become unknown, never guesses');
assert.equal(blurry.name, '');
assert.equal(hasAnyNumber(blurry.values), false);
assert.equal(hasAnyNumber(read.values), true);
assert.equal(hasAnyNumber(vals({ sugar: 0 })), true, 'a printed zero is still a number');
assert.throws(() => parseLabelResponse(null), /unreadable/);
assert.throws(() => parseLabelResponse({ status: 'failed', steps: [] }), /did not finish/);
assert.throws(() => parseLabelResponse({ status: 'completed', steps: [] }), /no answer/);
assert.throws(() => parseLabelResponse({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'nope' }] }] }), /not valid JSON/);
assert.equal(parseLabelResponse({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '```json\n{"basis":"per100","kcal":52}\n```' }] }] }).values.kcal, 52);

// ---- converting to per 100 g ----
const perServing = vals({ kcal: 150, protein: 4.2, carbs: 26, fat: 3, fiber: 3.5, sugar: 2, satFat: 1.2, sodiumMg: 380 });
const p100 = toPer100(perServing, 'perServing', 40)!;
assert.deepEqual(p100, { kcal: 375, protein: 10.5, carbs: 65, fat: 7.5, fiber: 8.75, sugar: 5, satFat: 3, sodiumMg: 950 });
assert.deepEqual(toPer100(perServing, 'per100', 40), perServing, 'a per-100 g column is used as printed');
assert.equal(toPer100(perServing, 'perServing', null), null, 'a per-serving label with no serving size cannot be converted');
assert.equal(toPer100(perServing, 'perServing', 0), null);
assert.equal(toPer100(vals({ kcal: 100 }), 'perServing', 50)!.protein, null, 'unknown stays unknown');
assert.equal(toPer100(vals({ kcal: 100 }), 'perServing', 50)!.kcal, 200);

// ---- the checks ----
const ok = checkLabel(p100, 'perServing', 'perServing', 40);
assert.deepEqual(ok, [], 'a consistent label has no warnings');
assert.deepEqual(checkLabel(null, 'perServing', 'perServing', null), ['noServing']);
assert.ok(checkLabel(p100, 'unclear', 'per100', null).includes('unclearBasis'));
assert.ok(checkLabel(vals({ protein: 5, carbs: 10, fat: 2 }), 'per100', 'per100', null).includes('kcalMissing'));
// 100 kcal printed but the macros add up to 4*20+4*50+9*30 = 550
assert.ok(checkLabel(vals({ kcal: 100, protein: 20, carbs: 50, fat: 30 }), 'per100', 'per100', null).includes('atwater'));
// printed labels round: 4*10+4*20+9*5 = 165 vs 160 is fine
assert.ok(!checkLabel(vals({ kcal: 160, protein: 10, carbs: 20, fat: 5 }), 'per100', 'per100', null).includes('atwater'));
assert.ok(checkLabel(vals({ kcal: 100, protein: 1, carbs: 10, sugar: 25, fat: 1 }), 'per100', 'per100', null).includes('sugarOverCarbs'));
assert.ok(checkLabel(vals({ kcal: 100, protein: 1, carbs: 10, fiber: 30, fat: 1 }), 'per100', 'per100', null).includes('fiberOverCarbs'));
assert.ok(checkLabel(vals({ kcal: 700, protein: 40, carbs: 40, fat: 40 }), 'per100', 'per100', null).includes('tooMuchMass'));
assert.ok(checkLabel(vals({ kcal: 1200, protein: 10, carbs: 10, fat: 100 }), 'per100', 'per100', null).includes('kcalTooHigh'));
assert.ok(!checkLabel(vals({ kcal: 884, protein: 0, carbs: 0, fat: 100 }), 'per100', 'per100', null).includes('kcalTooHigh'), 'pure oil is fine');
assert.deepEqual(checkLabel(vals({ kcal: 52, protein: 0.3, carbs: 14, sugar: 10.4, fiber: 2.4, fat: 0.2 }), 'per100', 'per100', null), [], 'an apple');

// ---- energy from the macros (only when the user asks) ----
assert.equal(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 }), 165);
assert.equal(kcalFromMacros({ protein: 10, carbs: null, fat: 5 }), null, 'never fills in a missing macro');

// ---- making a food ----
const food = labelToFood('  Masala Oats ', p100, 40)!;
assert.equal(food.name, 'Masala Oats');
assert.equal(food.category, 'Label');
assert.equal(food.kcal, 375);
assert.equal(food.fiber, 8.75);
assert.equal(food.sodium, 950);
assert.equal(food.servingG, 40);
assert.equal(food.servingLabel, '40 g');
assert.equal(Math.round(macrosFor({ ...food, id: 'x' }, 40).kcal), 150, 'one serving logs what the label says');
const minimal = labelToFood('Plain', vals({ kcal: 80, protein: 3 }), null)!;
assert.equal(minimal.servingG, 100);
assert.equal(minimal.carbs, 0);
assert.ok(!('fiber' in minimal) && !('sugar' in minimal) && !('satFat' in minimal) && !('sodium' in minimal), 'values that were not printed stay unknown, not zero');
assert.equal(labelToFood('', p100, 40), null, 'a name is required');
assert.equal(labelToFood('X', vals({ protein: 3 }), 40), null, 'calories are required');
assert.equal(labelToFood('X', vals({ kcal: 0 }), 40), null);

// ---- the editable boxes ----
assert.equal(parseBox(' 12,5 '), 12.5);
assert.equal(parseBox(''), null);
assert.equal(parseBox('abc'), null);
assert.equal(parseBox('-3'), null);
assert.equal(parseBox('0'), 0);
const boxes = valuesToBoxes(read.values);
assert.equal(boxes.kcal, '150');
assert.equal(valuesToBoxes(EMPTY_VALUES).fiber, '');
assert.deepEqual(boxesToValues(boxes), read.values, 'round trip');
assert.deepEqual(boxesToValues({ ...boxes, fiber: '', sugar: 'x' }), { ...read.values, fiber: null, sugar: null });

console.log('Label tests passed.');
