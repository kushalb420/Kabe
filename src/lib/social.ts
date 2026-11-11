// Friends, weekly scores and a shared meal plan (pure, tested in scripts/test-social.ts).
// Only a display name, this week's totals and the plan you choose to share leave the phone. The server side is a set of
// SQL functions in your own Supabase project (see SUPABASE_SQL in sync.ts); everyone has to use the same project.
import { mondayOf } from './stats';

export type Totals = { steps: number; activeMinutes: number; loggedDays: number; points: number };
export type BoardRow = { userId: string; name: string; isMe: boolean } & Totals;
export type Metric = 'points' | 'steps' | 'activeMinutes' | 'loggedDays';
export const METRICS: Metric[] = ['points', 'steps', 'activeMinutes', 'loggedDays'];

const MAX_NAME = 30;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A display name people can see: trimmed, one line, no control characters, at most 30 characters. */
export function cleanName(raw: string): string | null {
  const s = [...raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_NAME).join('').trim();
  return s ? s : null;
}

/** Friend codes are 8 letters/numbers; typed codes are tidied before use. */
export function normalizeCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{8}$/.test(s) ? s : null;
}

/** One point per 1,000 steps, one per 10 active minutes, five per day with food logged. */
export function pointsOf(t: Pick<Totals, 'steps' | 'activeMinutes' | 'loggedDays'>): number {
  return Math.floor(t.steps / 1000) + Math.floor(t.activeMinutes / 10) + t.loggedDays * 5;
}

/** This week's totals (Monday to the given day) from what the app already stores. */
export function weeklyTotals(
  today: string,
  steps: Record<string, number>,
  activities: { date: string; minutes: number }[],
  loggedDates: string[],
): Totals & { week: string } {
  const week = mondayOf(today);
  const inWeek = (d: string) => DAY.test(d) && d >= week && d <= today;
  let st = 0;
  for (const [d, n] of Object.entries(steps)) if (inWeek(d) && n > 0) st += n;
  let minutes = 0;
  for (const a of activities) if (inWeek(a.date) && a.minutes > 0) minutes += a.minutes;
  const logged = new Set(loggedDates.filter(inWeek)).size;
  const base = { steps: Math.round(st), activeMinutes: Math.round(minutes), loggedDays: logged };
  return { week, ...base, points: pointsOf(base) };
}

/** Highest first; people with the same value share a rank, and ties are shown in name order. */
export function rank(rows: BoardRow[], metric: Metric): (BoardRow & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name));
  let last = Infinity;
  let r = 0;
  return sorted.map((row, i) => {
    if (row[metric] !== last) {
      r = i + 1;
      last = row[metric];
    }
    return { ...row, rank: r };
  });
}

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** Rows from the server, checked before use. */
export function sanitizeBoard(raw: unknown): BoardRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BoardRow[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r.user_id !== 'string') continue;
    const name = typeof r.display_name === 'string' ? cleanName(r.display_name) : null;
    if (!name) continue;
    out.push({ userId: r.user_id, name, isMe: r.is_me === true, steps: num(r.steps), activeMinutes: num(r.active_minutes), loggedDays: num(r.logged_days), points: num(r.points) });
  }
  return out;
}

// ---------------------------------------------------------------- talking to the server (functions in the user's Supabase)
export type RpcResult = PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
export type SocialClient = { rpc: (fn: string, args?: Record<string, unknown>) => RpcResult };

const NEEDS_SETUP = 'Friends need the updated setup SQL. Tap "Share the setup SQL" on the cloud screen, run it in Supabase → SQL Editor, then try again.';

function failure(error: { message?: string; code?: string }): Error {
  const m = error.message ?? '';
  if (error.code === 'PGRST202' || /could not find the function|schema cache/i.test(m)) return new Error(NEEDS_SETUP);
  if (/check the code/i.test(m)) return new Error('Check the code and try again.');
  if (/your own code/i.test(m)) return new Error('That is your own code. Send it to a friend instead.');
  if (/save your name/i.test(m)) return new Error('Save your name first.');
  return new Error('Something went wrong. Check your connection and try again.');
}

async function call(c: SocialClient, fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw failure(error);
  return data;
}

/** Saves your name and this week's totals; returns your friend code. */
export async function saveProfile(c: SocialClient, name: string, t: Totals & { week: string }): Promise<string> {
  const clean = cleanName(name);
  if (!clean) throw new Error('Type a name your friends will see.');
  const code = await call(c, 'kabe_save_profile', { p_name: clean, p_week: t.week, p_steps: t.steps, p_minutes: t.activeMinutes, p_days: t.loggedDays, p_points: t.points });
  const norm = typeof code === 'string' ? normalizeCode(code) : null;
  if (!norm) throw new Error('Something went wrong. Check your connection and try again.');
  return norm;
}

export const fetchBoard = async (c: SocialClient, week: string): Promise<BoardRow[]> => sanitizeBoard(await call(c, 'kabe_board', { p_week: week }));

/** Adds a friend by code; returns their name. */
export async function addFriend(c: SocialClient, typed: string): Promise<string> {
  const code = normalizeCode(typed);
  if (!code) throw new Error('A friend code is 8 letters and numbers. Check it and try again.');
  const name = await call(c, 'kabe_add_friend', { p_code: code });
  return typeof name === 'string' ? name : '';
}

export const removeFriend = async (c: SocialClient, friendId: string): Promise<void> => void (await call(c, 'kabe_remove_friend', { p_friend: friendId }));

/** Your own saved name and friend code, or null if you have not saved a profile yet. */
export async function fetchMyProfile(c: SocialClient): Promise<{ name: string; code: string } | null> {
  const raw = await call(c, 'kabe_my_profile');
  const row = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : undefined;
  const name = row && typeof row.display_name === 'string' ? cleanName(row.display_name) : null;
  const code = row && typeof row.friend_code === 'string' ? normalizeCode(row.friend_code) : null;
  return name && code ? { name, code } : null;
}

/** The people on the board other than you, in the order of the chosen number (highest first). */
export const friendsOf = (rows: BoardRow[], metric: Metric = 'points') => rank(rows.filter((r) => !r.isMe), metric);
