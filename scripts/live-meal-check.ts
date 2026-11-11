// LIVE check of the meal prompts with the key in .env. npx tsx scripts/live-meal-check.ts "2 rotis, dal, a banana"
import { readFileSync } from 'node:fs';
import { itemGrams, itemNutrients, mealTotals } from '../src/lib/gemFood';
import { analyzeMealText, lookupFood } from '../src/lib/mealAi';

const key = (readFileSync('.env', 'utf8').match(/EXPO_PUBLIC_GEMINI_KEY=(.*)/)?.[1] ?? '').trim();
(async () => {
  const text = process.argv[2] ?? '2 rotis, dal, curd, 1 banana, chai with 2 spoons sugar';
  const r = await analyzeMealText(key, text);
  console.log('meal:', r.meal);
  for (const it of r.items) console.log(`- ${it.name}: ${it.count} ${it.unit} (${itemGrams(it)} g) stated=${it.stated}`, JSON.stringify(itemNutrients(it)));
  console.log('TOTAL', JSON.stringify(mealTotals(r.items)));
  const f = await lookupFood(key, 'masala dosa');
  console.log('food:', f && `${f.name} ${f.kcal} kcal/100g p${f.protein} c${f.carbs} f${f.fat} sat${f.satFat} sugar${f.sugar} fib${f.fiber} | ${f.servingLabel}`);
})();
