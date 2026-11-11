import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Loading } from '../Loading';
import { Alert } from '../../lib/alert';
import { useT } from '../../i18n/useT';
import { pantryFromPhoto } from '../../lib/kitchenNet';
import { useKabe } from '../../store/kabe';
import { useKitchen } from '../../store/kitchen';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../theme';
import { Text, TextInput } from '../Text';
import { Button, Card } from '../ui';
import { Sticker } from '../Sticker';
import { ensurePermission, explainPermission } from '../../lib/permissions';

/** What you have at home. Meal ideas are made from this list. */
export function PantryTab() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { geminiKey, aiConsent } = useKabe();
  const kit = useKitchen();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const add = () => {
    if (!name.trim()) return;
    kit.addPantry(name, qty);
    setName('');
    setQty('');
  };

  const fromPhoto = async (source: 'camera' | 'library') => {
    setNote('');
    try {
      if (source === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          return setNote(t('photo.errCamera'));
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = res.canceled ? undefined : res.assets?.[0];
      if (!asset?.base64) return;
      setBusy(true);
      const found = await pantryFromPhoto(geminiKey, asset.base64, asset.mimeType ?? 'image/jpeg', kit.pantry);
      setNote(t('k2.photoAdded', { n: kit.addPantryMany(found) }));
    } catch {
      setNote(t('k2.again'));
    } finally {
      setBusy(false);
    }
  };

  const ready = !!geminiKey && aiConsent;

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.sub}>{t('k2.pantryHint')}</Text>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder={t('k2.pantryName')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 2, minWidth: 0 }]} onSubmitEditing={add} />
          <TextInput value={qty} onChangeText={setQty} placeholder={t('k2.pantryQty')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1.4 }]} onSubmitEditing={add} />
        </View>
        <Button title={t('common.add')} icon="add" variant="ghost" onPress={add} disabled={!name.trim()} />
        {ready && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={t('log.photo')} icon="camera" variant="ghost" onPress={() => fromPhoto('camera')} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('log.gallery')} icon="images" variant="ghost" onPress={() => fromPhoto('library')} disabled={busy} />
            </View>
          </View>
        )}
        {busy && <Loading />}
        {note ? <Text style={styles.sub}>{note}</Text> : null}
      </Card>

      {kit.pantry.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Sticker name="mascot" size={110} tilt={-4} bob />
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t('k2.pantryEmpty')}</Text>
        </View>
      ) : (
        <Card style={{ gap: 2 }}>
          {kit.pantry.map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={[styles.name, { flex: 1 }]}>{p.name}</Text>
              {p.qty ? <Text style={styles.sub}>{p.qty}</Text> : null}
              <Pressable onPress={() => kit.removePantry(p.id)} hitSlop={10} accessibilityLabel={t('common.remove')}>
                <Ionicons name="close-circle-outline" size={22} color={colors.inkSoft} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {kit.pantry.length > 0 && (
        <Pressable onPress={() => Alert.alert(t('k2.pantryClear'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: kit.clearPantry }])}>
          <Text style={styles.link}>{t('k2.pantryClear')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  link: { fontSize: 13, fontWeight: '700', color: colors.danger, textAlign: 'center' },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
