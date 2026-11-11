import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';
import { Button, Card } from './ui';

/**
 * Camera for the web preview: asks the browser for camera access, shows what the camera sees and takes a picture.
 * (On a phone the app uses the real camera screen instead.) `onShot` gets the picture as base64 JPEG plus a preview address.
 */
export function WebCamera({ onShot, onCancel, onError }: { onShot: (base64: string, uri: string) => void; onCancel: () => void; onError: (message: string) => void }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const video = useRef<any>(null);
  const stream = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (dead) return s.getTracks().forEach((x) => x.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play?.();
        }
        setLive(true);
      } catch {
        if (!dead) onError(t('photo.errCamera'));
      }
    })();
    return () => {
      dead = true;
      stream.current?.getTracks().forEach((x) => x.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shoot = () => {
    const v = video.current as HTMLVideoElement | null;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.6);
    onShot(url.split(',')[1] ?? '', url);
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.frame}>{React.createElement('video', { ref: video, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', background: '#000' } })}</View>
      {!live && <Text style={styles.sub}>{t('log.cameraWait')}</Text>}
      <Button title={t('log.shoot')} icon="camera" disabled={!live} onPress={shoot} />
      <Button title={t('common.cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  frame: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: colors.line },
  sub: { fontSize: 12, color: colors.inkSoft },
});
