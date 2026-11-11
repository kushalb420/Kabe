# Development build (optional): whole-day Android steps with Health Connect

Expo Go cannot read Health Connect. Kabe already contains the code: in a **development build** on Android it reads the whole day's steps from Health Connect, and in Expo Go it quietly keeps using the phone's step counter (counting while Kabe is open). You do not need a development build to use Kabe.

## What you need
- An Android phone with Health Connect (built in on Android 14 and later; a free app from Google Play on older versions).
- A free Expo account (expo.dev) for the cloud build, **or** Android Studio on your computer for a local build.
- A step source that writes to Health Connect (for example Google Fit, Samsung Health or a fitness band's app).

## Cloud build (no Android Studio)
```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform android
```
When it finishes, EAS gives a link: open it on your phone, install the app, then run `npx expo start --dev-client` on your computer and open Kabe. EAS has a free tier with a limited number of builds per month. Kabe never needs a paid plan, and nothing here should ask you to pay; stop and ask if it does.

## Local build (Android Studio)
```bash
npx expo run:android
```

## Check it works
Open Kabe, allow the Health Connect "Steps" permission when asked, then open Activity. Today's total should match your step app, and keep matching through the day even when Kabe was closed.

## Not covered by this build
- GPS tracking with the screen off is built: Track a route asks for "all the time" location and shows a notification while it runs. Try a short walk with the screen locked. If you decline the permission, it falls back to keep-it-open tracking.
