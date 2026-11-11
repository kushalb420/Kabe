import assert from 'node:assert/strict';
import { dataFlows, sendsInBackground } from '../src/lib/privacy';

const st = (f: ReturnType<typeof dataFlows>) => Object.fromEntries(f.map((x) => [x.id, x.status]));

assert.deepEqual(st(dataFlows({ geminiKey: '', aiConsent: false, coachConsent: false, cloudUser: false })), { ai: 'off', products: 'possible', cloud: 'off' }, 'fresh install: nothing is sent except lookups you start');
assert.deepEqual(st(dataFlows({ geminiKey: 'abc', aiConsent: false, coachConsent: false, cloudUser: false })), { ai: 'off', products: 'possible', cloud: 'off' }, 'a key without consent: AI stays off');
assert.deepEqual(st(dataFlows({ geminiKey: 'abc', aiConsent: true, coachConsent: false, cloudUser: false })), { ai: 'on', products: 'possible', cloud: 'off' });
assert.equal(st(dataFlows({ geminiKey: '', aiConsent: true, coachConsent: false, cloudUser: false })).ai, 'off', 'consent without a key sends nothing');
assert.equal(st(dataFlows({ geminiKey: '   ', aiConsent: true, coachConsent: false, cloudUser: false })).ai, 'off', 'a blank key is no key');
assert.equal(st(dataFlows({ geminiKey: '', aiConsent: false, coachConsent: false, cloudUser: true })).cloud, 'on');
assert.deepEqual(dataFlows({ geminiKey: '', aiConsent: false, coachConsent: false, cloudUser: false }).map((f) => f.id), ['ai', 'products', 'cloud']);
assert.equal(st(dataFlows({ geminiKey: 'abc', aiConsent: false, coachConsent: true, cloudUser: false })).ai, 'on', 'the coach agreement alone also means Google can be contacted');
assert.equal(sendsInBackground({ cloudUser: false }), false);
assert.equal(sendsInBackground({ cloudUser: true }), true);

console.log('Privacy tests passed.');
