import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { toDateKey } from '../src/lib/nutrition';
import { deletePhotoFiles, savePhotoCopy } from '../src/lib/photoFiles';
import { ProgressPhoto, comparePair, nearestWeight, newestFirst } from '../src/lib/progressPhotos';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';
import { ensurePermission, explainPermission } from '../src/lib/permissions';

export default function Photos() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const tk = useTracker();
  const [error, setError] = useState('');
  const list = useMemo(() => newestFirst(tk.photos), [tk.photos]);
  const pair = useMemo(() => comparePair(tk.photos), [tk.photos]);

  const add = async (source: 'camera' | 'library') => {
    setError('');
    try {
      if (source === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          return setError(t('photo.errCamera'));
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const uri = await savePhotoCopy(res.assets[0].uri, id);
      tk.addPhoto({ id, date: toDateKey(new Date()), uri });
    } catch {
      setError(t('photo.errOpen'));
    }
  };

  const remove = (p: ProgressPhoto) =>
    Alert.alert(t('photos.deleteQ'), t('photos.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deletePhotoFiles([p.uri]);
          tk.removePhoto(p.id);
        },
      },
    ]);

  const kg = (date: string) => {
    const v = nearestWeight(tk.weights, date);
    return v === null ? '' : ` · ${t('photos.kg', { kg: v })}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('photos.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <Card style={{ gap: 10 }}>
          <Button title={t('photos.take')} icon="camera" onPress={() => add('camera')} />
          <Button title={t('photos.pick')} icon="images" variant="ghost" onPress={() => add('library')} />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Text style={styles.sub}>{t('photos.privacy')}</Text>
        </Card>

        {list.length === 0 && (
          <Card>
            <Text style={styles.body}>{t('photos.empty')}</Text>
          </Card>
        )}

        {pair && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('photos.compareTitle')}</Text>
            <Text style={styles.sub}>{t('photos.compareSub', { days: pair.days })}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { p: pair.before, label: t('photos.before') },
                { p: pair.after, label: t('photos.after') },
              ].map(({ p, label }) => (
                <View key={p.id} style={{ flex: 1, gap: 4 }}>
                  <Image source={{ uri: p.uri }} style={styles.big} resizeMode="cover" />
                  <Text style={styles.name}>{label}</Text>
                  <Text style={styles.sub}>{p.date}{kg(p.date)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {list.length > 0 && (
          <View style={styles.grid}>
            {list.map((p) => (
              <View key={p.id} style={styles.cell}>
                <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
                <Text style={styles.sub}>{p.date}</Text>
                <Pressable onPress={() => remove(p)} hitSlop={8} accessibilityLabel={t('photos.delete')}>
                  <Text style={[styles.sub, { color: colors.danger, fontWeight: '700' }]}>{t('photos.delete')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  err: { fontSize: 13, color: colors.danger },
  big: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%', gap: 3 },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
});
