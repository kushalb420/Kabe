import assert from 'node:assert/strict';
import { friendlyCloudError, normalizeUrl, validateConfig } from '../src/lib/cloudConfig';
import { DELETE_FUNCTION, deleteAccountRemote } from '../src/lib/accountApi';
import { CloudApi, CloudRow, SUPABASE_SQL, Snapshot, SyncMeta, buildSnapshot, decide, exportJson, hashSnapshot, isEmptySnapshot, runSync } from '../src/lib/sync';

const empty = buildSnapshot({}, {});
const withData = (n: number): Snapshot =>
  buildSnapshot({ entries: Array.from({ length: n }, (_, i) => ({ id: String(i), name: 'x', kcal: 100 })), goals: { kcal: 2000 } }, { weights: [{ date: '2026-01-01', kg: 70 }] });

// ---- snapshots only contain allow-listed data; secrets can't leak ----
const kabeState = {
  entries: [{ id: '1' }], goals: { kcal: 2000 }, profile: null,
  geminiKey: 'AIzaSECRET', usdaKey: 'USDASECRET', aiConsent: true, coachConsent: true, activeWorkout: { id: 'w' }, // device-only
  addEntry: () => {}, ready: true, // functions / UI state
};
const trackerState = { weights: [{ date: 'd', kg: 1 }], coachChat: [{ id: '1', role: 'user', text: 'private chat' }], resetTracker: () => {} };
const snap = buildSnapshot(kabeState, trackerState);
const text = JSON.stringify(snap);
for (const secret of ['AIzaSECRET', 'USDASECRET', 'private chat', 'activeWorkout', 'aiConsent', 'coachConsent', 'ready']) assert.ok(!text.includes(secret), `leaked: ${secret}`);
assert.deepEqual(Object.keys(snap.kabe).sort(), ['entries', 'goals', 'profile'].sort());
assert.equal(snap.v, 1);

// ---- connection settings are validated before any network call ----
const b64u = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string) => `${b64u({ alg: 'HS256' })}.${b64u({ role })}.sig1234567890`;
assert.equal(normalizeUrl(' https://abcd.supabase.co/ '), 'https://abcd.supabase.co');
assert.equal(normalizeUrl('https://abcd.supabase.co/rest/v1/'), 'https://abcd.supabase.co');
assert.equal(validateConfig({ url: 'https://abcd.supabase.co', key: 'sb_publishable_abcdefghijklmnopqrstuvwxyz' }), null);
assert.equal(validateConfig({ url: 'https://abcd.supabase.co/', key: jwt('anon') }), null);
assert.match(validateConfig({ url: 'https://example.com', key: 'sb_publishable_abcdefghijklmnopqrstuvwxyz' })!, /Project URL/);
assert.match(validateConfig({ url: 'http://abcd.supabase.co', key: 'sb_publishable_abcdefghijklmnopqrstuvwxyz' })!, /Project URL/);
assert.match(validateConfig({ url: 'https://abcd.supabase.co', key: 'short' })!, /too short/);
assert.match(validateConfig({ url: 'https://abcd.supabase.co', key: 'sb_secret_abcdefghijklmnopqrstuvwxyz' })!, /SECRET/);
assert.match(validateConfig({ url: 'https://abcd.supabase.co', key: jwt('service_role') })!, /SECRET/);
assert.match(friendlyCloudError({ message: 'Invalid login credentials' }), /Wrong email or password/);
assert.match(friendlyCloudError({ message: 'Email not confirmed' }), /Confirm email/);
assert.match(friendlyCloudError({ message: 'relation "public.kabe_sync" does not exist' }), /SQL/);
assert.match(friendlyCloudError({ message: 'Network request failed' }), /No connection/);

// ---- hashing & emptiness ----
assert.equal(hashSnapshot(withData(3)), hashSnapshot(withData(3)));
assert.notEqual(hashSnapshot(withData(3)), hashSnapshot(withData(4)));
assert.equal(isEmptySnapshot(empty), true);
assert.equal(isEmptySnapshot(withData(1)), false);
assert.equal(isEmptySnapshot(buildSnapshot({ profile: { age: 30 } }, {})), false);

// ---- decision matrix ----
const meta = (h: string | null, c: string | null): SyncMeta => ({ lastHash: h, lastCloudUpdatedAt: c });
const base = { localHash: 'H2', localEmpty: false };
assert.equal(decide({ ...base, hasCloud: false, meta: meta(null, null), cloudUpdatedAt: null }), 'upload', 'no cloud copy yet → upload');
assert.equal(decide({ localHash: 'H', localEmpty: true, hasCloud: false, meta: meta(null, null), cloudUpdatedAt: null }), 'nothing', 'nothing anywhere');
assert.equal(decide({ ...base, localHash: 'H1', hasCloud: true, meta: meta('H1', 'T1'), cloudUpdatedAt: 'T1' }), 'nothing', 'in sync');
assert.equal(decide({ ...base, hasCloud: true, meta: meta('H1', 'T1'), cloudUpdatedAt: 'T1' }), 'upload', 'changed here only');
assert.equal(decide({ ...base, localHash: 'H1', hasCloud: true, meta: meta('H1', 'T1'), cloudUpdatedAt: 'T2' }), 'download', 'changed in the cloud only');
assert.equal(decide({ ...base, hasCloud: true, meta: meta('H1', 'T1'), cloudUpdatedAt: 'T2' }), 'conflict', 'changed in both');
assert.equal(decide({ localHash: 'H0', localEmpty: true, hasCloud: true, meta: meta(null, null), cloudUpdatedAt: 'T2' }), 'download', 'fresh phone just signed in → take the cloud copy, no question');
assert.equal(decide({ ...base, hasCloud: true, meta: meta(null, null), cloudUpdatedAt: 'T2' }), 'conflict', 'phone with data + existing cloud copy → ask');

// ---- full sync passes against a fake cloud ----
class FakeCloud implements CloudApi {
  row: CloudRow | null = null;
  clock = 0;
  calls: string[] = [];
  async fetchRow() { this.calls.push('fetch'); return this.row; }
  async upsertRow(data: Snapshot) { this.calls.push('upsert'); this.row = { data, updated_at: `T${++this.clock}` }; return this.row.updated_at; }
  async deleteRow() { this.calls.push('delete'); this.row = null; }
}

(async () => {
  const cloud = new FakeCloud();
  let m: SyncMeta = { lastHash: null, lastCloudUpdatedAt: null };

  // phone A has data, cloud empty → uploads
  const a1 = withData(2);
  let r = await runSync(cloud, a1, m);
  assert.equal(r.outcome, 'uploaded');
  m = r.meta;
  assert.deepEqual(cloud.row!.data, a1);

  // nothing changed → no upload
  cloud.calls = [];
  r = await runSync(cloud, a1, m);
  assert.equal(r.outcome, 'nothing');
  assert.deepEqual(cloud.calls, ['fetch']);

  // phone A edits → uploads
  const a2 = withData(3);
  r = await runSync(cloud, a2, m);
  assert.equal(r.outcome, 'uploaded');
  m = r.meta;

  // brand-new phone B signs in: empty local → downloads without asking
  const bMeta: SyncMeta = { lastHash: null, lastCloudUpdatedAt: null };
  const rb = await runSync(cloud, empty, bMeta);
  assert.equal(rb.outcome, 'downloaded');
  assert.ok(rb.outcome === 'downloaded' && rb.snapshot.kabe.entries && (rb.snapshot.kabe.entries as unknown[]).length === 3);

  // A edits again and syncs; B (in sync before) just downloads
  const a3 = withData(4);
  r = await runSync(cloud, a3, m);
  assert.equal(r.outcome, 'uploaded');
  m = r.meta;
  const rb2 = await runSync(cloud, withData(3), rb.meta);
  assert.equal(rb2.outcome, 'downloaded');

  // both change → conflict (nothing is overwritten), then each resolution works
  const bLocal = withData(9); // B edited while A also changed cloud
  const a4 = withData(5);
  r = await runSync(cloud, a4, m);
  assert.equal(r.outcome, 'uploaded');
  m = r.meta;
  const before = JSON.stringify(cloud.row);
  const rc = await runSync(cloud, bLocal, rb2.meta);
  assert.equal(rc.outcome, 'conflict');
  assert.equal(JSON.stringify(cloud.row), before, 'conflict must not overwrite the cloud');
  const keepCloud = await runSync(cloud, bLocal, rb2.meta, 'cloud');
  assert.equal(keepCloud.outcome, 'downloaded');
  assert.deepEqual(keepCloud.outcome === 'downloaded' && keepCloud.snapshot, a4);
  const keepLocal = await runSync(cloud, bLocal, rb2.meta, 'local');
  assert.equal(keepLocal.outcome, 'uploaded');
  assert.deepEqual(cloud.row!.data, bLocal);

  // deleting the cloud copy, then syncing a phone with data re-uploads it
  await cloud.deleteRow();
  const re = await runSync(cloud, bLocal, keepLocal.meta);
  assert.equal(re.outcome, 'uploaded');

  // export file: valid JSON, contains data, no secrets
  const ex = JSON.parse(exportJson(snap));
  assert.equal(ex.app, 'Kabe');
  assert.deepEqual(ex.data, snap);
  assert.ok(!JSON.stringify(ex).includes('AIzaSECRET'));

  // the SQL we hand the user keeps every row private
  for (const must of ['enable row level security', 'auth.uid() = user_id', 'for select', 'for insert', 'for update', 'for delete', 'on delete cascade']) assert.ok(SUPABASE_SQL.includes(must), must);
  // the SQL file in the repo and the one shown in the app must be identical
  const { readFileSync } = await import('node:fs');
  const onDisk = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk.trim(), SUPABASE_SQL.trim(), 'supabase/schema.sql is out of sync with SUPABASE_SQL');
  console.log('Sync tests passed.');
})();
