// Turning the route card into a shareable picture. Pure helpers are tested in scripts/test-routecard.ts.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { File, Paths } from 'expo-file-system';
import { Linking, Platform, Share } from 'react-native';
import { base64ToBytes } from './routeCard';
import { StoryData, storyUrl } from './routeShare';

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

type Sharing = { isAvailableAsync: () => Promise<boolean>; shareAsync: (u: string, o?: object) => Promise<void> };
const sharingModule = (): Sharing | null => {
  try {
    if (!requireOptionalNativeModule('ExpoSharing')) return null; // this build has no sharing code: never even load the library
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sharing') as Sharing; // only builds made with it have it
  } catch {
    return null;
  }
};

export type ShareResult = 'image' | 'downloaded' | 'opened' | 'failed';

/**
 * Shares the card as a 9:16 PNG. On the web it opens the share sheet with the picture when the browser allows it, otherwise it
 * downloads the picture. In an app build that can share pictures it uses the phone's share sheet. In an app build that cannot, it
 * opens the same card on the Kabe website, where it can be downloaded.
 */
export async function shareRouteCard(svg: Drawing, data: StoryData): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      const b64 = await render(svg);
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
    const Sharing = sharingModule();
    if (Sharing && (await Sharing.isAvailableAsync().catch(() => false))) {
      const f = new File(Paths.cache, `kabe-route-${Date.now()}.png`);
      f.create({ overwrite: true });
      f.write(base64ToBytes(await render(svg)));
      await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Kabe' });
      return 'image';
    }
    if (Platform.OS === 'ios') {
      const f = new File(Paths.cache, `kabe-route-${Date.now()}.png`);
      f.create({ overwrite: true });
      f.write(base64ToBytes(await render(svg)));
      await Share.share({ url: f.uri });
      return 'image';
    }
    await Linking.openURL(storyUrl(data)); // this build cannot send a picture: the website card can be downloaded
    return 'opened';
  } catch {
    return 'failed';
  }
}
