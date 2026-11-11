# Kabe — unfinished work (the "come back to this at the end" list)

The owner asked that every unfinished item be revisited before we call the project done. This is the single checklist.
Source of truth for features is `MASTER_FEATURES.md`; this file groups what's left by *what it needs*.
Update it whenever something is finished (tick it) or discovered.

## A. Needs the owner (nothing I can do alone)
- [x] **Test the whole app on the real phone** (Expo Go). Nothing since Stage 1 has been confirmed on-device except that Stage 1 loaded. — done by the owner on 2026-11-07 (see docs/PHONE_TEST.md)
  - barcode scanner camera · plate-photo scanning · voice recording · automatic steps · insights card · workout rest-timer vibration · pantry/recipes · check-ins
- [ ] **Supabase cloud sync setup** (deferred by owner): create free project, turn off "Confirm email", run `supabase/schema.sql`, paste URL + publishable key in Me → Backup. Steps: `docs/SUPABASE_SETUP.md`.
- [x] **Gemini key**: confirmed working by the owner on 2026-11-07 (AI features, web food lookups and photo scanning work on the phone).

## B. Built and tested offline, but NOT verified live
- [x] Gemini request/response shapes with a real key: plate photo and web-page extraction confirmed by the owner (2026-11-07). Still unconfirmed: audio recording, menu/label/fridge photos, coach tool calls.
- [ ] Open Food Facts "typical value" call (site returned 503 when tested).
- [x] Web search from a phone network: confirmed working by the owner (2026-11-07).
- [ ] Real hosted Supabase project (sign-up, upload, second-device download, conflict buttons — they use native alerts, so untestable in a browser).
- [ ] Android appearance/touch-target pass on a real screen (all UI was checked in a phone-sized browser pane only).

## C. Buildable now in Expo Go (free)
- [ ] **Indian languages, what is left:** every screen is translated, but a native speaker must read the hi/te/ta wording (I wrote it); still English by design: exercise names, food names that come from web/AI lookups, the source labels on looked-up foods, technical error messages, and text the AI writes itself; users' own recipes keep whatever language they type
- [x] ~~Restaurant intelligence: menu scan, typed orders, saved orders~~ (built; see below)
- [ ] **Restaurant, still open:** (1) live test of a real menu photo with your Gemini key (the typed-order path was tested in the browser, the photo path only against fake AI answers); (2) a "which restaurant is near me" feature would need location and a maps source, not planned
- [x] ~~Fridge/pantry photo recognition and AI recipe ideas~~ (built; see below)
- [ ] **Fridge scan, still open:** live test of a real fridge photo and of a real AI recipe with your Gemini key (only fake AI answers and the typed-list path were tested); the recipe idea can only use the 38 ingredients Kabe knows, so unusual items are saved to the pantry but never appear in an idea; barcode/packaged items are not read yet
- [x] ~~Nutrition-label scanning~~ (built, AI transcription rather than on-device OCR; see below)
- [ ] **Label scan, still open:** live test of a real label photo with your Gemini key (only fake AI answers and the typed path were tested); it reads one column of the table (per 100 g preferred); labels that give only salt (not sodium) or only kJ leave those boxes empty on purpose; vitamins and minerals are not read
- [x] ~~Voice logging~~ (built; typed/dictated sentence)
- [ ] **Voice, still open:** the Record button (expo-audio → Gemini audio) was never run on a phone or with a live key; the audio field name and `audio/mp4` type are unverified; test it and the keyboard-mic path on your phone; spoken amounts are assumed typical servings unless you say them
- [x] ~~Vitamins and minerals~~ (built from AI estimates, no USDA)
- [x] ~~Nutrient breakdown · weekly targets~~ (built in Charts)
- [x] ~~Weekly summary~~ (built)
- [ ] **Weekly summary, still open:** the AI wording was only tested with fake answers, not a live Gemini key; sleep is only compared when you check in; "progress investigator"
- [x] ~~High-protein tags~~ (built)
- [x] ~~Meal planning extras~~ built: month view, meal-prep mode, recipe substitutions, seven more recipes, leftovers tracking, grocery price history
- [x] ~~Progress photos~~ and ~~body-fat estimate~~ (built; photos stay in private storage on the phone)
- [x] ~~Dark mode~~ (built; Me → Appearance: same as phone / light / dark)
- [x] ~~Dashboard customisation~~ (built: Today → Customise this screen; show/hide and reorder cards, tested only in a browser and by script)
- [x] ~~More themes~~ (Ocean, Sunset, Berry, unlocked by level) Dark mode was checked in the browser on the main screens and by a script on all screens, not on a real phone: look for any spot that stays bright or hard to read and tell me
- [x] ~~Unlockable themes~~ and ~~spoken commands~~ (water, weight, activity) built
- [x] ~~Household meal planning~~ built as shared plans between friends (Me → Friends); unverified against a live Supabase project

## D. Needs a development build (not possible in Expo Go) — decide together
- [ ] Health Connect / Apple Health (whole-day Android steps; basic steps already work while the app is open), smart scales & wearables, heart-rate/HRV
- [x] ~~Foreground GPS tracking~~ built. [x] Background tracking written and guarded (falls back to foreground in Expo Go); [ ] needs a dev build to try
- [x] ~~Local reminders~~ built (unverified on a phone). [ ] Smart "streak at risk" reminders that skip when you already logged need a dev build / background tasks

## E. Needs cloud accounts (after Supabase setup)
- [x] ~~Friends, leaderboard, weekly challenge~~ built (Me → Friends); unverified against a live Supabase project. [ ] Shared workouts and chat were not built.
- [x] Account deletion from inside the app (built; needs the updated setup SQL; unverified against a real Supabase project)

## F. Polish / housekeeping
- [x] ~~Lint~~: `npx expo lint` and `npx eslint app src scripts` report nothing (all 29 findings fixed). Still worth a real-phone check: the cloud-sync store changed slightly (see CHANGELOG 1.7.1) and live sync has never been run against a real Supabase project
- [x] Final pass done: README, all tests (35 groups), lint, typecheck, expo-doctor 20/20, Android bundle, ROADMAP updated, release tagged v4.0.0 (a code-complete tag: the phone test is still yours to do)

## How we'll close out
1. Owner tests on phone → fix what they find (A, B).
2. Build C in small stages, each with tests + browser check + commit.
3. Decide on D/E together (free options only; ask before anything that could cost money).
4. Walk this file top to bottom and tick or explicitly drop each item with the owner's OK.

## Added with the "your way" update (2026-11-05)
- [x] **Live test with your Gemini key** (nothing below was run against the real AI): the insights card, the web then AI food lookup in Add food, photo/voice/restaurant lookups, and the vitamins screen. Tell me what looks wrong. — done by the owner on 2026-11-07
- [x] **Android steps:** Expo Go counts only while Kabe is open. Counting the whole day needs a development build with Health Connect (not built). — steps confirmed working in Expo Go; whole-day counting on Android still needs a development build
- [ ] **Offline food search is now tiny:** only the 43 built-in foods plus your own work offline; everything else needs your AI key and internet. The old USDA file and its test are still in the repo, unused.
- [x] ~~Calorie target suggestion~~ (back, inside the Insights card). The coach chat itself remains a hidden screen.
- [ ] Native-speaker check of the new Hindi, Telugu and Tamil strings (insights, About you, vitamins, lookup messages).
- [ ] The vitamin numbers are AI estimates of typical values. A real nutrition source (for example a free national food table) would be more reliable if you ever want one.
- [x] Leftover workout/coach mentions cleaned (badges and the "3 workouts" challenge are hidden but kept in the code via `HIDDEN_BADGES` / `HIDDEN_CHALLENGES` in `gamify.ts`; recovery, AI, weekly and privacy wording no longer mention training or the coach).
- [x] Backlog tidied on request (workouts programs, IFCT database, chain-restaurant data, Training clean-up and bundle-size items dropped as moot) and README written.

## Added in the "everything that did not need you" pass (2026-11-06)
- [x] **Test on the phone** (none of these could be run on a device): progress photos (camera, saving, deleting), GPS tracking (permission, accuracy, saving), reminders (do they arrive on time in Expo Go?), voice commands, the pedometer, Ocean/Sunset/Berry themes once unlocked. — done by the owner on 2026-11-07
- [x] Reminders now skip what you already did today (rebuilt whenever you open Kabe or log; open it at least weekly).
- [ ] GPS tracking stops when the app goes to the background or the screen locks (foreground only).
- [ ] The body-fat estimate is a tape-measure formula: expect it to be off by several points.
- [x] Browser checks covered the charts, investigator, voice commands, themes and photos screens; the GPS and reminders screens were only type-checked and unit-tested (the browser has no GPS or notifications). — superseded by the phone checks of 2026-11-07

- [x] **Remaining phone checks** are listed in `docs/PHONE_TEST.md` (steps, GPS, reminders, voice, progress photos, body-fat, themes, customise, insights, vitamins, privacy). — done by the owner on 2026-11-07
- [x] Steps and GPS route tracking confirmed working on the phone by the owner (2026-11-07). Still unconfirmed: reminders, voice, progress photos, body-fat, themes, customise, insights, vitamins, privacy (see docs/PHONE_TEST.md).
- [x] Remaining phone checklist run by the owner on 2026-11-07; no problems reported.

## Left after "do them all" (2026-11-07) and why
- [ ] **Health Connect / Apple Health, smartwatches, heart-rate:** need a development build. Adding the native module would stop the app from opening in Expo Go (your working setup), so it was not added.
- [ ] **Whole-day Android steps and GPS with the screen off:** the same development-build limit.
- [ ] **Supabase cloud sync, friends and group challenges, in-app account deletion, household meal planning:** need a Supabase project that only you can create (docs/SUPABASE_SETUP.md). Account deletion also needs a server-side function with an admin key, which must never ship inside the app.
- [ ] **Native-speaker review** of the Hindi, Telugu and Tamil text (including the seven new recipes): needs a person.
- [ ] **Menu, label and fridge photo scans on your phone:** only you can try them.
- [ ] **New this round, unconfirmed on a phone:** recipe swaps, leftovers, price trends, month view and meal prep, the 30-day plan, smart reminders (checked by tests and in a browser only).

## 2026-11-09
- [x] Account deletion built (SQL function in your own project, no admin key in the app).
- [x] Health Connect code written and guarded (Expo Go unaffected): needs a development build to run, see docs/DEV_BUILD.md. [ ] Unverified on a real device.
- [x] Background GPS, friends with a weekly leaderboard, and shared meal plans built (all unverified on a real device or a live Supabase project; the tests use fakes).
- [ ] Still needs you: native-speaker review (docs/TRANSLATION_REVIEW.md), a development build to try background GPS and Health Connect, and running the updated Supabase SQL to try friends and account deletion.

## 2026-11-09 (later)
- [x] Key paste removed; built-in key from `.env`. [ ] You must create `.env` with a free-tier key before building, or AI features stay quiet. [ ] Shared free quota: if many people use it, AI lookups may be rate-limited; a proxy function would fix that.
- [x] Live AI check of meal parsing, web food lookup and vitamins passed with a real key (scripts/live-ai-check.ts). [ ] Photo, menu, label, fridge and voice-recording paths still need a real photo/recording on your phone.

## 2026-11-10
- [x] Release build setup, AI proxy, app-owned backend, guest sessions, welcome screen, icons (all unrun on a device).
- [ ] You: create the Supabase project, deploy the `ai` function, set the EAS variables, run `eas build` (docs/DEPLOY.md); host the privacy policy; fill the Play Console forms.
- [ ] Anonymous-sign-in abuse: guests are limited per guest id, so a determined person can create many. If that matters, add CAPTCHA/App Check in Supabase.

## 2026-11-10 (6.0.0)
- [x] Gemini-only nutrition, meal logging with calculating screen, Meals tab, shared barcode products, habit/supplement reminders, settings consolidation, no dark mode, central config.
- [ ] Phone check of all of the above (new APK).
