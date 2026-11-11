# Cloud backup & sync — Supabase setup (free, optional)

Kabe works fully without this. Cloud sync is an optional backup so you can use Kabe on more than one phone.
It uses **your own** free Supabase project: your data lives in your database, and row-level-security rules mean only your account can read your row.

## Steps (about 5 minutes, no credit card)
1. supabase.com → **Sign up** → **New project** (any name, set a database password, free plan, pick the closest region).
2. In the project: **Authentication → Sign In / Providers → Email** → turn **OFF "Confirm email"** → Save. (Otherwise sign-up waits for an email link.)
3. **SQL Editor → New query** → paste `supabase/schema.sql` (or use the "Share the SQL" button in the app) → **Run**.
4. **Project Settings → API Keys**: copy the **Project URL** and the **publishable** key. Never use the secret / service_role key.
5. In Kabe: **Me → Backup, sync & export → Set up** → paste both → **Connect** → **Create account**.

## What syncs / what never leaves the phone
- Synced (explicit allow-list in `src/lib/sync.ts`): food diary, custom foods, saved meals, targets, profile, workouts & routines, weight, measurements, water, caffeine, supplements, habits, goal weight.
- Never synced: Gemini/USDA keys, AI consents, an unfinished workout, the coach chat.

## How sync works
One JSON snapshot per user in table `kabe_sync`. Kabe remembers what it last synced, so it can tell "changed here", "changed in the cloud" or "changed in both". Both → you choose which copy wins; nothing is overwritten automatically.

## Testing without an account
`node scripts/mock-supabase.js 54321` starts a local stand-in; connect Kabe to `http://localhost:54321` with any long fake key.

## Deleting data
In the app: **Delete my cloud backup** (erases the row). To remove the account: Supabase dashboard → Authentication → Users → delete.

## Deleting your account from inside the app
The setup SQL now also creates a function, `delete_my_account()`, that lets a signed-in person delete their own account (and their cloud row). Kabe → Me → Backup → "Delete my account" calls it. No admin key is involved. If you set Supabase up before this was added, tap "Share the setup SQL" and run it again in Supabase → SQL Editor (it is safe to run twice).

## Friends and shared plans (optional)
The setup SQL also creates two tables and six functions for friends (`kabe_profiles`, `kabe_friends`, `kabe_save_profile`, `kabe_board`, `kabe_add_friend`, `kabe_remove_friend`, `kabe_share_plan`, `kabe_friend_plans`). If you set Supabase up before this release, share and run the setup SQL again once.
- The tables have row-level security turned on and **no policies**, so the app cannot read them directly. Everything goes through the functions, which check who is asking and only return you and your friends.
- What is shared with friends: a display name, this week's steps, active minutes, days with food logged, points, and the meal plan you choose to share. Nothing else.
- **Everyone must use the same Supabase project.** Give your friends the project URL and the public (anon/publishable) key; each person signs up in the app with their own email. Anyone who signs up there can enter a friend code, but only people who hold your code can add you.
- Deleting your account removes your profile and friendships (they cascade).
