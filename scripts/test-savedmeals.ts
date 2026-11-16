import assert from 'node:assert/strict';
import type { Food } from '../src/data/foods';
import { SAVED_DIETS, dietsInUse, filterMeals, foodToItem, isSavedDiet } from '../src/lib/savedMeals';

const meals = [
  { id: 'a', diet: 'veg' as const },
  { id: 'b', diet: 'nonveg' as const },
  { id: 'c', diet: undefined },
  { id: 'd', diet: 'veg' as const },
];
assert.deepEqual(SAVED_DIETS, ['vegan', 'veg', 'egg', 'nonveg']);
assert.deepEqual(filterMeals(meals, null).map((m) => m.id), ['a', 'b', 'c', 'd'], 'All shows everything, including meals with no diet');
assert.deepEqual(filterMeals(meals, 'veg').map((m) => m.id), ['a', 'd']);
assert.deepEqual(filterMeals(meals, 'vegan'), []);
assert.deepEqual(dietsInUse(meals), ['veg', 'nonveg'], 'only diets that find something are offered');
assert.deepEqual(dietsInUse([]), []);
assert.equal(isSavedDiet('egg'), true);
assert.equal(isSavedDiet('keto'), false);
assert.equal(isSavedDiet(undefined), false);

const paneer: Food = { id: 'paneer', name: 'Paneer', category: 'Dairy', kcal: 300, protein: 18, carbs: 3, fat: 24, servingG: 100, servingLabel: '100 g' };
const it = foodToItem(paneer);
assert.equal(it.grams, 100);
assert.equal(it.kcal, 300);
assert.equal(it.foodId, 'paneer');
const half = foodToItem(paneer, 50);
assert.equal(half.kcal, 150);
assert.equal(half.protein, 9);
assert.equal(foodToItem({ ...paneer, servingG: 0 }).grams, 100, 'no serving: 100 g');
console.log('Saved meal tests passed.');
