import assert from 'node:assert/strict';
import { parseAuthRedirect } from '../src/lib/authRedirect';

assert.deepEqual(parseAuthRedirect('kabe://auth-callback#access_token=AAA&refresh_token=RRR&expires_in=3600&token_type=bearer'), { accessToken: 'AAA', refreshToken: 'RRR' });
assert.deepEqual(parseAuthRedirect('kabe://auth-callback?code=abc123'), { code: 'abc123' });
assert.deepEqual(parseAuthRedirect('exp://192.168.1.5:8081/--/auth-callback#access_token=A&refresh_token=R'), { accessToken: 'A', refreshToken: 'R' });
assert.deepEqual(parseAuthRedirect('kabe://auth-callback#error=access_denied&error_description=User+cancelled'), { error: 'User cancelled' });
assert.deepEqual(parseAuthRedirect('kabe://auth-callback?error=server_error'), { error: 'server_error' });
assert.equal(parseAuthRedirect('kabe://auth-callback'), null);
assert.equal(parseAuthRedirect('kabe://auth-callback#access_token=only'), null, 'both tokens are needed');
console.log('google auth: ok');
