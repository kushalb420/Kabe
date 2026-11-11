# Translation review (Hindi, Telugu, Tamil)

All Hindi, Telugu and Tamil text in Kabe was written by Claude. A native speaker should read it. This makes that easy.

## For the reviewer
1. Open `docs/translations-review.csv` in Excel, Google Sheets or LibreOffice (it is UTF-8; if the letters look broken, choose "UTF-8" when opening).
2. Each row is one text: English, then Hindi, Telugu and Tamil.
3. If a text is wrong, awkward or too formal, type the better version in the matching **corrected** column (leave it empty when it is fine). You only need the language you speak.
4. Keep anything in `{curly braces}` exactly as it is (for example `{n}` or `{kcal}`): the app fills those in.
5. Save as CSV (UTF-8).

## For the owner: applying the corrections
```bash
npx tsx scripts/apply-translations.ts path/to/reviewed.csv --dry   # shows what would change
npx tsx scripts/apply-translations.ts path/to/reviewed.csv         # applies it
npm test                                                           # checks every text is complete and in the right script
```
- A correction is skipped (and reported) if its `{placeholders}` differ from the English.
- Only rows of kind `text` are applied. Recipe names and steps (`recipe name`, `recipe step`) and cuisines are edited by hand in `src/i18n/recipeText.ts`.
- To make a fresh sheet after the app changes: `npx tsx scripts/export-translations.ts`.
