// Cloud sync engine (pure logic, no network library in here so it is fully testable).
// Model: one JSON snapshot of the user's data per account. We remember a hash of what we last synced and the cloud's
// last timestamp, so we can tell "changed here", "changed in the cloud" and "changed in both" (a conflict the user resolves).
// Device-only secrets (Gemini/USDA keys, consents, an unfinished workout, coach chat) are NEVER part of a snapshot:
// snapshots are built from explicit allow-lists, so a new secret field can't leak by accident.

export const KABE_SYNC_KEYS = ['entries', 'customFoods', 'externalFoods', 'favorites', 'savedMeals', 'goals', 'goalsCustom', 'sugarGoal', 'profile', 'userName', 'intent', 'dashboard', 'workouts', 'routines', 'customExercises'] as const;
export const TRACKER_SYNC_KEYS = ['weights', 'measurements', 'water', 'waterGoal', 'caffeine', 'supplements', 'supplementLog', 'habits', 'habitLog', 'notif', 'customReminders', 'customDone', 'goalWeight', 'checkins', 'restDays', 'activities', 'steps', 'stepGoal', 'sleepGoal', 'badges', 'challengesDone'] as const;

export const KITCHEN_SYNC_KEYS = ['pantry', 'savedRecipes', 'shopping', 'equipment', 'equipmentSet', 'diet'] as const;

/** `kitchen` is optional so cloud copies saved by older versions of the app (without it) still load and never wipe local pantry data. */
export type Snapshot = { v: 1; kabe: Record<string, unknown>; tracker: Record<string, unknown>; kitchen?: Record<string, unknown> };

const pick = (src: Record<string, any>, keys: readonly string[]) => Object.fromEntries(keys.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]));

export const buildSnapshot = (kabe: Record<string, any>, tracker: Record<string, any>, kitchen?: Record<string, any>): Snapshot => ({
  v: 1,
  kabe: pick(kabe, KABE_SYNC_KEYS),
  tracker: pick(tracker, TRACKER_SYNC_KEYS),
  ...(kitchen ? { kitchen: pick(kitchen, KITCHEN_SYNC_KEYS) } : {}),
});

/** Small deterministic hash (FNV-1a, 32-bit) — only used to notice "did my data change since the last sync". */
export function hashSnapshot(s: Snapshot): string {
  const str = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + str.length;
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v as object).length : 0);

/** True when there is nothing worth protecting (a fresh install). */
export function isEmptySnapshot(s: Snapshot): boolean {
  const k = s.kabe;
  const t = s.tracker;
  const c = s.kitchen ?? {};
  return (
    [k.entries, k.workouts, k.savedMeals, k.routines, k.customFoods, k.favorites, t.weights, t.measurements, t.water, t.caffeine, t.supplements, t.habits, c.inventory, c.customRecipes, c.plan].every((v) => len(v) === 0) &&
    !k.profile
  );
}

export type SyncMeta = { lastHash: string | null; lastCloudUpdatedAt: string | null };
export type Decision = 'nothing' | 'upload' | 'download' | 'conflict';

export function decide(a: { hasCloud: boolean; localHash: string; localEmpty: boolean; meta: SyncMeta; cloudUpdatedAt: string | null }): Decision {
  if (!a.hasCloud) return a.localEmpty ? 'nothing' : 'upload';
  const dirty = a.localHash !== a.meta.lastHash;
  const cloudChanged = a.cloudUpdatedAt !== a.meta.lastCloudUpdatedAt;
  if (!dirty && !cloudChanged) return 'nothing';
  if (dirty && !cloudChanged) return 'upload';
  if (!dirty && cloudChanged) return 'download';
  return a.localEmpty ? 'download' : 'conflict';
}

export type CloudRow = { data: Snapshot; updated_at: string };
export interface CloudApi {
  fetchRow(): Promise<CloudRow | null>;
  /** Saves the snapshot and returns the server's updated_at. */
  upsertRow(data: Snapshot): Promise<string>;
  deleteRow(): Promise<void>;
  /** Only the server's updated_at (a tiny request): lets the app ask "has anything changed?" without downloading everything. */
  fetchStamp?(): Promise<string | null>;
}

export type SyncResult =
  | { outcome: 'nothing'; meta: SyncMeta }
  | { outcome: 'uploaded'; meta: SyncMeta }
  | { outcome: 'downloaded'; meta: SyncMeta; snapshot: Snapshot }
  | { outcome: 'conflict'; meta: SyncMeta };

/**
 * One sync pass. `resolve` answers a previous 'conflict': 'cloud' keeps the cloud copy, 'local' keeps this phone's.
 * A downloaded snapshot is returned for the caller to apply to the stores (this function never touches local state).
 */
export async function runSync(api: CloudApi, local: Snapshot, meta: SyncMeta, resolve?: 'cloud' | 'local'): Promise<SyncResult> {
  const row = await api.fetchRow();
  const localHash = hashSnapshot(local);
  let d = decide({ hasCloud: !!row, localHash, localEmpty: isEmptySnapshot(local), meta, cloudUpdatedAt: row?.updated_at ?? null });
  if (d === 'conflict' && resolve) d = resolve === 'cloud' ? 'download' : 'upload';
  switch (d) {
    case 'nothing':
      return { outcome: 'nothing', meta };
    case 'conflict':
      return { outcome: 'conflict', meta };
    case 'upload': {
      const at = await api.upsertRow(local);
      return { outcome: 'uploaded', meta: { lastHash: localHash, lastCloudUpdatedAt: at } };
    }
    case 'download': {
      if (!row) return { outcome: 'nothing', meta };
      // lastHash of the downloaded data; stores may normalise it slightly, which at worst causes one harmless re-upload
      return { outcome: 'downloaded', snapshot: row.data, meta: { lastHash: hashSnapshot(row.data), lastCloudUpdatedAt: row.updated_at } };
    }
  }
}

/** Export file contents: the same data as a snapshot, plus a little context. */
export const exportJson = (s: Snapshot, appVersion = '1') =>
  JSON.stringify({ app: 'Kabe', exportedAt: new Date().toISOString(), appVersion, note: 'Your Kabe data. API keys and consents are not included.', data: s }, null, 2);

/** The table + security rules the user pastes into Supabase's SQL editor. */
export const SUPABASE_SQL = `-- Kabe cloud sync: one private row per user.
create table if not exists public.kabe_sync (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kabe_sync enable row level security;

create policy "own row: read" on public.kabe_sync for select using (auth.uid() = user_id);
create policy "own row: insert" on public.kabe_sync for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.kabe_sync for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.kabe_sync for delete using (auth.uid() = user_id);

-- server decides the timestamp, so a wrong phone clock can't break sync
create or replace function public.kabe_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists kabe_touch_trg on public.kabe_sync;
create trigger kabe_touch_trg before insert or update on public.kabe_sync
  for each row execute function public.kabe_touch();

-- lets a signed-in person delete their own account (and, through the cascade above, their row)
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Friends (optional). Shares only a display name and this week's totals (steps, active minutes, logged days, points),
-- plus the meal plan you choose to share. Food, weight and photos are never shared.
-- No table policies on purpose: the app can only use the functions below, and each one checks who is asking.
create table if not exists public.kabe_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  friend_code text not null unique,
  week text not null default '',
  steps int not null default 0,
  active_minutes int not null default 0,
  logged_days int not null default 0,
  points int not null default 0,
  shared_plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.kabe_friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.kabe_profiles enable row level security;
alter table public.kabe_friends enable row level security;

-- saves your name and this week's totals; returns your friend code
create or replace function public.kabe_save_profile(p_name text, p_week text, p_steps int, p_minutes int, p_days int, p_points int)
  returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.kabe_profiles (user_id, display_name, friend_code, week, steps, active_minutes, logged_days, points)
  values (auth.uid(), left(trim(p_name), 30), upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 8)),
          p_week, greatest(p_steps, 0), greatest(p_minutes, 0), greatest(p_days, 0), greatest(p_points, 0))
  on conflict (user_id) do update set display_name = excluded.display_name, week = excluded.week, steps = excluded.steps,
    active_minutes = excluded.active_minutes, logged_days = excluded.logged_days, points = excluded.points, updated_at = now()
  returning friend_code into code;
  return code;
end $$;

-- you and your friends for one week (a friend who has not shared that week shows zeros)
create or replace function public.kabe_board(p_week text)
  returns table (user_id uuid, display_name text, steps int, active_minutes int, logged_days int, points int, is_me boolean)
  language sql security definer set search_path = public as $$
  select p.user_id, p.display_name,
         case when p.week = p_week then p.steps else 0 end,
         case when p.week = p_week then p.active_minutes else 0 end,
         case when p.week = p_week then p.logged_days else 0 end,
         case when p.week = p_week then p.points else 0 end,
         p.user_id = auth.uid()
  from public.kabe_profiles p
  where auth.uid() is not null
    and (p.user_id = auth.uid() or p.user_id in (select f.friend_id from public.kabe_friends f where f.user_id = auth.uid()));
$$;

-- adds a friend by their code (both of you see each other); returns their name
create or replace function public.kabe_add_friend(p_code text) returns text
  language plpgsql security definer set search_path = public as $$
declare other public.kabe_profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into other from public.kabe_profiles where friend_code = upper(trim(p_code));
  if other.user_id is null then raise exception 'check the code'; end if;
  if other.user_id = auth.uid() then raise exception 'that is your own code'; end if;
  insert into public.kabe_friends (user_id, friend_id) values (auth.uid(), other.user_id), (other.user_id, auth.uid()) on conflict do nothing;
  return other.display_name;
end $$;

create or replace function public.kabe_remove_friend(p_friend uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.kabe_friends where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
end $$;

-- the meal plan you share with your friends or household
create or replace function public.kabe_share_plan(p_plan jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.kabe_profiles set shared_plan = coalesce(p_plan, '{}'::jsonb), updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'save your name first'; end if;
end $$;

create or replace function public.kabe_friend_plans()
  returns table (user_id uuid, display_name text, shared_plan jsonb)
  language sql security definer set search_path = public as $$
  select p.user_id, p.display_name, p.shared_plan from public.kabe_profiles p
  where auth.uid() is not null and p.user_id in (select f.friend_id from public.kabe_friends f where f.user_id = auth.uid());
$$;

revoke all on function public.kabe_save_profile(text, text, int, int, int, int) from public, anon;
revoke all on function public.kabe_board(text) from public, anon;
revoke all on function public.kabe_add_friend(text) from public, anon;
revoke all on function public.kabe_remove_friend(uuid) from public, anon;
revoke all on function public.kabe_share_plan(jsonb) from public, anon;
revoke all on function public.kabe_friend_plans() from public, anon;
grant execute on function public.kabe_save_profile(text, text, int, int, int, int) to authenticated;
grant execute on function public.kabe_board(text) to authenticated;
grant execute on function public.kabe_add_friend(text) to authenticated;
grant execute on function public.kabe_remove_friend(uuid) to authenticated;
grant execute on function public.kabe_share_plan(jsonb) to authenticated;
grant execute on function public.kabe_friend_plans() to authenticated;

-- AI proxy (optional): counts each person's AI requests per day so the free quota is shared fairly.
-- The edge function supabase/functions/ai calls kabe_ai_hit before forwarding a request to Google.
create table if not exists public.kabe_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.kabe_ai_usage enable row level security;

-- returns true while the person is under today's limit, and counts the request
create or replace function public.kabe_ai_hit(p_limit int) returns boolean
  language plpgsql security definer set search_path = public as $$
declare used int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.kabe_ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.kabe_ai_usage.count + 1
  returning count into used;
  return used <= p_limit;
end $$;

revoke all on function public.kabe_ai_hit(int) from public, anon;
grant execute on function public.kabe_ai_hit(int) to authenticated;

-- your own name and friend code (so the app never has to remember them)
create or replace function public.kabe_my_profile()
  returns table (display_name text, friend_code text)
  language sql security definer set search_path = public as $$
  select p.display_name, p.friend_code from public.kabe_profiles p where auth.uid() is not null and p.user_id = auth.uid();
$$;

revoke all on function public.kabe_my_profile() from public, anon;
grant execute on function public.kabe_my_profile() to authenticated;
`;
