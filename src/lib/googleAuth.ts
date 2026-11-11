// "Continue with Google" through Supabase's Google provider (pure parsing is tested in scripts/test-googleauth.ts).
// On the phone the phone's browser opens, Google asks which account, and Kabe gets the session back through its own link
// (kabe://auth-callback). On the web the page itself goes to Google and returns to /account.
import type { SupabaseClient } from '@supabase/supabase-js';
import { Linking, Platform } from 'react-native';
import { parseAuthRedirect } from './authRedirect';

/**
 * Google opens in the phone's own browser (no extra native module, so it works in every build) and the app waits for the sign-in to come back through its own link (kabe://auth-callback).
 */
function viaPhoneBrowser(start: string, redirectTo: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (url: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sub.remove();
      resolve(url);
    };
    const sub = Linking.addEventListener('url', (e) => {
      if (e.url.startsWith(redirectTo)) finish(e.url);
    });
    const timer = setTimeout(() => finish(null), 5 * 60_000);
    Linking.openURL(start).catch(() => finish(null));
  });
}

/** Signs in (or creates the account) with Google. Returns false when the person closed the window or the page left for Google. */
export async function signInWithGoogle(sb: SupabaseClient): Promise<boolean> {
  if (Platform.OS === 'web') {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/account`, queryParams: { prompt: 'select_account' } } });
    if (error) throw new Error(error.message);
    return false; // the page is on its way to Google
  }
  const redirectTo = 'kabe://auth-callback'; // the app's own link scheme (app.json)
  const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
  if (error || !data.url) throw new Error(error?.message ?? 'Could not start Google sign-in.');
  const back = await viaPhoneBrowser(data.url, redirectTo);
  if (!back) return false;
  const parsed = parseAuthRedirect(back);
  if (!parsed) throw new Error('Google did not send the sign-in back. Please try again.');
  if ('error' in parsed) throw new Error(parsed.error);
  if ('code' in parsed) {
    const r = await sb.auth.exchangeCodeForSession(parsed.code);
    if (r.error) throw new Error(r.error.message);
  } else {
    const r = await sb.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
    if (r.error) throw new Error(r.error.message);
  }
  return true;
}
