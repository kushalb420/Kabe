// Pure helpers for the Supabase connection settings and error messages (kept free of native imports so they are testable).
export type CloudConfig = { url: string; key: string };

export const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

/** Legacy keys are JWTs; read the role claim so we can refuse a service_role key. */
function jwtRole(key: string): string | null {
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(typeof atob === 'function' ? atob(b64) : '{}');
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** Cheap checks so a mistyped URL/key gives a clear message before any network call. null = looks fine. */
export function validateConfig(c: CloudConfig): string | null {
  const url = normalizeUrl(c.url);
  // hosted projects, or a local Supabase for development (supabase start → http://127.0.0.1:54321)
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) return 'The Project URL should look like https://abcdefgh.supabase.co';
  const key = c.key.trim();
  if (key.length < 20 || /\s/.test(key)) return 'That key looks too short. Copy the whole "publishable" (or "anon") key.';
  if (/^sb_secret_/i.test(key) || jwtRole(key) === 'service_role') return 'That is a SECRET key. Never put it in an app — use the "publishable" or "anon" key instead.';
  return null;
}

export const friendlyCloudError = (e: { message?: string } | null | undefined): string => {
  const m = e?.message ?? 'Something went wrong.';
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first (check your inbox), or turn off "Confirm email" in Supabase → Authentication → Providers → Email.';
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account — use Sign in.';
  if (/Password should be at least/i.test(m)) return m;
  if (/relation .*kabe_sync.* does not exist|Could not find the table/i.test(m)) return 'The sync table is missing. Run the SQL from the setup steps in Supabase → SQL Editor.';
  if (/Failed to fetch|Network request failed/i.test(m)) return 'No connection to Supabase. Check your internet and the Project URL.';
  if (/Invalid API key|apikey/i.test(m)) return 'Supabase rejected the key. Re-copy the publishable key.';
  return m;
};
