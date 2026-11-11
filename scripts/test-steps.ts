import assert from 'node:assert/strict';
import { readTodayStepsWith, type HcLike, readStepsBetween } from '../src/lib/healthConnect';
import { nextTotal, shouldSave, startOfDay, withSession } from '../src/lib/steps';

assert.equal(withSession(1000, 250), 1250);
assert.equal(withSession(0, 0), 0);
assert.equal(withSession(1000.4, 20.6), 1021);
assert.equal(withSession(500, -50), 500, 'a negative session is ignored');
assert.equal(withSession(-5, 10), 5);
assert.equal(nextTotal(4000, 3500), 4000, 'a lower reading never replaces a higher saved total');
assert.equal(nextTotal(4000, 4800), 4800);
assert.equal(nextTotal(0, 12), 12);
assert.equal(shouldSave(null, 10, 0), true);
assert.equal(shouldSave({ value: 10, at: 0 }, 10, 60000), false, 'unchanged');
assert.equal(shouldSave({ value: 10, at: 0 }, 11, 5000), false, 'too soon');
assert.equal(shouldSave({ value: 10, at: 0 }, 11, 15000), true);
const d = startOfDay(new Date(2026, 2, 14, 17, 45, 12));
assert.deepEqual([d.getHours(), d.getMinutes(), d.getSeconds(), d.getDate()], [0, 0, 0, 14]);

// ---- Health Connect (whole-day steps in a development build) ----
void (async () => {
  const mk = (o: Partial<HcLike> = {}, calls: string[] = []): HcLike => ({
    getSdkStatus: async () => { calls.push('status'); return 3; },
    initialize: async () => { calls.push('init'); return true; },
    getGrantedPermissions: async () => { calls.push('granted'); return [{ accessType: 'read', recordType: 'Steps' }]; },
    requestPermission: async () => { calls.push('request'); return [{ accessType: 'read', recordType: 'Steps' }]; },
    aggregateRecord: async (r) => { calls.push('aggregate:' + r.timeRangeFilter.startTime.slice(0, 4)); return { COUNT_TOTAL: 8234.4 }; },
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
    ...o,
  });
  const now = new Date(2026, 2, 14, 17, 30);
  const calls: string[] = [];
  assert.equal(await readTodayStepsWith(mk({}, calls), now), 8234, 'the whole day, rounded');
  assert.deepEqual(calls.slice(0, 3), ['status', 'init', 'granted'], 'permission already given: no prompt');
  assert.ok(!calls.includes('request'));
  const ask: string[] = [];
  assert.equal(await readTodayStepsWith(mk({ getGrantedPermissions: async () => [] }, ask), now), 8234);
  assert.ok(ask.includes('request'), 'asks once when not yet allowed');
  assert.equal(await readTodayStepsWith(mk({ getGrantedPermissions: async () => [], requestPermission: async () => [] }), now), null, 'refused: fall back to the phone sensor');
  assert.equal(await readTodayStepsWith(mk({ getSdkStatus: async () => 1 }), now), null, 'Health Connect not installed');
  assert.equal(await readTodayStepsWith(mk({ initialize: async () => false }), now), null);
  assert.equal(await readTodayStepsWith(mk({ getSdkStatus: async () => { throw new Error("The package doesn't seem to be linked"); } }), now), null, 'Expo Go: not linked, quietly nothing');
  assert.equal(await readTodayStepsWith(mk({ aggregateRecord: async () => ({}) }), now), null, 'no number back');
  assert.equal(await readTodayStepsWith(mk({ aggregateRecord: async () => ({ COUNT_TOTAL: -5 }) }), now), null, 'nonsense is rejected');
// ---- a window of steps for the idle check (never asks for permission) ----
(async () => {
  const fake = (perm: boolean, count: number | null) => ({
    getSdkStatus: async () => 3,
    initialize: async () => true,
    getGrantedPermissions: async () => (perm ? [{ accessType: 'read', recordType: 'Steps' }] : []),
    requestPermission: async () => { throw new Error('must not ask'); },
    aggregateRecord: async () => ({ COUNT_TOTAL: count ?? undefined }),
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  });
  const a = new Date(2026, 10, 10, 10, 0);
  const b = new Date(2026, 10, 10, 11, 0);
  assert.equal(await readStepsBetween(fake(true, 42.4) as never, a, b), 42);
  assert.equal(await readStepsBetween(fake(false, 42) as never, a, b), null, 'no permission: null, and no dialog');
  assert.equal(await readStepsBetween(fake(true, null) as never, a, b), null);
  assert.equal(await readStepsBetween({ ...fake(true, 5), getSdkStatus: async () => 1 } as never, a, b), null, 'Health Connect missing');
})().then(() => console.log('Steps tests passed.'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
