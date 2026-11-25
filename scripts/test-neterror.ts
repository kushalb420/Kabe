import assert from 'node:assert/strict';
import { explain, isNetworkError } from '../src/lib/netError';

const seen = 'fetch failed: java.net.UnknownHostException: Unable to resolve host "abc.supabase.co": No address associated with hostname';
assert.ok(isNetworkError(seen), 'the reported phone error is recognised');
for (const m of ['TypeError: Network request failed', 'Failed to fetch', 'getaddrinfo ENOTFOUND x', 'The request timed out', 'Load failed']) assert.ok(isNetworkError(m), m);
for (const m of ['Invalid login credentials', 'You have used today\'s AI allowance.', 'That photo is too large.']) assert.ok(!isNetworkError(m), m);
assert.equal(explain(seen, 'OFFLINE'), 'OFFLINE');
assert.equal(explain('Invalid login credentials', 'OFFLINE'), 'Invalid login credentials');
console.log('Network error tests passed.');
