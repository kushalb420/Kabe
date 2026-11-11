// Reminder settings and the schedule they produce (pure, tested in scripts/test-reminders.ts).
// Reminders are local: the phone itself shows them at the chosen times. Nothing goes to a server.

export const REMINDER_IDS = ['water', 'logFood', 'checkin', 'weigh'] as const;
export type ReminderId = (typeof REMINDER_IDS)[number];
export type ReminderSetting = { on: boolean; hour: number; minute: number };
export type ReminderSettings = Record<ReminderId, ReminderSetting>;

export const WATER_HOURS = [10, 13, 16, 19] as const; // water is fixed: four gentle nudges through the day
export const WEIGH_WEEKDAY = 1; // Sunday (1 = Sunday in the notification schedule)

export const DEFAULT_REMINDERS: ReminderSettings = {
  water: { on: false, hour: 10, minute: 0 },
  logFood: { on: false, hour: 20, minute: 30 },
  checkin: { on: false, hour: 8, minute: 0 },
  weigh: { on: false, hour: 8, minute: 30 },
};

const int = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);

/** Anything stored is cleaned: missing or odd values fall back to the defaults. */
export function sanitizeReminders(raw: unknown): ReminderSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Partial<ReminderSetting> | undefined>;
  const out = {} as ReminderSettings;
  for (const id of REMINDER_IDS) {
    const d = DEFAULT_REMINDERS[id];
    const s = o[id];
    out[id] = { on: s?.on === true, hour: int(s?.hour, 0, 23, d.hour), minute: int(s?.minute, 0, 59, d.minute) };
  }
  return out;
}

/** Move a reminder's time by some minutes, wrapping around midnight. */
export function stepTime(s: ReminderSetting, deltaMin: number): ReminderSetting {
  const total = (((s.hour * 60 + s.minute + deltaMin) % 1440) + 1440) % 1440;
  return { ...s, hour: Math.floor(total / 60), minute: total % 60 };
}

export const formatTime = (hour: number, minute: number): string => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export type Slot = { key: string; id: ReminderId; hour: number; minute: number; weekday?: number };

/** Every notification to schedule for the current settings. */
export function plan(settings: ReminderSettings): Slot[] {
  const out: Slot[] = [];
  if (settings.water.on) for (const h of WATER_HOURS) out.push({ key: `water-${h}`, id: 'water', hour: h, minute: 0 });
  if (settings.logFood.on) out.push({ key: 'logFood', id: 'logFood', hour: settings.logFood.hour, minute: settings.logFood.minute });
  if (settings.checkin.on) out.push({ key: 'checkin', id: 'checkin', hour: settings.checkin.hour, minute: settings.checkin.minute });
  if (settings.weigh.on) out.push({ key: 'weigh', id: 'weigh', hour: settings.weigh.hour, minute: settings.weigh.minute, weekday: WEIGH_WEEKDAY });
  return out;
}

// ---------------------------------------------------------------- smart schedule
export type Done = { logFood: boolean; checkin: boolean; weigh: boolean; water: boolean }; // already done TODAY
export type Upcoming = { key: string; id: ReminderId; at: Date };

/** At most this many scheduled at once (phones cap them at about 64). */
export const MAX_SCHEDULED = 60;

/**
 * The next `days` days of reminders as one-off times. Anything already done today (food logged, check-in done,
 * weighed, water goal reached) is left out for today, so you are never nagged about it. Past times are dropped.
 * The schedule is rebuilt every time Kabe is opened or you log something, so open the app at least once a week.
 */
export function upcoming(settings: ReminderSettings, now: Date, done: Done, days = 7): Upcoming[] {
  const out: Upcoming[] = [];
  for (let d = 0; d < days; d++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const weekday = base.getDay() + 1; // 1 = Sunday, like the notification schedule
    for (const slot of plan(settings)) {
      if (slot.weekday !== undefined && slot.weekday !== weekday) continue;
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), slot.hour, slot.minute);
      if (at.getTime() <= now.getTime()) continue;
      if (d === 0 && done[slot.id]) continue;
      out.push({ key: `${slot.key}-${d}`, id: slot.id, at });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}
