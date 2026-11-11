# Deploying Kabe

Kabe ships as a normal Android/iOS app built with Expo's build service (EAS). It does **not** run in Expo Go any more for the full feature set (background GPS and Health Connect need native code), so you work with a *development build*, then a *release build*.

Everything below is free to start: Supabase free plan, Google AI free tier, EAS free builds (a limited number per month), and the Android APK needs no store account. The Google Play listing costs a one-time US$25 and the App Store US$99 a year; neither is needed to share an APK.

## 1. The backend (once)

One Supabase project that you own serves everybody: AI proxy, friends, optional account backup.

1. supabase.com → New project (free plan).
2. Authentication → Sign In / Providers: turn **on** "Allow anonymous sign-ins" (guests can use AI and friends without an account) and turn **off** "Confirm email" if you want instant sign-up.
3. SQL Editor → paste all of `supabase/schema.sql` → Run. (Re-run it after any update; it is safe to repeat except for policy names, which error harmlessly if they already exist.)
4. Get your Google AI key at aistudio.google.com/apikey. **Do not add billing.**
5. Deploy the AI proxy. With the Supabase CLI (`npm i -g supabase`, `supabase login`, `supabase link --project-ref <ref>`):
   ```bash
   supabase functions deploy ai
   supabase secrets set GEMINI_API_KEY=<your free-tier key>
   supabase secrets set AI_DAILY_LIMIT=150
   ```
   The key lives only on Supabase. Each person gets `AI_DAILY_LIMIT` AI requests a day, so one person cannot use up everyone's free quota.
6. Project Settings → API: copy the **Project URL** and the **publishable** (anon) key. These two are public by design. Never put the secret/service key in the app.

## 2. Tell the app about the backend

Local work: copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.

Builds: set the same two as EAS environment variables (expo.dev → your project → Environment variables, visibility "Plain text" or "Sensitive"), for the `development`, `preview` and `production` environments. With these set, every user gets AI, friends and shared plans with nothing to enter, and no Google key is inside the app.

If you leave them empty, the app still works for everything typed or picked; AI is on only if you set `EXPO_PUBLIC_GEMINI_KEY` (development only: it would be readable inside a release).

## 3. Build

```bash
npm i -g eas-cli          # or use: npx eas-cli@latest <command>
eas login                 # free Expo account
eas init                  # links the project (writes the project id into app.json)
eas build --profile development --platform android   # a dev build: install it, then `npx expo start --dev-client`
eas build --profile preview --platform android       # an APK you can send to friends
eas build --profile production --platform android    # an .aab for Google Play
```

Package id: `app.kabe.fitness` (`app.json`). Change it before your first store upload if you want another; it cannot change afterwards.

Over-the-air JavaScript updates need `npx expo install expo-updates` first (not installed yet).

## 4. Before you publish

- **Privacy policy:** Google Play and Health Connect require a public URL. `docs/PRIVACY_POLICY.md` is a ready text; host it (GitHub Pages is free) and paste the URL in the Play Console.
- **Health Connect:** Play review asks you to declare the Steps permission and why. Use: "Shows today's step count".
- **Background location:** Play asks for a short video and a justification. Use: "Records a walk, run or ride route while the screen is off, only after the user taps Start."
- **Data safety form:** food diary and body data stay on the device unless the user makes an account; AI requests send meal text/photos to Google through your proxy; steps and location are not sent anywhere.

## What I could not test for you
Nothing here has been built or run on a device, and the backend has never run against a live Supabase project: the tests use fakes. Expect to fix small things the first time (most likely the Edge Function deploy and the anonymous-sign-in switch).
