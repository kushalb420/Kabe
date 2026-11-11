# Kabe — Master Feature List

Legend: ✅ done & tested · 🟡 in progress · ⛔ blocked · ⬜ pending

Rules: every ✅ must really work. Nutrition numbers come only from reference data or user input — never invented.
Cost rule: free tools only. Anything that could cost money needs the owner's approval first.

## 0. Foundation
- ✅ Expo + React Native + TypeScript project
- ✅ Expo Router navigation (5 tabs + add-food modal)
- ✅ Theme / design system (colors, cards, rings, bars)
- ✅ Local persistence (AsyncStorage, works offline)
- ✅ Nutrition math unit tests (`npm test`)
- ✅ Git history
- 🟡 Supabase auth (email/password) — built, tested against a local stand-in; awaiting owner's real project
- 🟡 Cloud sync of local data (snapshot + conflict handling) — built and tested; awaiting owner's real project
- ✅ Data export (JSON file)

## 1. Food logging
- ✅ Text search logging (43-food starter list, approximate values)
- ✅ Custom foods (user-entered per-100 g values)
- ✅ Editable gram amount with live macro preview
- ✅ Delete entries (tap entry → Delete)
- ✅ Edit existing entry amount (macros rescale)
- ✅ Favourites (star), recents, saved meals (save a meal, re-add in one tap)
- ✅ Barcode scanning (Open Food Facts, free; camera + typed fallback; refuses incomplete data) — camera scan needs phone test
- ✅ Nutrition-label scanning: photograph the table on a pack; the AI only copies the printed numbers (empty box when unreadable). Kabe converts per-serving to per-100 g, checks the numbers against each other (calories vs protein/carbs/fat, sugar vs carbs, impossible values) and you confirm every box before saving it as your own food (optionally logged at once). Type the label yourself with no key. Not tested with a live key yet
- 🟡 AI photo recognition: built (Gemini free tier, user's own key, macros from database not AI). Logic + review/log UI tested; live Google call NOT yet verified with a real key
- 🟡 Multiple-food detection + portion estimation: built, shown as kcal ranges (±20–45% by confidence); portions are guesses
- ✅ Voice logging: type or dictate a sentence (phone keyboard mic), foods + amounts + meal found by AI (with key) or simple rules, checked and edited before saving. Record button sends audio to Gemini (not yet tested live)
- ✅ Restaurant menu scanning (see section 17)
- ✅ Editable AI results (change grams, swap food, remove items before saving)
- ✅ Editable nutrition per item, per whole meal, and on diary entries
- 🟡 Web nutrition lookup (search + read pages + verify numbers) with labelled AI estimate as last resort — logic tested, live AI extraction unverified

## 2. Nutrition tracking
- ✅ Calories, protein, carbs, fat, fiber daily totals
- ✅ Daily targets (editable via profile calculator)
- ✅ Sugar, sodium (shown only where data exists; unknown ≠ 0)
- ⬜ Vitamins, minerals, micronutrients (USDA API supports it; not yet mapped)
- ⬜ Weekly targets
- ⬜ Nutrient breakdown screens
- ✅ Built-in USDA food database (~13,200 foods incl. mixed dishes), offline, no key
- ✅ Keyless "typical value" from packaged products (Open Food Facts) when several agree (live call unverified — site was busy)

## 3. AI nutrition coach
- ✅ Calorie/macro recommendation (Mifflin-St Jeor formula, not AI)
- ✅ Adaptive calories/macros from real intake + weight trend (energy balance; needs ~4 weeks of mostly-complete logs)
- ✅ Weight-trend analysis, goal forecasting, plateau detection, too-fast-loss warning
- 🟡 Conversational coach (Gemini free tier + food-lookup tool): built and tested with a mocked Google reply; real reply unverified until the user's key is tried
- ⬜ Weekly AI summary notification, saved coach plans, coach controlling the app

## 4. Smart kitchen inventory
- ✅ Manual ingredient add, quantities (g/ml/pcs), expiry dates, expiring-soon boost
- ⬜ Leftovers tracking
- ✅ Fridge/pantry photo recognition: the AI names what it sees and guesses amounts (never nutrition); you confirm and fix every item before it is added. Also: type a list ("6 eggs, paneer 200 g") with no key. Not tested with a live key yet
- ✅ AI recipe idea from your kitchen: the AI may only use Kabe's own ingredient list; unknown ingredients are dropped, the diet is re-checked from the ingredients, and the nutrition is calculated from real food data, not by the AI. Save it as your own recipe. Not tested with a live key yet

## 5. Cook with what I have
- ✅ Recipes ranked from pantry + remaining calories/protein + time + diet (calculated nutrition)
- ⬜ AI-generated recipe ideas from the pantry
- ✅ Budget-aware (cost per serving and protein per ₹ from the user's own prices)

## 6. Meal planning
- ✅ Weekly plan (calorie + protein targets, diet, variety), servings editing, swap, log to diary
- ⬜ Daily/monthly views, macro "optimise" beyond calories+protein, meal-prep mode

## 7. Recipe engine
- ✅ 25 recipes with computed macros, scalable servings, cooking timer, own recipes, favourites (star)
- ⬜ Ingredient substitutions, more regional cuisines, high-protein collection tags

## 8. Groceries & budgeting
- ✅ Auto grocery list minus pantry, categories, piece counts, user-entered prices, weekly budget, "bought → pantry"
- ⬜ Purchase history / price trends

## 9. Workouts
- ✅ Exercise library (42 exercises, filter by muscle, custom exercises)
- ✅ Workout logging: sets, reps, weight (kg), tick to complete, resumes after closing app
- ✅ Rest timer (90 s, ±15 s, skip, vibrates at end)
- ✅ Routines (save from a workout, start in one tap)
- ✅ Progressive overload suggestions (transparent double-progression rule, not AI)
- ✅ History + strength records (estimated 1RM, Epley)
- ⬜ Home-workout programs, AI workout plans, adjustable rest time/units (lb)
- ⬜ Workout form analysis (flagship AI)

## 10. Body tracking
- ✅ Weight log (kg), 7-day trend chart, change since start, per-week change (only when 2 weeks of data)
- ✅ Measurements (waist, chest, hips, arm, thigh) with change vs previous
- ⬜ Progress photos (needs file storage decision)
- ⬜ Body-composition estimate (experimental)

## 11. Recovery
- ✅ Sleep (hours + quality), soreness, tiredness, stress check-in; readiness score; recommendations; rest days; sleep trend/debt
- ⬜ Resting heart rate / HRV (needs wearable or Health Connect)

## 12. Activity
- ✅ Steps (manual), walking, running, cycling, cardio sessions, distance, pace, estimated calories, weekly summary vs WHO guideline, personal bests
- ⬜ Automatic steps (Health Connect / pedometer — needs a development build)
- ✅ Live GPS tracking of runs/rides (also with the screen off in a development build)

## 13. Hydration & supplements
- ✅ Water tracker (quick-add, undo, editable goal; on Today screen)
- ✅ Caffeine log (typical-serving presets, ~400 mg/day guidance note)
- ✅ Supplement checklist and custom daily habits, with streaks
- ⬜ Reminders / notifications (needs a dev build for reliable Android delivery)

## 14. Analytics
- ✅ 7-day calorie chart, averages, days logged
- ✅ Charts and averages (Progress): 7 days / 30 days / 3 months, calorie bars, macro averages vs goals, calorie split, days over goal
- ✅ Weight, workout and active-minute charts on the Charts screen (7 days / 30 days / 3 months)
- ✅ Weekly summary (Progress): this week vs last, what stood out, one thing to try; optional AI wording checked against the numbers
- ✅ "What should I eat next?" (Today): ranked recipes and favourite foods that fit what is left today, one-tap add to diary
- ⬜ Weekly AI summaries, personalised insights

## 15. Community
- ✅ Friends by code, weekly leaderboard and challenge (points, steps, active minutes, days logged), shared meal plans (needs the same Supabase project for everyone; unverified live)
- ⬜ Shared workouts, chat

## 16. Gamification
- ✅ Streaks (log, water, steps, training, check-in), 30 badges, weight/goal milestones, weekly challenges, levels, in-app nudges
- ⬜ Push-notification reminders (needs a development build)
- ⬜ Rewards beyond points/levels (e.g. unlockable themes)

## 17. Restaurant intelligence
- ✅ Menu scan: photograph a menu; the AI only reads dish names, a typical serving, veg/non-veg marks and printed prices (never calories). Not tested with a live key yet
- ✅ Type your order instead ("2 naan, dal"): works with no key; serving sizes are typical guesses you can edit
- ✅ Dishes ranked by what fits the rest of today (calories and protein), with tags (high protein, light, fits, heavy); diet filter (everything, egg + veg, vegetarian)
- ✅ Nutrition from the usual honest chain (bundled USDA → packaged averages → web → labelled AI estimate), looked up when you pick a dish. Dry/raw ingredients are never matched to a cooked dish
- ✅ Always shown as a range (at least ±35%: restaurant oil and portions are unknown); every number is editable
- ✅ Add the order to the diary (marked "restaurant estimate") and save it as "my usual order" to log again in one tap
- ✅ Entry points: Today screen, Add food screen

## 18. Indian nutrition support
- ✅ Starter Indian foods (roti, dal, rajma, idli, dosa, paneer…) with katori/roti servings
- ⬜ Large Indian database (IFCT), regional dishes
- ✅ Hindi / Telugu / Tamil UI on every screen (tabs, Today, Diary, Add food, Me, Train, Workout, Progress, Coach, Kitchen, recipes, Photo, Activity, Recovery, Body, Daily habits, Achievements, Backup), including the 25 built-in recipes' names and method steps, ingredient names, badges and challenges. Translations are written by me and **not yet reviewed by a native speaker**. Exercise names, database food names and technical error messages stay English.
- ✅ Type food names in Hindi / Telugu / Tamil script (about 168 common words, e.g. रोटी, అన్నం, தயிர்) and search/pantry matching finds them
- ✅ Coach replies in the chosen language (set through its instructions; not yet live-tested with Gemini)

## 19. Health & device integrations
- ⬜ Android Health Connect, Apple Health (**needs a development build; not possible in Expo Go**)
- ⬜ Smart scales / wearables

## 20. Personalisation & security
- ✅ Profile + targets
- ✅ Erase-all-data control
- ✅ Smart reminders that skip what you already did today
- ✅ Recipe ingredient substitutions; 32 recipes across more cuisines; leftovers to the pantry
- ✅ Grocery price history and trends
- ✅ Meal plan month view, 30-day plans and meal-prep mode
- ✅ Weekly calorie/protein budget, calories by meal, top foods per nutrient (Charts)
- ✅ "Is my weight on track?" investigator card (Weekly summary)
- ✅ Body-fat estimate (US Navy method, with neck measurement)
- ✅ Voice commands: water, weight, walk/run/ride
- ✅ Colour themes Ocean / Sunset / Berry, unlocked by level
- ✅ Progress photos (private, on this phone only) with before/after
- ✅ GPS route tracking for walk / run / ride (foreground; background in a development build)
- ✅ Local reminders: water, log food, check-in, weigh-in
- ✅ High-protein recipe tag and filter
- ✅ Customise Today: show/hide and reorder the cards (calorie ring stays), saved and backed up
- ✅ Insights card on Today (replaces the coach tab): more / less / improve, rule-based plus optional AI, checked against your numbers
- ✅ About you (Me): goals, struggles, things to keep in mind, goal weight, note
- ✅ Automatic steps from the phone step counter (iPhone whole day; Android while open)
- ✅ Vitamins and minerals (Progress): 12 nutrients vs typical adult daily amounts, AI estimates remembered per food
- ✅ Foods looked up on the internet / by AI (no bundled USDA data); recipes keep a small fixed ingredient table
- ⬜ Training and Coach tabs: hidden on purpose (files kept)
- ✅ Dark mode: Me → Appearance, "Same as phone" (default), Light or Dark, switches the whole app at once and is remembered on this phone. Text colours meet WCAG AA contrast in both modes (tested)
- ⬜ Dashboard customisation, more themes
- ✅ Privacy and your data screen (Me): what is stored, every route that can send data, live on/off, switches
- 🟡 Accounts (needs owner's Supabase project), ✅ data export, ✅ privacy screen

## Flagship AI features
- ⬜ Daily command center · AI coach · Kitchen-to-meal planning · What should I eat next?
- ⬜ Personal meal memory · Progress investigator · Protein-per-rupee optimizer
- ✅ Household planning (shared plans, see Friends) · ⬜ Conversational app control · Workout form analysis
