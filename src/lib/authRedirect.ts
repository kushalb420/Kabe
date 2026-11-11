// What Supabase puts in the link that sends the app back after Google sign-in (pure, tested in scripts/test-googleauth.ts).
export type AuthRedirect = { accessToken: string; refreshToken: string } | { code: string } | { error: string } | null;

/** What Supabase put in the link it sent the app back to: tokens (after #), a code (after ?), or an error. */
export function parseAuthRedirect(url: string): AuthRedirect {
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const p = new URLSearchParams(`${query}&${hash}`);
  const error = p.get('error_description') ?? p.get('error');
  if (error) return { error: error.replace(/\+/g, ' ') };
  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  const code = p.get('code');
  return code ? { code } : null;
}
