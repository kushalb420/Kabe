// Optional LIVE check of the AI paths with the key in .env (not part of npm test: it uses the network and your free quota).
//   npx tsx scripts/live-ai-check.ts
import { readFileSync } from 'node:fs';
import { lookupFood } from '../src/lib/mealAi';
import { lookupMicros, testKey, understandMeal } from '../src/lib/vision';

const key = (readFileSync('.env', 'utf8').match(/EXPO_PUBLIC_GEMINI_KEY=(.*)/)?.[1] ?? '').trim();
if (!key) throw new Error('Put your key in .env first (see .env.example).');

const show = (label: string, v: unknown) => console.log(`\n== ${label}\n${JSON.stringify(v, null, 1).slice(0, 900)}`);

(async () => {
  show('key / model', await testKey(key).catch((e) => String(e)));
  show('understandMeal: "two rotis and a bowl of dal for lunch"', await understandMeal(key, { text: 'two rotis and a bowl of dal for lunch' }).catch((e) => String(e)));
  const food = await lookupFood(key, 'paneer butter masala').catch((e) => String(e));
  show('lookupFood: paneer butter masala', food);
  show('lookupMicros: spinach', await lookupMicros(key, 'spinach').catch((e) => String(e)));
})();
