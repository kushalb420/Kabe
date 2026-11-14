// Turning the route card into a shareable picture. Pure helpers are tested in scripts/test-routecard.ts.
import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';
import { base64ToBytes } from './routeCard';

type Drawing = { toDataURL: (cb: (base64: string) => void, options?: { width?: number; height?: number }) => void };

/** Asks the drawing for a 1080 x 1920 PNG (as base64). */
const render = (svg: Drawing): Promise<string> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The picture took too long.')), 15000);
    try {
      svg.toDataURL((b64) => {
        clearTimeout(timer);
        resolve(b64.replace(/^data:image\/png;base64,/, ''));
      }, { width: 1080, height: 1920 });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });

export type ShareResult = 'image' | 'downloaded' | 'text' | 'failed';

/**
 * Shares the card as a 9:16 PNG. On the web it opens the share sheet with the picture when the browser allows it, otherwise
 * it downloads the picture. In the app it uses the phone's share sheet. A build made before image sharing existed cannot send a
 * picture on Android; there the text is shared instead.
 */
export async function shareStory(svg: Drawing, fallbackText: string): Promise<ShareResult> {
  try {
    const b64 = await render(svg);
    if (Platform.OS === 'web') {
      const bytes = base64ToBytes(b64);
      const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
      const file = new (globalThis as any).File([blob], 'kabe-route.png', { type: 'image/png' });
      const nav = (globalThis as any).navigator;
      if (nav?.canShare?.({ files: [file] })) {
        await nav.share({ files: [file] });
        return 'image';
      }
      const a = (globalThis as any).document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kabe-route.png';
      a.click();
      return 'downloaded';
    }
    const f = new File(Paths.cache, `kabe-route-${Date.now()}.png`);
    f.create({ overwrite: true });
    f.write(base64ToBytes(b64));
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing') as { isAvailableAsync: () => Promise<boolean>; shareAsync: (u: string, o?: object) => Promise<void> };
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Kabe' });
        return 'image';
      }
    } catch {
      /* this build has no image sharing: try the phone's own share sheet */
    }
    if (Platform.OS === 'ios') {
      await Share.share({ url: f.uri });
      return 'image';
    }
    await Share.share({ message: fallbackText });
    return 'text';
  } catch {
    return 'failed';
  }
}
