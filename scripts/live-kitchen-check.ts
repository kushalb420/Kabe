// LIVE check of kitchen ideas with the key in .env. npx tsx scripts/live-kitchen-check.ts
import { readFileSync } from 'node:fs';
import { DEFAULT_EQUIPMENT } from '../src/lib/kitchenAi';
import { askCook, recipeDetails, suggestMeals } from '../src/lib/kitchenNet';

const key = (readFileSync('.env', 'utf8').match(/EXPO_PUBLIC_GEMINI_KEY=(.*)/)?.[1] ?? '').trim();
(async () => {
  const pantry = [{ id: '1', name: 'Tomatoes', qty: '4' }, { id: '2', name: 'Toor dal', qty: '300 g' }, { id: '3', name: 'Eggs', qty: '6' }, { id: '4', name: 'Rice', qty: '1 kg' }, { id: '5', name: 'Onions', qty: '3' }];
  const r = await suggestMeals(key, { pantry, equipment: DEFAULT_EQUIPMENT, diet: 'egg', meal: 'dinner', maxMinutes: 30, remaining: { kcal: 700, protein: 35 }, wish: '' });
  for (const o of r.options) console.log(`- ${o.name} (${o.minutes} min, ${o.nutrition.kcal} kcal, P${o.nutrition.protein}) need: ${o.uses.filter((u) => !u.have && !u.optional).map((u) => u.name).join(', ') || 'nothing'} | optional: ${o.uses.filter((u) => u.optional).map((u) => u.name).join(', ')}`);
  console.log('buy:', r.buy.map((b) => `${b.item} -> ${b.unlocks.join('/')}`).join(' ; '));
  if (!r.options.length) return;
  const d = await recipeDetails(key, r.options[0], pantry, DEFAULT_EQUIPMENT);
  console.log('steps:', d?.steps.length, '| swaps:', d?.swaps.join(' / '));
  console.log('chat:', await askCook(key, r.options[0], d, [], 'Can I use masoor dal instead?'));
})();
