// Whole-day steps on Android from Health Connect (pure logic, tested in scripts/test-steps.ts).
// Health Connect only exists in a development build. In Expo Go the module is not linked, every call throws, and
// everything here quietly returns null, so the app falls back to the phone's step counter exactly as before.

export type HcLike = {
  getSdkStatus: () => Promise<number>;
  initialize: () => Promise<boolean>;
  getGrantedPermissions: () => Promise<{ accessType?: string; recordType?: string }[]>;
  requestPermission: (p: { accessType: 'read'; recordType: 'Steps' }[]) => Promise<{ accessType?: string; recordType?: string }[]>;
  aggregateRecord: (r: { recordType: 'Steps'; timeRangeFilter: { operator: 'between'; startTime: string; endTime: string } }) => Promise<{ COUNT_TOTAL?: number }>;
  readRecords?: (t: 'Steps', o: { timeRangeFilter: { operator: 'between'; startTime: string; endTime: string } }) => Promise<{ records?: { startTime?: string; endTime?: string; count?: number }[] }>;
  SdkAvailabilityStatus: { SDK_AVAILABLE: number };
};

const hasStepsRead = (list: { accessType?: string; recordType?: string }[]) => list.some((p) => p.recordType === 'Steps' && p.accessType === 'read');

/** Today's step total from Health Connect, or null when it is not available, not allowed, or fails for any reason. */
export async function readTodayStepsWith(hc: HcLike, now: Date): Promise<number | null> {
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await hc.initialize())) return null;
    if (!hasStepsRead(await hc.getGrantedPermissions())) {
      if (!hasStepsRead(await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]))) return null;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const r = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: now.toISOString() } });
    const n = r?.COUNT_TOTAL;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** The Health Connect module, or null when this build does not have it (Expo Go). Loaded lazily so Expo Go never touches it. */
export function loadHealthConnect(): HcLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-health-connect') as HcLike;
    return mod && typeof mod.getSdkStatus === 'function' ? mod : null;
  } catch {
    return null;
  }
}

/** Steps between two moments from Health Connect, or null when it is not available, not allowed, or fails. Never asks for permission. */
export async function readStepsBetween(hc: HcLike, start: Date, end: Date): Promise<number | null> {
  try {
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await hc.initialize())) return null;
    if (!hasStepsRead(await hc.getGrantedPermissions())) return null; // a background check must not open permission dialogs
    const r = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    const n = r?.COUNT_TOTAL;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** One stretch of steps as Health Connect stored it (times in ms since epoch). */
export type StepSpan = { start: number; end: number; count: number };

/** The step records between two moments, or null when not available or not allowed. Never asks for permission. */
export async function readStepSpans(hc: HcLike, start: Date, end: Date): Promise<StepSpan[] | null> {
  try {
    if (!hc.readRecords) return null;
    if ((await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await hc.initialize())) return null;
    if (!hasStepsRead(await hc.getGrantedPermissions())) return null;
    const r = await hc.readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
    const list = Array.isArray(r?.records) ? r.records : [];
    return list
      .map((x) => ({ start: Date.parse(x.startTime ?? ''), end: Date.parse(x.endTime ?? ''), count: Number(x.count) }))
      .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.count) && x.count >= 0);
  } catch {
    return null;
  }
}
