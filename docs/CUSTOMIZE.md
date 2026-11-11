# Changing how Kabe looks and behaves

Nothing about the look or the rules is wired into a screen by hand. Almost everything you will want to change is in **one file**: `src/config/app.ts`. Edit a value, save, and the whole app follows (Expo reloads on its own).

| You want to change | Edit this in `src/config/app.ts` |
| --- | --- |
| The brand colours (yellow page, black, sage, charcoal, orange) | `BRAND` |
| The colour themes people unlock (page tint, and the level that unlocks each) | `THEMES` |
| How boxes look: border width, shadow size, corner roundness | `BOX` |
| The dot pattern behind pages (size, strength, or off) | `DOTS` |
| How fast things animate, or switch animation off | `MOTION` (`enabled: false` turns every animation off) |
| Free sugar and saturated fat limits behind the bars on Today | `NUTRITION` |
| Which AI models are tried, retries, size limits | `AI` |
| Which features exist (friends, kitchen, eating out, coach chat, barcode, voice, reminders, photos, vitamins, backup) | `FEATURES` |
| Which tabs show | `TABS` |

Other places, each with one clear job:

- **Words** (all four languages): `src/i18n/parts/*.ts` and `src/i18n/{en,hi,te,ta}.ts`. Change a sentence there; the tests check every language still has every key.
- **Today's cards and their default order:** `src/lib/dashboard.ts` (`CARD_IDS`, `DEFAULT_ORDER`). People can also reorder them in Settings → Customise Today.
- **The AI prompts** (what Gemini is asked for a meal, a photo, a label): `src/lib/gemFood.ts`.
- **Fonts:** `src/lib/fonts.ts` (which font file each weight uses) and the `useFonts` call in `app/_layout.tsx`.
- **The server side** (AI proxy limit, friends, shared products): `supabase/functions/ai/index.ts` and `supabase/schema.sql`. Run the schema again after changing it.

After any change run `npm test` (it checks colours stay readable, every screen follows the theme, every string is translated) and `npx tsc --noEmit`.
