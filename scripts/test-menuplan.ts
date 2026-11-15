import assert from 'node:assert/strict';
import { dishToItem } from '../src/lib/menu';
import { MEAL_SHARE, buildPlans, mealTarget, perServing, scorePlan } from '../src/lib/menuPlan';

const dish = (name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number) =>
  dishToItem({ name, searchTerm: name, grams: 150, veg: 'veg', price: null, confidence: 'medium', kcal, protein, carbs, fat, fiber }, name);
const menu = [
  dish('Phulka', 70, 2.5, 14, 0.5, 2),
  dish('Steamed rice', 200, 4, 44, 0.4, 1),
  dish('Dal tadka', 190, 10, 24, 6, 6),
  dish('Curd', 100, 6, 8, 5, 0),
  dish('Aloo jeera', 160, 3, 24, 6, 3),
  dish('Paneer butter masala', 420, 17, 12, 34, 2),
  dish('Chicken tikka', 250, 30, 5, 12, 1),
  dish('Mixed veg salad', 60, 2, 10, 1, 4),
  dish('Gulab jamun', 300, 4, 45, 12, 0),
  dish('Mango lassi', 260, 7, 40, 8, 0),
  dish('Veg manchurian', 330, 6, 35, 18, 3),
  dish('Mystery dish', 0, 0, 0, 0, 0),
];

assert.deepEqual(MEAL_SHARE, { breakfast: 0.3, lunch: 0.3, snack: 0.1, dinner: 0.3 });
assert.equal(mealTarget(2000, 'lunch'), 600);
assert.equal(mealTarget(2000, 'snack'), 200);
assert.equal(perServing(menu[11]), null, 'a dish with no calories cannot be planned');
assert.equal(perServing(dishToItem({ name: 'x', searchTerm: 'x', grams: 100, veg: 'veg', price: null, confidence: 'low', kcal: 300 }, 'x')), null, 'kcal alone is not enough to plan');

const target = 600;
const plans = buildPlans(menu, target, 5);
assert.ok(plans.length >= 3 && plans.length <= 5, 'three to five plans, got ' + plans.length);
for (const p of plans) {
  assert.ok(p.total.kcal <= target * 1.03 + 0.5, 'never over the meal share');
  assert.ok(p.total.kcal >= target * 0.7, 'close to the meal share');
  assert.ok(p.lines.length >= 2 && p.lines.length <= 4);
  assert.ok(!p.lines.some((l) => /gulab|lassi|manchurian/i.test(l.item.name)), 'no sweets, drinks or fried snacks');
  assert.ok((p.total.fat * 9) / p.total.kcal <= 0.4, 'fat stays reasonable');
  for (const l of p.lines) assert.ok(l.qty >= 1 && l.qty <= 3);
  const sum = p.lines.reduce((s, l) => s + l.per.kcal * l.qty, 0);
  assert.ok(Math.abs(sum - p.total.kcal) < 0.5, 'the total is the sum of the lines');
}
assert.deepEqual(plans.map((p) => p.score), [...plans.map((p) => p.score)].sort((a, b) => b - a), 'best first');
assert.ok(plans.some((p) => p.lines.some((l) => l.qty > 1 && /phulka|rice|curd|jeera|dal/i.test(l.item.name))), 'some plans use more than one serving of a staple');
assert.ok(plans.every((p) => p.lines.every((l) => l.qty === 1 || /phulka|rice|curd|jeera|dal|salad/i.test(l.item.name))), 'only staples are multiplied');
const ids = plans.map((p) => p.lines.map((l) => l.item.id).sort().join('|'));
assert.equal(new Set(ids).size, ids.length, 'plans differ from each other');
// a balanced meal beats a fat-heavy one at the same calories
assert.ok(scorePlan({ kcal: 600, protein: 40, carbs: 80, fat: 12, fiber: 12 }, 600) > scorePlan({ kcal: 600, protein: 15, carbs: 30, fat: 45, fiber: 2 }, 600));
// nothing to plan with
assert.deepEqual(buildPlans([menu[11]], 600), []);
assert.deepEqual(buildPlans([], 600), []);
// a small snack target still works
assert.ok(buildPlans(menu, 200).every((p) => p.total.kcal <= 206));
console.log('Menu plan tests passed.');
