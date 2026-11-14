# Changelog

## 7.0.4 update — Typed meals, supplement schedules, permissions (2026-11-11)
- **Typing a meal:** write items one per line or separated by commas, with or without amounts (no amount means one usual serving). Add detail in brackets, like "Pepper paneer curry 250 ml (45 g of paneer)" or "150 g curd (loose)": the whole serving stays the amount and the detail changes the nutrition. Each item shows how your note was used, and has a box to add detail afterwards and work it out again. Fixed amounts in g or ml (such as 250 ml) being dropped, and millilitre items now show as ml.
- **Supplements:** choose how often each one is taken: every day with 1 to 6 doses, every few days (every 2, 3, 7, 14, 30 or any number up to 60), chosen weekdays, or only when needed. Reminders skip days it is not due, and streaks skip them too.
- **Supplement ingredients:** the first time you add one, Kabe works out what one dose contains (from its name, or exact numbers from a photo of the label) and every dose you tick adds those vitamins and minerals to Vitamins & minerals.
- **Permissions:** the microphone was refused without ever asking because the photo-picker setting removed the microphone permission from the app; fixed. Every camera, microphone, location and notification request now goes through one helper that asks the phone properly and, if it was turned off, explains and opens the phone's Settings. Setting a reminder now asks for notification permission.
- **Saved meals** open up to show every food in them: change an amount, remove an item, star a single food to keep it in Saved foods, then log it (or save the changes back into the meal). When you save a meal you can also tick which foods to keep on their own in Saved foods. The typing hint is shorter.
- **Reminders show on the lock screen** with their full text, pop up on screen and vibrate (a new high-priority notification channel; the old one is removed).
- **Dialogs match the app:** Delete, Discard and every other confirmation now use the app's own themed dialog (red Delete button, phone back button closes it) instead of the grey system one.
- **Foods saved from a label** now appear under Saved foods straight away and in search. **Nickname:** saved as you type in Settings, shared with the Friends name, and used in the Today greeting.
- **Lighter storage:** the list of remembered foods is capped (starred foods are always kept), the unused USDA key setting is gone, and the cached copy of every scanned picture is deleted when you leave the screen. Photos were never saved by the app. Photo scans look harder at plate size, density and oil, say how each amount was judged, and use a sharper picture. Stale Kitchen card text fixed.
- **Macros:** going over on protein never turns the TV pink (only the keep-under numbers do). Free sugar, carbs, fat and saturated fat show a tiny arrow on Today once their limit is passed, and the coach is told what went over today and on how many of the last 7 days.
- **Fewer AI requests:** foods whose vitamins could not be worked out are remembered for a week instead of being asked about on every visit, and a failed request stops the round instead of repeating for every food.
- **Sync:** the app now checks once a minute (a tiny request) whether your backup changed on another device and pulls it in; if sync is stuck waiting for a decision or failed, Today shows a card that opens the backup screen.
- **Continue with Google** on the sign-in / sign-up screen (needs Google switched on in your Supabase project and the newest build). If an email account with the same verified email already exists, Supabase joins the Google sign-in to that same account, so your data is simply there.
- **Active minutes and km are counted everywhere the same way:** logged walks, runs and workouts, or the walking your steps show (about 100 steps a minute above the first 3,000 a day), whichever is larger for each day. Distance from steps is an estimate. This feeds the Activity week card and charts, Insights, friends, badges and challenges, and the coach.
- **Free sugar limit:** set your own in Me → Set my own targets (default stays 10% of calories). Today and the coach use it.
- **Add exercise:** the "Add your own exercise" row lines up with the rest of the screen.
- **Buy list:** about 270 suggestions now (many more vegetables, fruits, grains and pulses, spices and masalas, proteins, dairy, plus new Oils and sauces and Snacks and drinks groups), all still filtered by your kitchen setup and diet. A **Refresh ideas** button asks the AI for everyday items that go with what is in your pantry and are not already listed. Fixed the Dairy group making the whole suggestions section disappear.
- **Supplements:** each one is a tidy row with a dropdown arrow that opens what is in it, its reminder and edit. The reminder says "Remind me" and, for a supplement taken every few days or on set days, "Only on the days you take it" (it already only fired on those days). Reminder buttons no longer cross the card edge.
- **Free sugar means added sugar only** everywhere: meal and food estimates, label reading (total sugars are never used), the coach and the sugar limit hint.
- Fixed the refresh button on a meal item showing oversized loader dots, and the friends sticker on Me is smaller and centred.
- **Web version:** Kabe now also runs as a website at https://kushalb420.github.io so iPhone users can add it to their home screen (it has its own icon, name and full-screen mode). The privacy policy is public at /privacy.html and was brought up to date (no barcode scanning, Google sign-in, supplement labels, buy ideas). New `scripts/build-web.js` builds the site without the AI key.
- **Trace my route:** the GPS tracker has a new name and a card on Today. When you stop, you get a route poster (the shape of your walk, run or ride with distance, pace and time, in your theme colours) that you can screenshot or share as text. The card can be hidden or moved in Customise Today.
- **Idle reminder:** it now starts counting from the last time you were really walking, read from Health Connect (even while Kabe was closed), and while Kabe is open the live step counter keeps pushing it later. Closed-app walking can only be seen once Kabe next opens or goes to the background.
- **Photo logging:** an optional note box before scanning (what is in the meal, which bowl or plate), a tip to put a spoon or fork next to the food, and your note is given to the AI as a size reference.
- **Learns your portions:** when you save a meal with a named bowl, plate, cup or glass, Kabe remembers your usual amount for that food in that utensil (no AI) and starts from it after two meals.
- **Edit amounts:** the grams box can be cleared or set to 0 (a 0 item is left out when you save), and the edit screen accepts 0. **Change food** on any scanned item replaces it with the food you name and keeps the same grams.
- **Label scan:** Save to my foods keeps you on the page so you can still Save and add to diary (it never creates a second copy).
- **Six new colours** (Mint, Lavender, Sky, Paper, Sand, Coral) in Settings.
- **Goals from your target weight:** add a target weight and Kabe picks lose, maintain or gain for you and shows about how many weeks it takes at a steady pace; choose low, medium or high carb and protein, carbs and fat follow. The activity levels are explained in plain words. The same setup is offered on the first-run screen and in Settings.
- **Carb levels fixed:** low carb now also raises protein (about 30% of calories, as low-carb plans do), while medium and high carb keep the same protein and differ in carbs and fat. **Friends:** Save and share my week no longer says "Type a name" when the box was pre-filled with your nickname.
- New bento-box app icon and splash. The Account screen's Continue button no longer stretches.

## 7.0.0 — Kitchen from your pantry, notifications, workouts, account (2026-11-10)
- **Kitchen rewritten.** No built-in recipes. Tell Kabe what is in your pantry (type or photo), press Enter, and get a wide list of meals with the same seven nutrients; the full recipe is written only when you open one, with a mini chat for "how do I…" and swaps. Missing ingredients become a buy list, with ideas of what to buy to unlock more meals. "Fit my remaining calories" now filters to your remaining calories. Set your fridge, stove, kettle and so on in Me, so ideas fit your kitchen.
- **Meals:** the Kitchen, Eating out and What-to-eat-next cards are now one Meals card on Today. Barcode scanning and all pre-added foods are removed; Log food has a "Describe" tab (with Scan your plate) and a "My foods" tab that searches only your own past meals, favourites and saved meals.
- **Notifications** screen: master switch, daily nudges, habit and supplement reminders that repeat until you tap Done (Snooze too), your own reminders, and an idle nudge after an hour without movement. Summary of everything in Settings.
- **Workouts tab** is back, with your own splits (name, exercises, sets) you can edit. **Progress** is now **Health**.
- **Friends** no longer vanish; a Friends card on Me lists everyone, the Friends screen lets you open and remove them. **Account:** sign in or create an account; your data comes back on a new phone.
- **Today hero:** a glass that fills as you eat; tap it to flip between calories, protein, carbs and fat.
- Set your own macro goals in Me.
- **Today hero is a little retro TV** with a smiling face, scanlines, knobs and a calorie ring around the screen; tap it to flip between calories and macros.
- **Eating out is instant:** dishes are ranked by the calories of one basic serving (read with the menu in the same single call; typed lists take one batch call). Full nutrition is worked out only for dishes you pick.
- **Buy list** suggests items that fit your kitchen setup, fridge and diet, and you can add your own. Kitchen setup moved to Settings (still asked the first time you open Kitchen).
- **Coach** answers in plain text and offers to update your goals when its advice implies new targets (it asks first).
- Body fat uses the sex you pick on that card; entering hips never changes it.
- **Motion:** screens slide in; titles drift and fade as you scroll. **Workouts:** tap a personal record to see its progress bars.
- **Smaller, same speed:** release builds are minified and resource-shrunk, and built for 64-bit phones only (nearly all phones since 2019).
- **Accuracy:** food and kitchen prompts now tell Gemini to use IFCT/USDA reference values for the food as eaten, including oil and ghee, and to keep kcal consistent with the macros.

## 6.0.0 — Gemini only, calculating screen, Meals tab (2026-11-10)
- **One source for nutrition: Gemini.** Web search, Open Food Facts and the bundled USDA list are gone. Typed lists, photos, spoken meals, food search, restaurant dishes and the coach all use Gemini through your backend. Every answer is checked before it is shown: impossible numbers are rejected, saturated fat is never above total fat, free sugar and fibre never above carbs, and calories are reconciled with the macros.
- **Log by listing what you had** (type, speak or photograph). A **calculating screen** (moving foods you can tap, four steps) shows while everything is worked out; nothing can be edited until it is complete. Then each food has its amount with a stepper and a grams box, a note when the amount was assumed, a total for the whole meal, and the meal to log it under. An amount you typed ("2 rotis") is read from your own words and never asked again.
- **Single numbers, no ranges, no "estimate" wording** anywhere in the app. Photo logging gives one best number per food.
- **All seven nutrients everywhere:** calories, free sugar, protein, carbohydrates, fibre, saturated fat, total fat, on Today, in the review, and in Meals for every meal and the whole day. Older entries and built-in foods get free sugar and saturated fat filled in quietly.
- **Today:** the streak is a chip at the top (tap it for achievements); the fat bar shows saturated fat in its own colour; the streak, extras and insights cards are gone.
- **Meals tab** (was Diary): Kitchen, Eating out and What to eat next moved here.
- **Progress** now starts with the insights card, which opens a chat with the Kabe coach.
- **Barcodes for any product:** scan; if anyone has added it you get it instantly, otherwise read its label once and it is saved for everyone (shared table `kabe_products`). The label reader also reads saturated fat and added sugar.
- **Reminders for each habit and supplement** (Habits screen: tap the bell, set a time); skipped once ticked off today.
- **No dark mode.** Customisation lives in **Settings** (language, colour theme, Customise Today, About you, Reminders, backup, privacy).
- **Motion:** cards slide in one after another, rings and bars fill, numbers count up, tab icons hop. All timing in one config.
- **Nothing hard-wired:** `src/config/app.ts` holds colours, themes, box style, motion, nutrition limits, AI settings, feature switches and tabs (docs/CUSTOMIZE.md).
- Honest limits: Gemini cannot identify a product from barcode digits alone, so a brand-new product needs one label photo. Nutrition numbers still come from a language model: Kabe checks they are possible and consistent, but cannot verify them against a lab table.

## 5.1.1 — Backend deployed and tested live (2026-11-10)
- Created the Supabase project `kabe` (ref zgdzipvoagyihnzvritr, Mumbai, free plan), ran `supabase/schema.sql`, enabled anonymous sign-ins and turned off email confirmation (`supabase/config.toml`), stored the Google key as a server secret and deployed the `ai` Edge Function.
- **Checked live:** guest sign-in, an AI request through the proxy (and a 401 without a session), friend codes, a two-way board, shared plans and the wrong-code message. Re-run with `npx tsx scripts/live-backend-check.ts` and `scripts/live-friends-check.ts`.
- Still unrun: a real build on a phone, and the in-app flows against this backend.

## 5.1.0 — Built to deploy (2026-11-10)
- **Not tied to Expo Go any more.** Development and release builds are the way to run Kabe (docs/DEPLOY.md). Added `expo-dev-client`, `eas.json` (development, preview APK, production AAB), app ids `app.kabe.fitness`, automatic dark mode, a yellow splash screen, a new K app icon set (`node scripts/make-icons.js`) and blocked unneeded Android permissions. A native prebuild was generated and its manifest checked: background location, the location foreground service and Health Connect's permission screens are present.
- **Your own backend, no key in the app:** a Supabase Edge Function (`supabase/functions/ai`) holds the Google key as a server secret and forwards AI requests, with a per-person daily limit (`kabe_ai_hit` in the setup SQL). The app sends each request with a session token. Without a configured backend the old direct-key path still works for development.
- **One app-owned Supabase for everyone:** set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` and the Cloud screen has nothing to configure. Every install gets an anonymous guest session, so **AI, friends and shared plans work for everybody with no sign-up**. Creating an account upgrades the same user (friends are kept) and is what turns on backup; guests are never backed up.
- **Welcome screen** for first launch (badge, big heading with an outlined word, buttons, three feature cards) in all four languages; existing users skip it. The 32px dot pattern now sits behind the yellow pages.
- **Docs:** docs/DEPLOY.md (full release guide) and docs/PRIVACY_POLICY.md (text to host for Google Play and Health Connect).
- **Not verified:** no build was made (no Android SDK on this machine and EAS needs your Expo login), and the backend never ran against a live Supabase project: tests use fakes. Expect small first-deploy fixes.

## 5.0.0 — A bold new look (2026-11-10)
- **Neo-brutalist design for the whole app:** yellow pages (#FFE17C), white cards, 2px black borders, hard blur-free offset shadows, and buttons that press into their shadow. Dark mode uses charcoal (#171E19) with sage (#B7C6C2) borders and yellow highlights. Buttons and tabs are geometric (12px corners at most).
- **Fonts:** Space Grotesk for headings and bold labels, DM Sans for body text. These are free stand-ins for Cabinet Grotesk and Satoshi (which are not in Expo's free font packages); swap them in `src/lib/fonts.ts` if you add those font files.
- **Colour themes** now tint the page instead of recolouring buttons: Yellow (default), and Sage, Peach, Pink unlock at levels 3, 5 and 7 (the saved ids are unchanged).
- Shared pieces: `HardShadow` (the offset shadow is a real view behind the box, so it looks the same on iOS and Android), `Text`/`TextInput` wrappers that apply the fonts, and a tested font picker. All contrast pairs still pass in every theme and both modes.
- Not done: the landing-page-only parts of the design brief (marquee, hero mockup, pricing-style sections) have no place in a mobile app.

## 4.4.1 — Live AI check, tidier Progress (2026-11-09)
- **Checked live with a real key:** the key works, a spoken-style meal ("two rotis and a bowl of dal") is parsed into foods with amounts, a web food lookup returned numbers read from a page (paneer butter masala, 176 kcal per 100 g), and vitamin values for spinach came back in sensible ranges. Run it yourself any time: `npx tsx scripts/live-ai-check.ts` (uses your free quota; not part of npm test). Photo, menu, label, fridge and audio paths still need a real photo or recording, so they are unchecked.
- **Progress** is now the same tidy list as Me (Charts, Weekly summary, Body, Activity, Recovery, Vitamins, Photos) and the "more coming later" line is gone.

## 4.4.0 — No key to paste, a calmer app (2026-11-09)
- **AI for everyone, nothing to set up:** the "paste your Gemini key" card is gone from Me. The AI key is built into the app from `.env` (`EXPO_PUBLIC_GEMINI_KEY`, see README). AI sharing is on by default for everyone (switch off any time in Me → Privacy); phones that had it off before are moved to the new default once. Messages no longer mention keys.
- **Me tab is a short list:** your calculator first, then About you, Reminders, Friends, Cloud backup, Language and appearance (new screen), Privacy. The raw SQL text on the cloud screen is gone (use "Share the SQL").
- **Today puts logging first:** Log food and Scan plate now sit under the calorie ring, then macros, water, activity and insights. Anyone who never customised the old order gets the new one.
- Honest note: AI food numbers remain labelled estimates; Kabe cannot make them exact. Numbers from the built-in foods and recipe table are exact to that table.

## 4.3.0 — Background GPS, friends and shared plans (2026-11-09)
- **GPS with the screen off:** Track a route now asks for "all the time" location and runs a small background service with a notification, so locking the phone or opening another app no longer stops it. The route is rebuilt from the saved points with the same accuracy and jump checks, and reopening Kabe picks a running session back up. In Expo Go, or if you decline the permission, it quietly falls back to the old keep-it-open tracking. Needs a development build to run in the background (docs/DEV_BUILD.md); not run on a real device.
- **Friends and a weekly challenge** (Me → Friends, shown when you are signed in to cloud sync): pick a name, get an 8-character friend code, add friends by their code, and compare points, steps, active minutes and days logged for the current Monday-to-Sunday week. Only your name and those four totals are shared; never food, weight or photos. Points: 1 per 1,000 steps, 1 per 10 active minutes, 5 per day you log food.
- **Shared meal plans:** share your next two weeks of plan, and copy a friend's (or household member's) day into your own plan with one tap. Plans are checked on arrival (real dates, known recipes, sensible servings).
- **Honest limit:** Kabe has no server of its own, so everyone has to sign in to the same Supabase project. The owner shares the project URL and public key and each person makes an account there. All access goes through six SQL functions that check who is asking (the tables have no direct access); run the updated setup SQL once (docs/SUPABASE_SETUP.md). Written and unit-tested with fakes; not run against a live Supabase project.
- New: `gpsSession.ts`, `gpsTask.ts`, `social.ts`, screen `friends`; tests in `test-gps.ts` and `test-social.ts`; strings in Hindi, Telugu and Tamil.

## 4.2.0 — Account deletion and Health Connect (2026-11-09)
- **Delete my account** (Me → Backup): erases your cloud backup and the Supabase account itself through a SQL function (`delete_my_account`) in your own Supabase project. No admin key is ever inside the app. If you set Supabase up earlier, share and run the setup SQL again once (docs/SUPABASE_SETUP.md).
- **Whole-day Android steps with Health Connect** for a development build (docs/DEV_BUILD.md). It is loaded lazily and fails quietly, so Expo Go behaves exactly as before. Written and unit-tested with fakes; not run on a real device.

## 4.1.0 — Kitchen and reminders, finished (2026-11-07)
- **Smart reminders:** the next 7 days are scheduled as one-off times and rebuilt whenever Kabe opens or you log something, so a reminder is **skipped for today once you have already done it** (food logged, check-in done, weighed, water goal reached). Open Kabe at least once a week to keep them coming.
- **Recipe substitutions:** on a recipe, tap a swap chip (dal ↔ dal, chickpeas ↔ rajma, paneer ↔ chicken, oil ↔ ghee, and more). Nutrition is recomputed, a note says what changes, vegetarians are never offered chicken, and the recipe's diet label follows the swap.
- **Seven new recipes from six more cuisines** (Tamil sambar, Telugu tomato pappu, South Indian lemon rice, Gujarati kadhi, Maharashtrian sprouts usal, Mediterranean chickpea salad, Kerala egg roast), translated into Hindi, Telugu and Tamil. 32 recipes in all.
- **Leftovers:** cook more servings than you eat, then "Save the other servings as leftovers": they go to the pantry for 3 days and never count as raw ingredients.
- **Grocery price history:** each time you change a price it is remembered, and the grocery list shows how it moved ("up 12% since 2026-10-01"). Included in cloud backup.
- **Meal plan:** a month calendar with a dot on every planned day (tap a day to open it), "Plan the next 30 days", and **meal prep** (one dish cooked once, planned for 2 to 5 days).
- New: `prices.ts`, additions to `recipes.ts`, `mealPlan.ts`, `reminders.ts`. Tests for each; strings in Hindi, Telugu and Tamil.

## 4.0.1 — Found the lost screens (2026-11-07)
- **Activity (steps, GPS route tracking) and Recovery (morning check-in, sleep) had no way in** after the Training tab was hidden. They now have cards on Progress, and Today has a new "Steps and activity" card (customisable like the others; an older saved Today layout gets the new card added at the end).

## 4.0.0 — Everything that did not need the owner (2026-11-06)
- **Charts and averages:** a calendar-week **budget** (7 × your daily goal, what is used, what each remaining day can have, protein for the week), **calories by meal**, and the **foods that gave most of your calories and protein**.
- **Weekly summary:** a "Is your weight on track?" card (trend, measured daily burn, goal-date projection, a warning when weight is dropping too fast) using the coach's existing analysis.
- **Body-fat estimate** (Progress → Body): the US Navy tape-measure method from waist, neck (new measurement) and hips (women) plus your height, shown as a range with a plain category and a clear "estimate" note. Impossible measurements give no number instead of a guess.
- **Voice commands:** "drank 2 glasses of water", "I weigh 72.5 kg", "walked 30 minutes", "ran 5 km in 28 minutes" are recognised in the voice screen and shown for confirmation before saving. If the AI is unreachable the voice screen now falls back to the simple reader instead of showing an error.
- **Colour themes:** Forest (default), **Ocean (level 3), Sunset (level 5), Berry (level 7)** unlock as you level up (Me → Appearance). Every theme passes the contrast tests in both light and dark.
- **Progress photos** (Progress): take or choose photos, a before/after of your first and latest with the nearest weigh-ins, delete one by one. Kept only in the app's private storage on the phone: never uploaded, synced or sent to the AI; removed by "Erase all my data".
- **GPS route tracking** (Activity → Track a route): walk, run or ride with live time, distance and pace/speed, saved to your activity. Inaccurate fixes and impossible jumps are rejected. Foreground only: keep Kabe open.
- **Reminders** (Me → Reminders): water (four times a day), log your food, morning check-in, Sunday weigh-in, scheduled by the phone itself; nothing goes to a server.
- **High-protein recipes:** a tag on recipe cards and an "only high-protein" filter in Cook.
- Housekeeping: installed the `expo-asset` peer dependency the voice recorder needs (expo-doctor now passes 20/20); an Android bundle builds (8.2 MB, smaller since the food database left).
- New: `stats.ts` additions, `bodyfat.ts`, `commands.ts`, `progressPhotos.ts`, `photoFiles.ts`, `gps.ts`, `reminders.ts`, `palette.ts` themes, screens `photos`, `track`, `reminders`, `ReminderScheduler`. Tests for each; strings in Hindi, Telugu and Tamil.

## 3.2.0 — Customise Today (2026-11-05)
- **Today → "Customise this screen":** switch each card on or off (macros, sugar and salt, streak and level, kitchen, insights, what to eat next, eating out, water and habits, the log-food and scan-plate buttons) and move them up or down. The calorie ring always stays. "Back to default" restores everything. The layout is saved on the phone and included in cloud backup; cards added in a later version appear at the end instead of vanishing.
- New `src/lib/dashboard.ts` (tested, `scripts/test-dashboard.ts`), `app/customize.tsx`; the Today screen now builds its cards from the saved layout. Strings in Hindi, Telugu and Tamil.

## 3.1.0 — Calorie target suggestion is back (2026-11-05)
- The Insights card on Today now also shows the calorie target Kabe would suggest from your weight trend and logs (or the standard formula when there is too little data), with the reason, and a button to adopt it (protein, carbs and fat are re-balanced). It appears only when your profile is filled in and the suggestion differs from your current goal by 100 kcal or more. This was the one coach feature that lost its screen when the Coach tab was hidden.

## 3.0.1 — Clean-up (2026-11-05)
- Badges and the weekly challenge that only workouts could earn are hidden (kept in `gamify.ts`, easy to bring back). Wording about training, workouts and the coach was removed from recovery, achievements, the AI settings, the weekly summary and the privacy screen. The weekly table hides its workouts row when there are none.

## 3.0.0 — Your way: insights, steps, no USDA (2026-11-05)
- **Training and Coach are gone from the app** (the tabs are hidden; every file is kept). Four tabs remain: Today, Diary, Progress, Me. The weekly summary no longer mentions strength workouts when there are none.
- **Insights card on Today** replaces the coach: "Eat or do more of", "Have less of", "Where to improve". Quick rule-based tips always show (protein, fibre, sugar, salt, calories, one food dominating, snacks, steps, logging). With your Gemini key and agreement, the AI writes them for you from your last 14 days, your goals and what you told Kabe; its text is **rejected if it uses any number that is not in your data**. Cached per day so the free quota is not wasted.
- **Me → "Tell Kabe what you want" (About you):** goals (up to 4), what makes it hard, things to keep in mind (diabetes, BP, thyroid, PCOS, cholesterol, lactose, gluten, nut allergy), goal weight (moved here from the coach), and a short note. Tailors the tips; the AI only ever receives it as quoted data.
- **Automatic steps:** reads the phone's built-in step counter after asking permission (on by default, switch in Activity). iPhone reads the whole day; Android counts while Kabe is open (a full-day history needs a development build with Health Connect).
- **No USDA data in the app any more.** The 13,000-food file is no longer bundled (the file stays on disk). Recipes use a small fixed table of their 35 ingredients. Everything else is looked up on the internet: web pages first, then a clearly labelled AI estimate, in search, photo, voice, restaurant and the food picker. No "not found" / "no match" style messages remain: you see "Looking this up…", a tap-to-retry line, or how to switch lookups on.
- **Vitamins and minerals (Progress):** iron, calcium, magnesium, potassium, zinc, vitamins A, C, D, B12, E, K and folate for today or the last 7 days, as a share of a typical adult day. Per-100 g numbers come from the AI (impossible values are dropped, a food with too little data is skipped), once per food, remembered on the phone and erased with "Erase all my data".
- New: `insights.ts`, `intent.ts`, `steps.ts`, `micro.ts`, `foodOnline.ts`, `ingredientFoods.ts`, `microCache.ts`, screens `about` and `micros`, `InsightsCard`, `StepCounter`, `OnlineFoods`. Tests for each; strings in Hindi, Telugu and Tamil.

## 2.5.0 — Privacy and your data (2026-11-05)
- **Me → Privacy and your data:** one screen that lists the only four ways anything can leave the phone (Google Gemini for AI features, web search for foods missing from the database, Open Food Facts for packaged foods/barcodes, and your own Supabase sync), says exactly what each sends and when, and shows a live On / Off / "When you use it" badge for each. Also what is stored on the phone (counts) and your switches: stop sharing with Google, remove the Gemini key, cloud sync settings, export, erase everything.
- **Fixed while building it:** two places used your Gemini key without the AI-sharing agreement: the restaurant dish lookup (web search + AI estimate) and the fridge recipe idea. Both now need the agreement. The coach chat keeps its own agreement, which the privacy screen counts too.
- New `src/lib/privacy.ts` (tested, `scripts/test-privacy.ts`), `app/privacy.tsx`, strings in Hindi, Telugu and Tamil.

## 2.4.0 — Weight, workout and activity charts (2026-11-05)
- **Progress → Charts and averages** now also shows, for the chosen period (7 days / 30 days / 3 months): your **weight** (dots for each weigh-in plus a smoothed line, and the change from first to last weigh-in), **strength workouts** per day or per week, and **active minutes** per day or per week (walks, runs, rides, cardio) with the WHO 150 minutes a week line on the weekly views.
- Weekly bars only use **complete 7-day weeks** counted back from today (30 days = 4 weeks, 3 months = 12), so no bar quietly covers fewer days. A chart only appears when there is something to show; the screen no longer hides weight/workout/activity charts when no food is logged.
- Tested in `scripts/test-stats.ts` (`countsPerBucket`); strings in Hindi, Telugu and Tamil.

## 2.3.0 — What should I eat next? (2026-11-05)
- **Today → "What should I eat next?":** shows what is left of today's calories and protein, a good size for the next meal (what is left split over the main meals still to come, capped at 900 kcal) and up to 6 ideas: your own recipes (diet filter respected, sides left out, 0.5 to 2 servings picked to fit) mixed with your favourite and recent foods. Each shows calories and macros, why it was picked (good protein, light, filling, you have the ingredients, from your favourites) and an **Add to diary** button that logs it to the right meal for the time of day.
- **Honest:** nothing is invented and no AI or internet is used. Numbers are the recipe maths / food database numbers; recipes with unresolved ingredients are never suggested; once your calorie goal is reached it only offers small options (up to 250 kcal); portions never exceed 15% above the meal budget.
- New `src/lib/next.ts` (tested, `scripts/test-next.ts`), `app/next.tsx`, strings in Hindi, Telugu and Tamil.

## 2.2.0 — Weekly summary (2026-11-05)
- **Progress → Weekly summary:** the last 7 days next to the 7 days before (average calories and protein, days logged, workouts, active minutes, sleep), "what stood out" (plain observations such as calories vs goal, protein, workouts, active minutes vs the WHO 150-minute guide, sleep, weight change) and **one thing to try** next week, chosen by a fixed priority (log more → eat enough → portions → protein → sleep → move → keep going).
- **Works without AI.** With a Gemini key and consent, "Write it in my words" asks the AI to re-word the facts. Only the numbers are sent (never food names or notes), and the AI's text is **rejected** if it contains any number that is not one of the facts (Hindi/Telugu/Tamil digits are checked too).
- Honest by design: food conclusions need at least 3 logged days, one night of sleep or one weigh-in says nothing, empty days are "no data". It states information, not medical advice.
- New `src/lib/weekly.ts` (tested, `scripts/test-weekly.ts`), `app/weekly.tsx`, `writeWeekly` in `vision.ts`, strings in Hindi, Telugu and Tamil.

## 2.1.0 — Charts and averages (2026-11-05)
- **Progress → Charts and averages:** pick 7 days, 30 days or 3 months. Calorie bars with your goal line (daily for a week; 5-day and 15-day averages for longer views), average calories, days logged, days over goal (more than 10% above), days the protein goal was reached (90%+), average protein/carbs/fat against your goals, and where your calories come from (protein/carbs/fat share) next to your goal's share.
- **Honest averages:** days with nothing logged are "no data", not 0, so skipping a day never pulls an average down. A one-line observation (over, under, low protein, steady) appears only with 3+ logged days and is plain information, not advice.
- New `src/lib/stats.ts` (tested, `scripts/test-stats.ts`), `app/stats.tsx`, strings in Hindi, Telugu and Tamil. Also fixed a type error in the voice screen.

## 2.0.0 — Voice logging (2026-11-05)
- **Speak or type a meal:** a mic icon on the add-food screen opens one box. Type or dictate (tap the mic on the phone keyboard, free and on-device) a sentence such as "two rotis with dal and a glass of lassi for lunch". Kabe finds the foods, rough amounts and the meal, then shows the same check-and-edit list as photo logging before anything is saved.
- **With a Gemini key (and consent):** the AI only names foods and guesses amounts; there is also a Record button (expo-audio) that sends a short recording to the AI to transcribe and extract. **Without a key:** a rule-based parser handles counts, number words (incl. ek/do/teen), fractions, g/kg/ml, cups/glasses/bowls/katori, "without sugar", negations and plans.
- **Honesty:** nutrition always comes from the databases (never from the AI); dishes never match dry ingredients (dal is cooked dal); amounts you did not say are typical servings marked low confidence; calories show as a range; diary rows say "from your words".
- New `src/lib/voice.ts` (tested, `scripts/test-voice.ts`), `app/voice.tsx`, `understandMeal` in `vision.ts`, strings in Hindi, Telugu and Tamil.

## 1.9.0 — Dark mode (2026-11-05)
- **Me → Appearance:** "Same as phone" (default), Light or Dark. The whole app switches at once, with no restart, and the choice is remembered on this phone only (not synced).
- **How it works:** two palettes with identical names (`src/palette.ts`); every screen and component now reads colours through `useColors()` / `useThemedStyles(makeStyles)` instead of a fixed colour object (36 files converted by a one-off script, then checked by hand). The status bar, tab bar, screen backgrounds and the navigation layer follow the theme too (no white flash between screens).
- **New colour roles** so text stays readable on both: `onPrimary` (text on green buttons, dark on the lighter dark-mode green), `warn` (orange *text*; the old orange was only 2.3:1 on white), `good`, `info`, `strong` (the rest-timer bar, deep green with white text in both modes) and `cardBorder` (cards get a faint outline in dark mode).
- **Contrast is tested:** `test-theme.ts` checks 36 text-on-background pairs reach WCAG AA (4.5:1) in both palettes. It found one existing problem, the light-mode error red (4.1:1 on the page background), now slightly darker.
- **The test also guards the future:** it fails if any screen imports a fixed `colors` object, hard-codes a white background, or has styles that never receive the palette.
- No change to any feature or data.
- **Checked:** Today, Me, Kitchen, recipe, Progress and Add food in dark mode by eye in the browser, switching live; a script scanned 8 more screens for leftover bright backgrounds (none). **Not checked on a real phone.**

## 1.8.0 — Nutrition label scan (2026-11-04)
- **Scan a label** (Add food → document icon, or "Not found? Read the nutrition label instead" after a barcode miss): photograph the nutrition table on a pack. The AI only **transcribes** the printed numbers, like OCR: it is told to answer "unknown" for anything unreadable and never to calculate, convert or use its own knowledge. Printed numbers outside possible ranges become unknown.
- **You review everything:** product name, "per 100 g / ml" or "per serving" (with the serving size), calories, protein, carbs, fat, and optional fibre, sugar and sodium. Empty boxes stay empty: unknown is never turned into zero.
- **Per serving → per 100 g** conversion is done by Kabe; a per-serving label with no serving size is not converted and asks for it.
- **Consistency checks** (shown as warnings, you decide): calories vs protein/carbs/fat (4/4/9, with rounding allowance), sugar or fibre above total carbohydrate, more than 100 g of nutrients in 100 g, more than 900 kcal per 100 g, unclear column, missing calories.
- **Calculate calories** button for labels where calories are unreadable: computed from the macros and clearly marked "calculated, not printed".
- **Save** to your own foods (searchable any time) or **save and add to the diary** with the amount you eat; one serving logs exactly what the label says. Drinks: 100 ml is treated as 100 g.
- **Type the label yourself** works with no key. Hindi, Telugu and Tamil for all of it. New `test-label.ts`.
- **Not verified:** reading a real label photo with a live Gemini key.

## 1.7.1 — Lint is clean (2026-11-04)
- `npx expo lint` and `npx eslint app src scripts` now report **0 problems** (it was 13 in the app plus 16 in the test scripts).
- **No feature changes.** The fixes, by pattern:
  - *Reading the clock while drawing* (coach chat ids, "synced 3 min ago", the workout and recipe timers): a tiny `src/lib/clock.ts` helper, and `useState(nowMs)` instead of `useState(Date.now())`.
  - *Timers that set state from an effect* (rest timer, recipe timer): one timeout for the exact finish time instead of polling a clock value; same buzz, same behaviour.
  - *Number box* (`NumBox`): shows what you type while editing and the real value otherwise, instead of copying the value into state from an effect.
  - *Grocery list*: category headings come from the previous row instead of a variable changed while drawing.
  - *Cloud store*: the "latest data" ref is updated in an effect, and the signed-in user is restored from promise callbacks. Checked with the sync tests; **not run against a real Supabase project** (never has been).
  - Removed one unused function; test scripts: imports moved to the top, an unused counter removed, Node's `Buffer` declared.
- Checked in the browser: recipe timer counts down, edit-entry boxes follow the grams and accept your own numbers.

## 1.7.0 — Fridge scan and AI recipe ideas (2026-11-04)
- **Scan your fridge** (Kitchen → Pantry → "Scan your fridge or type a list"): the AI names what it sees and guesses amounts (pieces, grams or ml). It is never asked for nutrition. You review every item: untick what is wrong, fix amounts and units, mark things to **use soon** (expire in 3 days, so Cook favours them). Nothing is added until you confirm.
- **Or type a list** with no key: "6 eggs, paneer 200 g, 2 kg onion, milk 1 l, tomatoes". Handles kg/g/ml/l/pieces, decimal commas (1,5 kg) and Hindi/Telugu/Tamil names; a missing amount gets a typical guess marked low-confidence.
- Items Kabe knows (38 recipe ingredients) are matched automatically ("Counts as Tomato"); anything else (jam, sauces) is still saved but flagged as not usable by recipes yet.
- **AI recipe idea** from your kitchen: the AI may only choose from Kabe's own ingredient list. Unknown or absurd ingredients are dropped and reported, weights are clamped, the diet is **recomputed from the ingredients** (a recipe that breaks your diet is rejected), and the calories/macros are **calculated from real food data**, never taken from the AI. Marked "untested recipe", answers in your language, save it as your own recipe (starred in Cook).
- Hindi, Telugu and Tamil for all of it. New `test-fridge.ts`: parsing, amount limits, typed lists, matching, "use soon", recipe validation, diet rules, prompt contents.
- **Bug found by the tests and fixed:** "1,5 kg potato" was split into two items at the comma.
- **Not verified:** a real fridge photo and a real AI recipe with a live Gemini key.

## 1.6.0 — Eating out: restaurant menus (2026-11-04)
- **Scan a menu** (Today → "Eating out?", or the shop icon in Add food): the AI reads dish names, a typical serving in grams, veg / egg / non-veg marks and printed prices. It is never asked for calories; nutrition comes from the same honest chain as plate photos (bundled USDA, packaged averages, web pages, a clearly labelled AI estimate) and is looked up only for the dishes you pick, to save free-tier AI calls.
- **Or type your order** ("2 naan, dal, mango lassi"): works with no key. A leading number multiplies a typical serving; you can change every gram and every number.
- **Ranking:** dishes are ordered by what fits the rest of your day (calories left split over the meals still to eat, capped at 900 kcal for one meal, plus protein share). Tags: high protein, light, fits, heavy, no numbers yet. Diet filter: everything, egg + veg, vegetarian. Dishes without numbers go last, never guessed.
- **Honest ranges:** a restaurant dish is shown with at least ±35% (unknown oil, recipe and portion); AI estimates stay wider; numbers you typed count as nearly exact.
- **Bug found while testing and fixed:** "dal" matched *dry raw lentils* (352 kcal per 100 g) and a cooked 250 g serving came out as 880 kcal. Dry, raw, flour and powder entries are now never matched to a dish.
- **Order:** add the picked dishes to the diary (marked "restaurant estimate") and **save as my usual order**; saved orders are listed on the screen and in Add food, one tap to log again.
- Hindi, Telugu and Tamil for all of it; new test file `test-menu.ts` (parsing, typed orders, ranking, diets, totals, saved items, the raw-ingredient guard).
- **Not verified:** reading a real menu photo with a live Gemini key (only fake AI answers were tested).

## 1.5.0 — Indian languages everywhere (2026-11-04)
- **Every screen now follows the language picker** (Hindi, Telugu, Tamil): Train, live workout, exercise picker, Progress, Coach (analysis cards, safety text, quick questions), Kitchen (Cook, Plan, Groceries, Pantry), recipe view and editor, Photo scan, barcode scan, edit entry, save meal, Body, Daily habits, Activity, Recovery, Achievements, Backup & sync, Me, plus the nudge, badges and challenges on Today.
- **Built-in recipes translated:** all 25 names and method steps, 38 ingredient names, cuisines and grocery categories. Your own recipes keep what you typed.
- **Badges:** 30 badge names and descriptions, 8 weekly challenges and all unit words.
- **Logic stays tested in English:** the coach, recovery and workout code still returns its English sentence (tests read it) and now also a code the screen turns into the chosen language (`TdeeResult.code`, `TargetSuggestion.noteCode`, `recommend().codes`, `Suggestion.why`, `NudgeInfo`).
- **Tests:** i18n test grew to 749 keys × 3 languages. It now also checks that every ingredient, cuisine, recipe (with the same number of steps as English), badge, challenge and unit has a translation in the right script, and that every code the logic can produce has a message.
- **Not translated on purpose:** exercise names, food names from the databases, the source labels on looked-up foods, and technical error text from servers. The AI coach answers in your language through its instructions (not live-tested without a key).
- **Honest limit:** all translations were written by me, not a native speaker. Please read them and tell me what sounds wrong or unnatural.
- Lint: 13 findings remain (all React-compiler style rules in older code), listed in BACKLOG.md.

## 1.4.0 — Indian languages (2026-11-04)
- **Language picker** in Me: English, हिन्दी, తెలుగు, தமிழ். Stored on this device only (not synced).
- **Translated screens:** tab bar, Today (including streak, level and motivational nudge), Diary, Add food, Me. Other screens stay English for now.
- **Indian food words:** type foods in Devanagari, Telugu or Tamil script (about 168 words such as रोटी, అన్నం, தயிர், துவரம் பருப்பு). They are mapped to English food names for search, Add food and pantry/recipe matching. English search is unchanged.
- **Coach** is told to reply in the chosen language; safety rules unchanged.
- **Tests:** new `test-i18n.ts` (key and placeholder parity across languages at compile and run time, correct script per language, every `t('…')` used in code exists, no unused keys, native-script search). Missing keys fall back to English.
- **Honest limits:** translations were written by me, not a native speaker, so please read them and tell me what sounds wrong. Badge names, Kitchen, Activity, Recovery, Coach UI, Photo, Backup and Achievements screens are still English. The large IFCT Indian database is not built.
- Added ESLint dev dependencies via `expo lint` (see BACKLOG: 55 existing findings).

## 1.3.0 — Stage 9: Streaks, badges & challenges (2026-11-04)
- **Streaks** for food logging, water goal, step goal, training and morning check-ins: current and best. A streak stays alive until the end of today (log any time), and breaks only after a full missed day.
- **30 badges** (bronze/silver/gold) across Logging, Nutrition, Training, Activity, Body, Recovery and Kitchen, each with a progress bar until earned and the date once earned. Examples: One week strong (7-day log streak), Protein pro, 5K / 10K, WHO week (150 active min in 7 days), First 2 kg toward your goal, Goal weight reached, Home cook.
- **Weekly challenges** (3 per Monday–Sunday week, rotating): e.g. log food 6 days, hit step goal 4 days, 3 workouts, 150 active minutes. Progress counts only the current week.
- **Levels & points** (bronze 10 / silver 25 / gold 50 / challenge 10) with titles Starter → Legend.
- **Nudge** on the Today card: streak-at-risk reminder, "N more to unlock X", or one-more-to-finish challenge. In-app only (phone notifications need a development build).
- Today screen: new streak/level card with 🎉 banner for badges earned today; Achievements screen shows everything.
- Everything is **derived from your real logs** by tested pure functions, so it can't be faked; only the earned date is saved, so earned badges survive deleting old entries. Weight milestones only count movement toward your goal's direction. Included in backup/export/sync.
- Tests: `scripts/test-gamify.ts` (streak edge cases, every badge rule, rolling WHO window, week boundaries, challenge rotation, levels incl. past level 10, nudges). Found and fixed a level-calculation bug (stopped at 10).
- Not built: friends, group challenges and leaderboards (need cloud accounts), phone push reminders.

## 1.2.0 — Stage 8: Recovery & activity (2026-11-04)
- **Train tab** now has Recovery and Activity cards (readiness score, steps today).
- **Recovery:** 30-second morning check-in (hours slept, how rested, soreness, tiredness, stress) → a 0–100 readiness score with a plain recommendation (push / controlled / easy day / rest day) and specific tips (short sleep, very sore → names the muscle groups you trained yesterday, 4+ hard days in a row, high stress). Rest-day tracking (auto from your logs, or mark one yourself), training-day streak, 7-day sleep chart with a sleep goal and "hours short" count.
  - Score = 40% sleep (70% hours, 30% how rested) + 20% each soreness, tiredness, stress, minus 10/20 after 4/6 hard days in a row. A guide, not a medical measure; rest-level advice includes a see-a-doctor note.
- **Activity:** steps (typed in, with goal ring) and sessions (walk, run, cycle, cardio/gym, other) with minutes, optional distance, pace, and **estimated** calories (MET method, ±25%, labelled as an estimate). Weekly summary against the WHO 150 min/week guideline, 7-day charts, personal bests (longest run/walk/ride, fastest pace over 3 km+), session history.
- Easy walks (<90 min) count as active recovery, not as training days. Activity calories are shown but do not change food targets.
- The AI coach now sees readiness, sleep, rest days and activity, and is told to go lighter when recovery is low.
- Recovery/activity data is included in backup, export and sync.
- Fixed while testing: the Recovery screen ignored today's saved check-in on a cold load (it now waits for saved data).
- Tests: `scripts/test-activity.ts`, `scripts/test-recovery.ts` (MET bands never decrease with speed; readiness hand-checked at 66/69/46; streak, rest-day and muscle logic).
- Limits: Expo Go can't read the phone's step counter or Health Connect, so steps/sessions are entered by hand; live GPS run tracking is not built.

## 1.1.0 — Stage 7: Kitchen, recipes, meal plan, groceries (2026-11-04)
- **Kitchen** hub (Today → Kitchen) with four sections:
  - **Cook:** 25 built-in recipes (Indian-focused; breakfast, mains, sides, snacks) plus your own. Ranked by how much you already have, with diet filter (everything / egg / vegetarian / vegan), time limit and "fit my remaining calories today"; shows what's missing and which expiring items it uses up.
  - **Plan:** one-tap weekly plan that targets your calorie and protein goals (seeded optimiser, no repeats within 2 days, diet respected). Adjust servings, swap a dish, or log a whole meal to the diary.
  - **Groceries:** shopping list for the next 7 days minus what's in your kitchen, grouped by category with piece counts. Type your own ₹/kg prices to see costs, a weekly budget check, and protein per ₹ per recipe. Prices are never guessed. "I bought this" moves items into the pantry.
  - **Pantry:** items with amounts, units and expiry dates (soonest first); names like "tomatoes", "arhar", "mustard oil" are matched to recipe ingredients automatically.
- **Recipe screen:** nutrition per serving, scalable ingredient list with ✓ for what you have, method, cooking timer, "I ate this".
- **Create your own recipe:** pick ingredients from the food database; nutrition is calculated live.
- Recipe nutrition is **computed** from raw ingredient weights × real USDA/built-in food data (never typed in); tests check every recipe (serving size sanity, calories vs macros, diet labels) and hand-verify dal tadka (183 kcal, 8.2 g protein).
- Kitchen data (pantry, plan, recipes, prices, budget, diet) is included in backup/export and sync; older cloud copies without it never wipe local kitchen data. "Erase all my data" clears it too.
- Tests: `scripts/test-recipes.ts`, `scripts/test-mealplan.ts`. Verified in the browser: ranking with a real pantry, plan generation, logging a lunch (both dishes), grocery quantities and price maths.
- Not built yet: fridge-photo ingredient detection, AI-generated recipes, restaurant/menu scanning.

## 1.0.0-rc — Stage 6: accounts, cloud sync, export (2026-11-04)
- Optional cloud backup & sync via the user's own free Supabase project: email/password account, one private row per user protected by row-level security (`supabase/schema.sql`).
- Sync engine (`src/lib/sync.ts`): knows "changed here / in the cloud / in both"; a conflict asks which copy wins and never overwrites silently. Auto-syncs on open, when returning to the app, and a few seconds after edits (no repeat loops).
- Allow-listed snapshots: API keys, AI consents, unfinished workout and coach chat are never synced (tested).
- Export: "Export my data" shares everything as a JSON file (no keys).
- Connection settings validated (refuses a secret/service_role key, wrong URL); friendly errors for common Supabase problems.
- Me tab: new "Backup, sync & export" card; new Cloud screen with setup steps, SQL, sign-up/in, sync status, conflict choices, delete cloud backup, disconnect.
- Verified against a local Supabase stand-in (`scripts/mock-supabase.js`) running the real app: sign-up → upload once, new empty phone downloads, conflict detected and nothing overwritten.
- Not verified: a real hosted Supabase project (needs the user's account); the conflict-resolution buttons on a real phone (they use native alerts).
- Docs: `docs/SUPABASE_SETUP.md`. Tests: `scripts/test-sync.ts`.

## 0.9.0 — Web nutrition lookup + editable numbers (2026-11-04)
- Photo scanning no longer stops at "no nutrition found". Unmatched foods are looked up in this order: bundled USDA data → Open Food Facts packaged-product average → **web search** (keyless DuckDuckGo; top nutrition pages are fetched and read) → a clearly labelled **AI estimate** as a last resort.
- Web numbers are **verified**: the AI must quote the page text containing the calories, and protein/carbs/fat must appear on the page and agree with the calories (Atwater check). Per-serving values are converted only when the page states the serving weight. Anything the AI made up is rejected (tested).
- Every item shows its source (database / USDA / web: sites / AI estimate / your numbers); web and AI values get wider calorie ranges.
- **Editable nutrition**: per item (kcal, protein, carbs, fat) and for the **whole meal** (type a total and all items scale to match). Items with no data can be filled in by hand. Edited values are what gets saved.
- Diary entries: tap an entry to edit amount **and** kcal/protein/carbs/fat (amount rescales the numbers until you type your own).
- Coach: its food-lookup tool now also searches the web when the database has no data (verified numbers only, no AI estimates).
- Fixed: opening the entry editor before saved data finished loading showed "Entry not found"; fixed a bug that rejected valid web numbers (found by tests).
- Tests: `scripts/test-web.ts` (search parsing, page text, verification incl. rejecting invented numbers, combining, pipeline) plus editable-total tests in `test-photo.ts`.
- Not verified: the Gemini extraction step with a real key; web search from a phone network (DuckDuckGo may rate-limit or block; Kabe then falls back).

## 0.8.0 — AI Coach (2026-11-04)
- New Coach tab with insights computed from your own logs (plain tested maths, not AI):
  - real daily calorie burn from food logs + weigh-ins (energy balance), only when logging/weigh-ins are sufficient — otherwise it says exactly what is missing
  - suggested calorie target with one-tap "use as my target" (macros re-balanced); never below 1200 (female) / 1500 (male) kcal
  - weight trend, plateau detection (won't blame the plan if logging stopped), too-fast-loss warning, goal-weight forecast, 7-day food summary
- Chat with the coach (Gemini free tier, your own key, consent screen): it sees a computed summary of your data and can call a lookup tool that reads real nutrition from the food database. Rules: no invented numbers, not a doctor, safe-calorie limits, no supplement doses.
- Quick prompts (What should I eat next?, Review my week, Why is my weight not changing?, …); chat history saved on the phone, clearable.
- Tests: `scripts/test-coach.ts` (analytics), `scripts/test-coachchat.ts` (tool loop, errors, safety text, context).
- Not verified: a real reply from Google's API (needs the user's key). Request format follows Google's published Interactions API docs.

## 0.7.0 — Built-in food database, no keys (2026-11-04)
- Bundled ~13,200 foods (USDA SR Legacy + FNDDS survey dishes, public domain) inside the app: instant, offline, no key, no rate limit. Includes dishes like biryani, chicken curry, idli, dosa, sambar, upma, samosa, paneer.
- Add food search now shows these automatically as you type (the "Search USDA" button and the USDA key setting are gone).
- Photo scanning resolves unknown foods against the bundled database first, then (online, keyless) a "typical value" from several Open Food Facts packaged products — only when ≥3 products clearly agree. Such values are labelled and get a wider kcal range.
- Everyday-name aliases (dal→lentils, rajma→kidney beans, curd→yogurt, …) widen matches without inventing any.
- `scripts/build-food-db.ts` regenerates `src/data/usdaFoods.json` from FoodData Central CSV downloads.
- Not used: Gemini's Google Search grounding — it is not available on Google's free tier (paid only), so it was not enabled.
- Tests: bundled search, matching, typical-value rules (`scripts/test-foodsearch.ts`).

## 0.6.1 — Automatic online food lookup for photos (2026-11-04)
- Foods the AI sees that aren't in Kabe's built-in list are now looked up in USDA FoodData Central automatically after the photo is analysed, one by one while you review.
- Strict matching: every word of the food name must appear in the USDA entry (most generic entry wins). If nothing fits, the item says so and you can tap "Choose food" — no guessed numbers.
- "Add to diary" waits until lookups finish. Rate-limit / network problems are explained on screen.
- USDA errors now include USDA's own reason. The shared demo key allows only ~10 lookups/hour — add your own free key in Me.
- Tests: matching and lookup flow (`scripts/test-photo.ts`).

## 0.6.0 — Photo plate scanning (2026-11-04)
- "Scan your plate" on Today and in Add food: take/choose a photo; Gemini (free tier, user's own key) names foods and guesses grams.
- Macros come from Kabe's food database only — never from the AI. Unmatched foods are left out and flagged, not invented.
- Totals shown as a kcal range based on confidence; every item editable before saving. Saved entries are marked "photo estimate".
- First-use consent screen (free-tier photos may be used by Google to improve products). Photos are not stored by Kabe.
- Me: Gemini key field, Test connection, withdraw consent.
- Tests: response parsing, food matching, range maths, request shape (`scripts/test-photo.ts`).
- Fixed: picker errors now show a message instead of failing silently.

## 0.5.0 — Stage 5 (2026-11-04)
- Body screen: daily weight with 7-day trend chart, since-start and per-week change; measurements with change vs previous.
- Daily screen: water (quick-add, goal), caffeine log, supplement checklist, custom habits with streaks.
- Today screen: water card with +250 ml button and habit progress.
- New separate `tracker` store; "Erase all my data" now clears it too.
- Tests for trend, weekly change, streaks, water goal. Verified in browser.
- Deferred: progress photos (storage), reminders (notifications).

## 0.4.1 — Stage 4 testing (2026-11-04)
- Installed missing `expo-font` (expo-doctor now 20/20) and web support (`react-native-web`, `react-dom`) so the UI can be tested in a browser.
- Tested the full workout flow in the browser: log set, rest timer, finish, save routine, history, strength record, suggestion + prefill, resume after reload.
- Fixed a brief "No workout in progress" flash after finishing; fixed "1 sets" grammar.

## 0.4.0 — Stage 4 (2026-11-04)
- Train tab: start a workout, log sets (kg × reps), tick to complete, add/remove sets and exercises.
- 42-exercise library with muscle filters and custom exercises.
- 90-second rest timer after each set (±15 s, skip, vibration).
- Shows last session's sets and a rule-based overload suggestion (top of 8–12 range on every set → +2.5 kg).
- Routines, workout history, estimated-1RM strength records.
- In-progress workout is saved, so closing the app doesn't lose it.
- Workout math unit tests.

## 0.3.0 — Stage 3 (2026-11-04)
- USDA FoodData Central search from Add food (Foundation, SR Legacy, Survey/FNDDS foods).
- Barcode scanning with Open Food Facts (camera or typed number). Products without full nutrition data are refused, not guessed.
- Sugar and sodium tracked where the source has them; Today shows how many items they cover.
- Online foods you log/star are remembered locally so recents and favourites work offline.
- Me: field for your own free USDA API key.
- Tests: API mapping with real response samples, plus optional live check (`LIVE=1`).

## 0.2.0 — Stage 2 (2026-11-04)
- Tap a diary entry to edit its grams (macros rescale) or delete it.
- Favourite foods (star) and a Recent list in Add food.
- Save any meal as a reusable saved meal; add it back with one tap; long-press to delete.
- Added test for entry rescaling.
- Sugar/sodium deferred to Stage 3 so values come from real data, not guesses.

## 0.1.0 — Stage 1 (2026-11-03)
- Created Expo + TypeScript project with Expo Router.
- Home dashboard: calorie ring, macro bars, Log food button.
- Food diary: date navigation, four meals, long-press delete.
- Add-food modal: search 43 starter foods (incl. Indian), editable grams, live preview, custom foods.
- Progress: 7-day calorie chart, averages.
- Me: targets calculator (Mifflin-St Jeor), erase-all-data.
- Local offline storage; unit tests for nutrition math.
- Docs: MASTER_FEATURES, ROADMAP, ARCHITECTURE.
