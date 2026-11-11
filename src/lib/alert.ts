import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

type Request = { title: string; message?: string; buttons: AlertButton[] };
type Host = (r: Request) => void;
let host: Host | null = null;

/** The on-screen dialog (AlertHost) registers itself here; used on the web, where React Native's own Alert does nothing. */
export function registerAlertHost(h: Host | null): () => void {
  host = h;
  return () => {
    if (host === h) host = null;
  };
}

/**
 * Same as React Native's Alert, and it also works on the web: there the app draws its own dialog (see AlertHost), so
 * buttons like "Delete entry" and "Discard workout" work in every browser, including ones that block window.confirm.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (!host && Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons); // the themed dialog (AlertHost) is used whenever it is on screen
    const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
    if (host) return host({ title, message, buttons: list });
    const text = [title, message].filter(Boolean).join('\n\n');
    if (list.length < 2) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b.style === 'cancel');
    const main = [...list].reverse().find((b) => b !== cancel) ?? list[list.length - 1];
    if (window.confirm(text)) main.onPress?.();
    else cancel?.onPress?.();
  },
};
