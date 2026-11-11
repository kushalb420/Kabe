import { router } from 'expo-router';
import { useEffect } from 'react';

/** Google sends the person back to kabe://auth-callback. The waiting account screen finishes the sign-in, so this just goes back to it. */
export default function AuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  }, []);
  return null;
}
