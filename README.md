# Kabe

A free fitness, nutrition and lifestyle app for your phone, built with Expo (React Native) and TypeScript. It costs nothing to run: no paid services, no ads, no accounts, no server of its own.

## What it does

- **Today:** calories and macros left, streaks, an **Insights** card (what to eat or do more of, less of, and where to improve), "What should I eat next?", water and habits.
- **Diary:** log food by search, barcode, plate photo, menu photo, nutrition label, fridge photo, or by speaking or typing a sentence.
- **Progress:** charts (calories, macros, weight, activity), weekly summary, vitamins and minerals.
- **Me:** your targets, "Tell Kabe what you want" (goals, struggles, things to keep in mind), language (English, Hindi, Telugu, Tamil), dark mode, privacy controls, optional cloud backup.
- **Steps:** counted from your phone's built-in step counter. **GPS route tracking**, **progress photos** (private, on the phone only), **reminders**, **body-fat estimate**, **colour themes** that unlock as you level up, and **voice commands** like "drank 2 glasses of water".
- Also: kitchen (recipes, pantry, meal plan, groceries), activity, recovery check-ins, achievements.
- Training and the AI coach chat are **hidden on purpose** (the files are kept).

## Where the food and nutrition numbers come from

There is no bundled food database. Kabe has 43 built-in everyday foods and a small table for its recipe ingredients. Anything else is looked up on the internet with the app's built-in free Gemini access:

1. numbers read from real web pages, then
2. if the pages give none, the AI's estimate, **always labelled as an estimate**.

Vitamins and minerals are AI estimates of typical values, asked once per food and remembered on your phone.

## Run it

You need Node.js and the Expo Go app on your phone (free).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. Run the checks with:

```bash
npm test
npm run typecheck
npm run lint
```

## Running and releasing

Kabe is built as a real app (Expo development and release builds), not for Expo Go: background GPS and Health Connect need native code. Start with **docs/DEPLOY.md**: it sets up your one Supabase project (AI proxy, friends, optional account backup), the two public environment variables, and `eas build`. No user ever pastes a key. The Google AI key lives only on your Supabase server.

For quick local work without a backend, put your own free-tier Google key in `.env` as `EXPO_PUBLIC_GEMINI_KEY` (development only: a release would expose it).

## Privacy

Open Me → Privacy and your data. It lists the only four ways anything can leave your phone (Google Gemini, web search for missing foods, Open Food Facts for barcodes, and your own optional Supabase backup) and shows which are on. All your data is stored on the phone.

## Optional cloud backup and development build

Free, using your own Supabase project. Steps: `docs/SUPABASE_SETUP.md` (includes deleting your account from inside the app). Whole-day Android steps with Health Connect need an optional development build: `docs/DEV_BUILD.md`.

## Honest limits

- **Android steps** count only while Kabe is open in Expo Go. Whole-day counting needs a development build with Health Connect.
- **Checked on a real phone by the owner:** the AI features, web food lookups, photo scanning, steps, GPS tracking and the rest of `docs/PHONE_TEST.md`. Cloud sync (Supabase) has never been run against a real project.
- Hindi, Telugu and Tamil text was written by Claude and needs a native speaker's review.
- Nothing here is medical advice.

## For developers

- `AGENTS.md`: project rules for coding agents (Expo SDK 58, Expo Router in `app/`).
- `ARCHITECTURE.md`: how the code is organised. `CHANGELOG.md`: every change. `MASTER_FEATURES.md` and `ROADMAP.md`: features and plans. `BACKLOG.md`: what is left.
- Logic lives in `src/lib/` as plain tested functions; screens are in `app/`; strings are in `src/i18n/parts/` (every string exists in four languages, enforced by `npm test`).
