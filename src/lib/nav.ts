import { router } from 'expo-router';

/** Go back one screen; if there is nothing behind this screen (opened directly, or after a refresh), go to Today instead of erroring. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/** Close every screen stacked above Today; safe when there is nothing to close. */
export function goHome(): void {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    /* nothing to dismiss */
  }
  router.replace('/(tabs)');
}
