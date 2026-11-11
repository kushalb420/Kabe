# Kabe Architecture

## Stack
Expo SDK 58 · React Native · TypeScript (strict) · Expo Router (file-based routes).

## Folders
```
app/                 Screens (Expo Router)
  _layout.tsx        Root: providers + stack
  (tabs)/            Today, Diary, Train, Progress, Me
  add-food.tsx       Modal: search, grams, custom food
src/
  theme.ts           Colors, spacing, shadow
  components/        Screen, Card, ProgressRing, MacroBar, Button, ComingSoon
  data/foods.ts      Starter food list (approximate per-100 g)
  lib/nutrition.ts   Macro math, goal calculator, date keys (unit tested)
  data/ingredientFoods.ts  per-100 g numbers for the 35 recipe ingredients (fixed table). usdaFoods.json is kept on disk but no longer bundled or used
  lib/foodSearch.ts  Offline search over that file; lib/foodText.ts word matching + everyday-name aliases
  lib/photo.ts, lib/vision.ts  Plate photo → foods (Gemini free tier) → nutrition from the databases
  palette.ts, theme.tsx  Light and dark palettes (same names; contrast-tested), ThemeProvider, useColors(), useThemedStyles(makeStyles). Screens never hold a fixed colour object: `const makeStyles = (colors: Colors) => StyleSheet.create(...)` + `useThemedStyles(makeStyles)`
  lib/label.ts       Nutrition label: transcribe printed numbers, per-serving → per-100 g, consistency checks, custom food (tested)
  lib/voice.ts       Voice logging: AI request/answer checks, rule-based sentence parser, meal-from-words, base64 (tested)
  lib/stats.ts       Charts and averages: per-day totals, buckets, calorie split, summary, observation, workout/activity counts (tested)
  lib/weekly.ts      Weekly summary: facts, highlights, next step, AI-wording guard that rejects invented numbers (tested)
  lib/next.ts        "What should I eat next?": fit score, ranking recipes and favourite foods against what is left today (tested)
  lib/privacy.ts     Privacy screen: the four network routes and whether each is on (tested)
  lib/dashboard.ts   Today layout: card ids, order, hidden set, sanitising, move/toggle (tested)
  lib/bodyfat.ts     US Navy body-fat estimate + categories (tested)
  lib/commands.ts    Spoken commands: water, weight, activity (tested)
  lib/progressPhotos.ts / photoFiles.ts   Photo list logic (tested) and private on-phone file copies
  lib/gps.ts         Route maths: distance, fix filtering, pace/speed, clock formatting (tested)
  lib/reminders.ts   Reminder settings and the notification schedule they make (tested); components/ReminderScheduler.tsx schedules them
  lib/prices.ts      Grocery price history and trends (tested)
  lib/insights.ts    Insights: facts from logs, rule tips, AI prompt + number guard (tested)
  lib/intent.ts      What the person wants from Kabe: fixed choices + one sanitised note (tested)
  lib/steps.ts       Step-count helpers; components/StepCounter.tsx reads the phone pedometer (tested)
  lib/micro.ts       Vitamins/minerals: parse + sanity-check AI numbers, daily-value shares (tested); microCache.ts remembers per food
  lib/foodOnline.ts  Food lookup for search screens: web pages, then labelled AI estimate
  lib/fridge.ts      Fridge photo → pantry items, typed lists, AI recipe ideas checked against Kabe's ingredient list (tested)
  lib/menu.ts        Restaurant menus: read dishes from a photo (names only), typed orders, raw-ingredient guard, ranking, order totals, saved orders (tested)
  lib/webNutrition.ts  Keyless web search → fetch pages → AI extracts → numbers verified against page text; labelled AI-estimate fallback
  lib/gps.ts, gpsSession.ts, gpsTask.ts  GPS maths; stored fixes folded into a route (pure, tested); the expo-task-manager background task (native, guarded)
  lib/social.ts      Friends, weekly totals, ranking, shared-plan checks and the Supabase function calls (pure, tested with a fake client)
  lib/backend.ts     Built-in backend config, AI route choice (proxy vs direct) and the request sender (pure, tested)
  supabase/functions/ai  Edge Function: checks the session, counts the request, forwards to Google with the server-held key
  lib/sync.ts        Snapshot allow-lists, change detection, conflict logic, SQL (tested); lib/supabaseApi.ts + store/cloud.tsx wire it to Supabase
  data/recipes.ts    Ingredient table (→ food ids) + 25 recipes; lib/recipes.ts nutrition, pantry matching, ranking; lib/mealPlan.ts planner, groceries, prices (all tested)
  store/kitchen.tsx  Pantry, custom recipes, plan, prices, budget, diet; components/kitchen/* the four tabs
  lib/activity.ts, lib/recovery.ts  MET calories/pace/weekly summaries; sleep score, readiness, rest-day & streak logic (tested)
  lib/gamify.ts      Streaks, badges, weekly challenges, levels, nudges — derived from logs (tested); store/gamify.ts hook records earned dates
  lib/coach.ts       Coach analytics: TDEE from energy balance, trend, plateau, forecast, safe targets (tested)
  lib/coachContext.ts, lib/coachChat.ts  Data summary + Gemini chat with lookup_food tool and safety rules
  lib/workout.ts     Workout math: 1RM, volume, overload rule (tested)
  lib/foodApi.ts     USDA + Open Food Facts clients (pure mappers, tested)
  lib/tracker.ts     Weight trend, streaks, water goal (tested)
  store/tracker.tsx  Body, water, caffeine, supplements, habits (own storage key)
  store/kabe.tsx     React context + AsyncStorage persistence
  i18n/              en/hi/te/ta dictionaries (typed Record<Key,string>, so a missing key is a compile error), translate(), useT()
  i18n/parts/        one file per screen group with all four languages side by side (part() makes a missing/extra key a compile error)
  i18n/recipeText.ts, i18n/gamifyText.ts  names/steps of the built-in recipes, ingredients, badges, challenges and units, keyed by id
  (logic code such as coach.ts, recovery.ts, workout.ts returns an English sentence for tests plus a code the screen translates)
  data/nativeFoods.ts  Hindi/Telugu/Tamil food words → English, applied inside foodText tokens()
scripts/             Tests (npm test)
```

## Data model (local, v1)
- `Entry`: date, meal, name, grams and a **snapshot** of macros (history never changes if food data is later corrected)
- `Food`: per-100 g macros + default serving
- `goals`, `profile`, `customFoods`
- Stored in one AsyncStorage key `kabe:v1`.

## Principles
1. Offline first. Local storage is the source of truth until Supabase sync (Stage 6).
2. Never invent nutrition data: it comes from reference tables or user input.
3. AI sits behind a service interface with a non-AI fallback; keys live server-side (Supabase Edge Functions), never in the app.
4. Keep Expo Go compatible — no native modules that need a custom build until Stage 11.

## Planned
Supabase (auth, Postgres with row-level security, storage) · USDA FDC + Open Food Facts · free-tier LLM via edge function.
