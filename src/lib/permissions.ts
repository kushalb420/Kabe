// One way to ask for a phone permission, used everywhere in the app: look at the current answer, ask only if the phone
// still allows asking (so the system dialog really appears), and say clearly when the person has to turn it on in Settings.
import { Linking, Platform } from 'react-native';
import { Alert } from './alert';

export type PermState = { granted: boolean; canAskAgain?: boolean };
/** granted: go ahead. denied: they said no this time (we can ask again later). blocked: only the phone's Settings can change it. */
export type PermResult = 'granted' | 'denied' | 'blocked';

export async function ensurePermission(get: () => Promise<PermState>, request: () => Promise<PermState>): Promise<PermResult> {
  let p: PermState;
  try {
    p = await get();
  } catch {
    p = { granted: false, canAskAgain: true };
  }
  if (p.granted) return 'granted';
  if (p.canAskAgain !== false) {
    try {
      p = await request();
    } catch {
      return 'denied';
    }
  }
  return p.granted ? 'granted' : p.canAskAgain === false ? 'blocked' : 'denied';
}

type Say = (key: any, vars?: Record<string, string | number>) => string;

/**
 * Tells the person why something did not start and, when only Settings can fix it, offers to open Settings.
 * `what` is the already-translated name of the thing ("the camera").
 */
export function explainPermission(result: PermResult, what: string, t: Say): void {
  if (result === 'granted') return;
  const native = Platform.OS !== 'web';
  Alert.alert(t('perm.title'), t(result === 'blocked' && native ? 'perm.blocked' : 'perm.denied', { what }), [
    { text: t('common.cancel'), style: 'cancel' },
    ...(native ? [{ text: t('perm.open'), onPress: () => void Linking.openSettings().catch(() => {}) }] : []),
  ]);
}
