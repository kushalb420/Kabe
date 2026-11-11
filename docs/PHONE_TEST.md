# Phone test checklist

What has been confirmed on a real phone, and what still needs one quick check. Open each item, do the "Try", and compare with "Expect". Tell Claude only the ones that do not match.

## First install of the release build (do this first)
1. Open the build link Claude gives you on your phone, download the APK and install it (Android asks to allow installs from your browser, once).
2. First launch: the yellow **welcome** screen appears. Tap **Let me look around first**.
3. **Today** should show Log food and Scan plate first. Search a food that is not built in (for example "paneer butter masala"): a result labelled *AI estimate* should appear within a few seconds. This proves the phone talks to your backend.
4. Me → **Friends and weekly challenge**: save a name, you get an 8-letter code. Install on a second phone (or ask a friend), add each other's codes: both should appear on the board.
5. **Track a route** (Progress → Activity): allow location "all the time", start, lock the screen, walk 2 minutes, unlock and Stop: distance should be about right. 
6. **Steps**: allow Health Connect Steps when asked; Activity should match your step app.

## Confirmed by the owner (2026-11-07)
- AI features, web food lookups and photo scanning work.
- Steps and GPS route tracking work (confirmed 2026-11-07).
- The rest of the checklist (reminders, voice, progress photos, body-fat, themes, customise, insights, vitamins, privacy) was gone through by the owner on 2026-11-07, with no problems reported.

## The checks below were run by the owner on 2026-11-07 (no problems reported)

| Feature | Try | Expect |
|---|---|---|
| Reminders | Me → Reminders → switch "Log your food" on (allow notifications), move its time to 2 minutes from now | A notification arrives at that time |
| Voice (typing) | Add food → mic icon → type "drank 2 glasses of water" → Find the foods → Add it | Water goes up by 500 ml |
| Voice (mic) | Same screen → Record my voice → say "two rotis and dal for lunch" → Stop | A list of foods appears (needs the built-in AI access, see README) |
| Progress photos | Progress → Progress photos → Take a photo, then another on a later day | Both appear; with two days apart you see Before and Latest |
| Body-fat | Progress → Body (the card near the bottom) → Measurements: waist, neck (and hips if female); height is in Me | A body-fat range appears under the measurements |
| Themes | Level up to 3 (log food, water, steps), then Me → Appearance → Ocean | The app turns blue |
| Customise Today | Today → "Customise this screen" → hide a card, move another | Today follows it, and it is still the same after closing the app |
| Insights | Log 3+ days of food, open Today | "Your insights" lists more / less / improve; with your key it is written for you |
| Vitamins | Progress → Vitamins and minerals | Bars fill in after a few seconds (needs your key) |
| Privacy | Me → Privacy and your data | Four routes shown with On / Off; "Stop sharing with Google" turns the Google row Off |

## New in 4.1 (please try)

| Feature | Try | Expect |
|---|---|---|
| Smart reminders | Turn on "Log your food" for a time 5 minutes ahead, log a meal first | No notification (already logged). Delete the meal, wait: it arrives |
| Recipe swap | Kitchen → Cook → Chicken curry → tap Paneer next to the chicken | Calories change and "The taste changes." appears |
| Leftovers | Open a recipe, set cook servings 4 and eaten 1, tap "Save the other 3 servings" | Kitchen → Pantry shows "(leftover)" with 3 days |
| Price trend | Kitchen → Groceries → type a price, change it another day | "up/down % since date" appears |
| Month view | Kitchen → Plan | A month calendar with dots on planned days |
| Meal prep | Kitchen → Plan → Meal prep → Add to my plan | The next days show the same lunch or dinner |
| New recipes | Kitchen → Cook | Sambar, tomato pappu, lemon rice, kadhi, usal, chickpea salad and egg roast are listed |

## Known limits (not bugs)
- In Expo Go, steps and GPS only count while Kabe is open. A development build (docs/DEV_BUILD.md) adds whole-day Health Connect steps and GPS with the screen off.
- Friends (Me → Friends, needs cloud sign-in and the updated setup SQL): save a name, send your code to a friend who uses the same Supabase project, add theirs, and check that both of you appear on the board and that a shared plan day can be copied.
- Reminders cannot skip themselves when you have already logged.
- The body-fat number is a tape-measure estimate and can be off by several points.
