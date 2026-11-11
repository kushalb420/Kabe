// Notification rules beyond the daily nudges (pure and tested in scripts/test-notify.ts):
// your own reminders, follow-ups that repeat until a task is done, snoozing, and the "you have been still" nudge.
import { ItemUpcoming, MAX_SCHEDULED_ITEMS, cleanRemind } from './itemReminders';

// ---------------------------------------------------------------- preferences
export type IdlePrefs = { on: boolean; afterMin: number; from: number; to: number; minSteps: number };
export type NotifPrefs = {
  allOn: boolean; // one switch for everything
  repeatUntilDone: boolean; // keep reminding about a habit, supplement or reminder until it is marked done
  repeatEveryMin: number; // minutes between follow-ups
  repeatTimes: number; // how many follow-ups
  snoozeMin: number; // how long Snooze waits
  idle: IdlePrefs;
};

export const DEFAULT_PREFS: NotifPrefs = {
  allOn: true,
  repeatUntilDone: true,
  repeatEveryMin: 30,
  repeatTimes: 3,
  snoozeMin: 10,
  idle: { on: false, afterMin: 60, from: 9, to: 21, minSteps: 60 },
};

export const LIMITS = { repeatEveryMin: [10, 120], repeatTimes: [1, 6], snoozeMin: [5, 60], idleAfterMin: [15, 240], hour: [0, 23] } as const;

const clampInt = (v: unknown, [lo, hi]: readonly [number, number] | readonly number[], fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

/** Stored preferences, checked: anything odd falls back to the defaults. */
export function sanitizePrefs(raw: unknown): NotifPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotifPrefs> & { idle?: Partial<IdlePrefs> };
  const d = DEFAULT_PREFS;
  const idle = (o.idle && typeof o.idle === 'object' ? o.idle : {}) as Partial<IdlePrefs>;
  const from = clampInt(idle.from, [0, 23], d.idle.from);
  const to = clampInt(idle.to, [0, 23], d.idle.to);
  return {
    allOn: o.allOn !== false,
    repeatUntilDone: o.repeatUntilDone !== false,
    repeatEveryMin: clampInt(o.repeatEveryMin, LIMITS.repeatEveryMin, d.repeatEveryMin),
    repeatTimes: clampInt(o.repeatTimes, LIMITS.repeatTimes, d.repeatTimes),
    snoozeMin: clampInt(o.snoozeMin, LIMITS.snoozeMin, d.snoozeMin),
    idle: { on: idle.on === true, afterMin: clampInt(idle.afterMin, LIMITS.idleAfterMin, d.idle.afterMin), from: from < to ? from : d.idle.from, to: from < to ? to : d.idle.to, minSteps: clampInt(idle.minSteps, [10, 500], d.idle.minSteps) },
  };
}

// ---------------------------------------------------------------- the person's own reminders
export type CustomReminder = { id: string; title: string; hour: number; minute: number; days: number[]; on: boolean }; // days: 0 = Sunday … 6 = Saturday; empty = every day
export const MAX_CUSTOM = 30;

export function sanitizeCustom(raw: unknown): CustomReminder[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomReminder[] = [];
  const ids = new Set<string>();
  for (const r of raw as Partial<CustomReminder>[]) {
    const when = cleanRemind({ hour: r?.hour, minute: r?.minute });
    const title = typeof r?.title === 'string' ? r.title.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || !when || !title) continue;
    ids.add(r.id);
    const days = Array.isArray(r.days) ? [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    out.push({ id: r.id, title, hour: when.hour, minute: when.minute, days, on: r.on !== false });
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

/** Upcoming times of the person's own reminders (a reminder done today is skipped for today). */
export function upcomingCustom(list: CustomReminder[], now: Date, doneToday: string[], days = 7): ItemUpcoming[] {
  const out: ItemUpcoming[] = [];
  for (const r of list) {
    if (!r.on) continue;
    for (let d = 0; d < days; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      if (r.days.length && !r.days.includes(day.getDay())) continue;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), r.hour, r.minute);
      if (at.getTime() <= now.getTime()) continue;
      if (d === 0 && doneToday.includes(r.id)) continue;
      out.push({ key: `custom-${r.id}-${d}`, kind: 'custom', id: r.id, name: r.title, at });
    }
  }
  return out;
}

// ---------------------------------------------------------------- follow-ups until done
export type DoneToday = Record<'habit' | 'supplement' | 'custom', string[]>;
export type WithFollow = ItemUpcoming & { followUp: number };

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Each reminder plus (when "repeat until done" is on) a few follow-ups after it. Follow-ups for today are left out once the
 * task is done. Because they are scheduled ahead, a task you finish is quiet from the next time the app opens or you tap Done.
 */
export function withFollowUps(base: ItemUpcoming[], prefs: NotifPrefs, now: Date, done: DoneToday): WithFollow[] {
  const out: WithFollow[] = [];
  for (const b of base) {
    out.push({ ...b, followUp: 0 });
    if (!prefs.repeatUntilDone) continue;
    if (sameDay(b.at, now) && done[b.kind].includes(b.id)) continue;
    for (let k = 1; k <= prefs.repeatTimes; k++) {
      const at = new Date(b.at.getTime() + k * prefs.repeatEveryMin * 60_000);
      if (at.getTime() <= now.getTime() || !sameDay(at, b.at)) continue; // never past midnight
      out.push({ ...b, key: `${b.key}-f${k}`, at, followUp: k });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** The time a snoozed notification comes back. */
export const snoozeAt = (now: Date, prefs: NotifPrefs): Date => new Date(now.getTime() + prefs.snoozeMin * 60_000);

export type Snooze = { key: string; at: number; title: string; body: string; data: { kind: string; id: string; date: string } };

/** Snoozes still ahead, newest kept, so the scheduler can put them back after it rebuilds. */
export const liveSnoozes = (list: Snooze[], now: Date, max = 10): Snooze[] => list.filter((s) => s.at > now.getTime()).sort((a, b) => a.at - b.at).slice(0, max);

/** Merge everything within the phone's limit, earliest first. */
export function capSchedule<T extends { at: Date }>(list: T[], max = MAX_SCHEDULED_ITEMS): T[] {
  return [...list].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

// ---------------------------------------------------------------- "you have been still"
export type IdleInput = { now: Date; stepsInWindow: number | null; prefs: NotifPrefs; lastNudgeAt: number | null };

/**
 * True when it is time to say "time to move": the feature is on, it is inside the waking hours, the last window of
 * `afterMin` minutes had fewer than `minSteps` steps (unknown steps never trigger it), and we have not nudged within that window.
 */
export function shouldNudgeIdle({ now, stepsInWindow, prefs, lastNudgeAt }: IdleInput): boolean {
  if (!prefs.allOn || !prefs.idle.on) return false;
  const h = now.getHours();
  if (h < prefs.idle.from || h >= prefs.idle.to) return false;
  if (stepsInWindow === null || stepsInWindow >= prefs.idle.minSteps) return false;
  if (lastNudgeAt !== null && now.getTime() - lastNudgeAt < prefs.idle.afterMin * 60_000) return false;
  // the window must lie inside the waking hours too, so the first nudge of the day comes an hour after the window opens
  const windowStart = new Date(now.getTime() - prefs.idle.afterMin * 60_000);
  return windowStart.getHours() >= prefs.idle.from && windowStart.getDate() === now.getDate();
}
