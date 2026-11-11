# Kabe Roadmap

Each stage is small, tested, and ends with a working app.

| Stage | Goal | Notes |
|---|---|---|
| 1 ✅ | Foundation: navigation, dashboard, food diary, macros, profile targets | Done |
| 2 ✅ | Better logging: edit entries, recents/favourites, saved meals | Done. Sugar/sodium moved to Stage 3 (needs real data) |
| 3 ✅ | Real food data: Open Food Facts barcode scan; foods looked up on the web / by AI (the bundled USDA data was removed on request) | Done. Vitamins/minerals are AI estimates |
| 4 ✅ | Workouts: exercise library, sets/reps/weight, rest timer, history, routines | Done. Needs phone test |
| 5 ✅ | Body + hydration + habits: weight, measurements, water, supplements, caffeine | Done, now with progress photos, body-fat estimate and reminders |
| 6 🟡 | Supabase: auth, cloud sync, data export | Built + tested locally; waiting for the owner's free Supabase project to verify live |
| 7 ✅ | Kitchen + recipes + grocery list + budget | Done: pantry, 25 recipes, cook-with-what-I-have, own recipes |
| 8 ✅ | Meal planning (rule-based solver, no AI needed) | Done: weekly plan, swap, log, groceries, fridge photo + AI recipe ideas |
| 9 ✅ | Free AI layer: photo/menu/label/fridge scans, voice, insights, weekly wording, food and vitamin lookups (own Gemini key) | Built; live key testing is the owner's |
| 10 🟡 | Recovery ✅, activity ✅ (manual entry), gamification ✅, community ⬜ | Community needs Supabase |
| 11 🟡 | Steps from the phone sensor ✅, GPS tracking ✅ (foreground). Health Connect / wearables / background tracking | Need a development build |
| 12 🟡 | Polish: dark mode ✅, Indian languages ✅ (all screens; native-speaker review open), offline hardening | Offline hardening open |

## Photo analysis — built early (v0.6.0)
Chosen: Gemini free tier (`gemini-3.5-flash-lite`, fallback `gemini-3.1-flash-lite`) via the Interactions API, user's own key, consent required. Verified from Google's docs on 2026-11-04: free tier has no charge but content may be used to improve Google products; limits are per project (see AI Studio). Not verified: a live call with a real key.

## Free-AI approach (original notes)
- **Photo → food:** options are on-device models (TFLite/ONNX Food-101 style classifiers, limited to ~100 dish classes, poor for Indian dishes) or a free-tier hosted vision model (e.g. Google Gemini free tier, Hugging Face free inference). Hosted free tiers have rate limits and data-privacy trade-offs. Calories from photos are always rough estimates; Kabe will show ranges and require user confirmation.
- **Coach / recipes:** free-tier hosted LLM behind a Supabase Edge Function (keeps keys off the phone), with a rule-based fallback when offline or over quota.
- **Nothing paid is enabled without asking.**
- **Limits:** no AI feature is "done" until it works end to end.
