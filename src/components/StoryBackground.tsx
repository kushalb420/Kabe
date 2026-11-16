import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { BORDER, radius, useThemedStyles, useColors, type Colors } from '../theme';
import type { StoryBg } from './RouteStory';
import { Text } from './Text';

const KEY = 'kabe.storyBg.v1';
const CHOICES: StoryBg[] = ['theme', 'black', 'cream', 'photo'];

/** The chosen background for the route card (remembered), and the person's own photo for it (kept only while the screen is open). */
export function useStoryBg() {
  const [bg, setBgState] = useState<StoryBg>('theme');
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'theme' || v === 'black' || v === 'cream') setBgState(v);
      })
      .catch(() => {});
  }, []);
  const setBg = useCallback((b: StoryBg) => {
    setBgState(b);
    if (b !== 'photo') AsyncStorage.setItem(KEY, b).catch(() => {}); // the photo itself is never stored
  }, []);
  return { bg, photo, setBg, setPhoto };
}

/** Four small choices under the card: app theme, black, off-white, or your own photo. */
export function StoryBgPicker({ bg, setBg, setPhoto, allowPhoto = true }: { bg: StoryBg; setBg: (b: StoryBg) => void; setPhoto: (p: string | null) => void; allowPhoto?: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [msg, setMsg] = useState('');
  const pickPhoto = async () => {
    setMsg('');
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      const a = res.canceled ? undefined : res.assets?.[0];
      if (!a) return;
      if (!a.base64) {
        setMsg(t('route.bg.photoFail'));
        return;
      }
      setPhoto(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
      setBg('photo');
    } catch {
      setMsg(t('route.bg.photoFail'));
    }
  };
  const swatch = (b: StoryBg) => (b === 'black' ? '#0E0E0E' : b === 'cream' ? '#F4F0E6' : b === 'theme' ? colors.bg : colors.card);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.title}>{t('route.bg.title')}</Text>
      <View style={styles.row}>
        {CHOICES.filter((b) => allowPhoto || b !== 'photo').map((b) => (
          <Pressable key={b} onPress={() => (b === 'photo' ? void pickPhoto() : setBg(b))} style={[styles.chip, bg === b && styles.chipOn]} accessibilityRole="button">
            <View style={[styles.swatch, { backgroundColor: swatch(b) }]} />
            <Text style={[styles.chipText, bg === b && { color: colors.onPrimary }]}>{t(`route.bg.${b}` as Key)}</Text>
          </Pressable>
        ))}
      </View>
      {msg ? <Text style={styles.sub}>{msg}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.line },
  sub: { fontSize: 12, color: colors.inkSoft },
});
