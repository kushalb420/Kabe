import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Loading } from '../src/components/Loading';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { Basis, EMPTY_VALUES, LabelNumbers, boxesToValues, checkLabel, hasAnyNumber, kcalFromMacros, labelToFood, parseBox, toPer100, valuesToBoxes } from '../src/lib/label';
import { r0, r1, toDateKey } from '../src/lib/nutrition';
import { readLabel } from '../src/lib/vision';
import { MEALS, MealType, useKabe } from '../src/store/kabe';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack, goHome } from '../src/lib/nav';
import { ensurePermission, explainPermission } from '../src/lib/permissions';
import { useDiscardPhoto } from '../src/lib/photoCache';

type Stage = 'idle' | 'reading' | 'review';
type Boxes = Record<keyof LabelNumbers, string>;
const FIELDS: { key: keyof LabelNumbers; label: Key }[] = [
  { key: 'kcal', label: 'label.fKcal' },
  { key: 'protein', label: 'label.fProtein' },
  { key: 'carbs', label: 'label.fCarbs' },
  { key: 'fat', label: 'label.fFat' },
  { key: 'fiber', label: 'label.fFiber' },
  { key: 'sugar', label: 'label.fSugar' },
  { key: 'satFat', label: 'label.fSatFat' },
  { key: 'sodiumMg', label: 'label.fSodium' },
];

export default function LabelScan() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { t } = useT();
  const k = useKabe();
  const date = params.date ?? toDateKey(new Date());
  const [meal, setMeal] = useState<MealType>((params.meal as MealType) ?? 'snack');
  const [stage, setStage] = useState<Stage>('idle');
  const [uri, setUri] = useState<string | null>(null);
  useDiscardPhoto(uri); // the cached copy of the picture is removed when it is replaced or the screen closes
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [readBasis, setReadBasis] = useState<Basis | 'unclear'>('per100');
  const [basis, setBasis] = useState<Basis>('per100');
  const [servingText, setServingText] = useState('');
  const [boxes, setBoxes] = useState<Boxes>(valuesToBoxes(EMPTY_VALUES));
  const [eatText, setEatText] = useState('');
  const [calculated, setCalculated] = useState(false);
  const [savedFood, setSavedFood] = useState<{ food: ReturnType<typeof k.addCustomFood>; sig: string } | null>(null); // set after 'Save to my foods': the page stays so it can still be logged

  const withDetail = (key: Key, e: unknown) => (e instanceof Error && e.message ? `${t(key)} (${e.message})` : t(key));

  // everything below is worked out from what is in the boxes, so editing any box updates it at once
  const values = boxesToValues(boxes);
  const serving = (() => {
    const s = parseBox(servingText);
    return s !== null && s >= 1 ? s : null;
  })();
  const per100 = toPer100(values, basis, serving);
  const warnings = checkLabel(per100, readBasis, basis, serving);
  const food = labelToFood(name, per100 ?? EMPTY_VALUES, serving);
  const eatG = parseBox(eatText) ?? serving ?? 100;

  const begin = (read?: { name: string; basis: Basis | 'unclear'; servingG: number | null; values: LabelNumbers }) => {
    setName(read?.name ?? '');
    setReadBasis(read?.basis ?? 'per100');
    setBasis(read ? (read.basis === 'perServing' ? 'perServing' : 'per100') : 'per100');
    setServingText(read?.servingG ? String(read.servingG) : '');
    setBoxes(valuesToBoxes(read?.values ?? EMPTY_VALUES));
    setEatText('');
    setCalculated(false);
    setSavedFood(null);
    setStage('review');
  };

  const scan = async (source: 'camera' | 'library') => {
    setError('');
    if (!k.geminiKey) return setError(t('label.needKey'));
    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      if (source === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          return setError(t('photo.errCamera'));
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, base64: true };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      asset = res.assets?.[0];
    } catch (e) {
      return setError(withDetail('photo.errOpen', e));
    }
    if (!asset?.base64) return setError(t('photo.errRead'));
    setUri(asset.uri);
    setStage('reading');
    try {
      const read = await readLabel(k.geminiKey, asset.base64, asset.mimeType ?? 'image/jpeg');
      if (!hasAnyNumber(read.values)) {
        setError(t('label.noNumbers'));
        setStage('idle');
        return;
      }
      begin(read);
    } catch (e) {
      setError(withDetail('photo.errAnalyze', e));
      setStage('idle');
    }
  };

  const setBox = (key: keyof LabelNumbers, v: string) => {
    if (key === 'kcal') setCalculated(false);
    setBoxes((b) => ({ ...b, [key]: v }));
  };

  const canCalc = values.kcal === null && kcalFromMacros(values) !== null;
  const calc = () => {
    // calculated from the numbers as typed, in the same basis as the box (per 100 g or per serving)
    const c = kcalFromMacros(values);
    if (c === null) return;
    setBoxes((b) => ({ ...b, kcal: String(c) }));
    setCalculated(true);
  };

  const save = (andLog: boolean) => {
    if (!food) return Alert.alert(t('label.needNameKcal'));
    // saving twice must not create a second copy: after the first save the same food is reused
    const same = savedFood && savedFood.sig === JSON.stringify(food) ? savedFood.food : null;
    const created = same ?? k.addCustomFood(food);
    if (!same) k.toggleFavorite(created); // so it shows up under Saved foods straight away
    if (andLog) {
      k.addEntry(created, eatG, meal, date);
      goHome();
    } else {
      Alert.alert(t('label.saved'), t('label.savedBody', { name: created.name }));
      setSavedFood({ food: created, sig: JSON.stringify(food) });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('label.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {stage === 'idle' && (
          <Card style={{ gap: 10 }}>
            <Text style={styles.body}>{t('label.intro')}</Text>
            {k.geminiKey && !k.aiConsent ? (
              <>
                <Text style={styles.h2}>{t('photo.googleTitle')}</Text>
                <Text style={styles.sub}>{t('photo.consentBody')}</Text>
                <Button title={t('photo.continue')} onPress={() => k.setAiConsent(true)} />
              </>
            ) : (
              <>
                <Button title={t('label.scan')} icon="camera" disabled={!k.geminiKey} onPress={() => scan('camera')} />
                <Button title={t('label.gallery')} icon="images" variant="ghost" disabled={!k.geminiKey} onPress={() => scan('library')} />
                {!k.geminiKey && <Text style={styles.sub}>{t('label.needKey')}</Text>}
              </>
            )}
            <Button title={t('label.typeIt')} icon="create-outline" variant="ghost" onPress={() => begin()} />
            {error ? <Text style={styles.err}>{error}</Text> : null}
          </Card>
        )}

        {stage === 'reading' && (
          <Card style={{ alignItems: 'center', gap: 12 }}>
            {uri && <Image source={{ uri }} style={styles.photo} />}
            <Loading />
            <Text style={styles.body}>{t('label.reading')}</Text>
          </Card>
        )}

        {stage === 'review' && (
          <>
            {uri && <Image source={{ uri }} style={styles.photoSmall} />}
            <Text style={styles.sub}>{t('label.readNote')}</Text>
            <Card style={{ gap: 10 }}>
              <Text style={styles.label}>{t('label.name')}</Text>
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.inkSoft} />

              <Text style={styles.label}>{t('label.basisTitle')}</Text>
              <View style={styles.chips}>
                {(['per100', 'perServing'] as const).map((b) => (
                  <Pressable key={b} onPress={() => setBasis(b)} style={[styles.chip, basis === b && styles.chipOn]}>
                    <Text style={[styles.chipText, basis === b && { color: colors.onPrimary }]}>{t(b === 'per100' ? 'label.per100' : 'label.perServing')}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{t('label.serving')}</Text>
              <TextInput value={servingText} onChangeText={setServingText} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.inkSoft} />

              {FIELDS.map((f) => (
                <View key={f.key}>
                  <Text style={styles.label}>{t(f.label)}</Text>
                  <TextInput value={boxes[f.key]} onChangeText={(v) => setBox(f.key, v)} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.inkSoft} />
                </View>
              ))}
              {canCalc && <Button title={t('label.calcKcal')} variant="ghost" onPress={calc} />}
              {calculated && <Text style={styles.warn}>{t('label.calcNote')}</Text>}
            </Card>

            {warnings.map((w) => (
              <Text key={w} style={styles.warn}>
                ⚠ {t(`label.w.${w}` as Key)}
              </Text>
            ))}

            {per100 && per100.kcal !== null && (
              <Card style={{ gap: 4 }}>
                <Text style={styles.body}>
                  {t('label.preview100', { kcal: r0(per100.kcal), p: r1(per100.protein ?? 0), c: r1(per100.carbs ?? 0), f: r1(per100.fat ?? 0) })}
                </Text>
                {serving !== null && <Text style={styles.sub}>{t('label.previewServing', { g: serving, kcal: r0((per100.kcal * serving) / 100) })}</Text>}
                <Text style={styles.note}>{t('label.mlNote')}</Text>
              </Card>
            )}

            <Card style={{ gap: 8 }}>
              <Text style={styles.label}>{t('label.eat')}</Text>
              <TextInput value={eatText} onChangeText={setEatText} placeholder={String(serving ?? 100)} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.inkSoft} />
              <View style={styles.chips}>
                {MEALS.map((m) => (
                  <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.chip, meal === m.key && styles.chipOn]}>
                    <Text style={[styles.chipText, meal === m.key && { color: colors.onPrimary }]}>{t(`meal.${m.key}` as Key)}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title={t('label.saveAdd')} icon="checkmark" disabled={!food} onPress={() => save(true)} />
              <Button title={t('label.saveFood')} icon="bookmark-outline" variant="ghost" disabled={!food} onPress={() => save(false)} />
              {!food && <Text style={styles.sub}>{t('label.needNameKcal')}</Text>}
            </Card>
            <Button title={t('label.again')} variant="ghost" onPress={() => { setStage('idle'); setUri(null); setError(''); }} />
          </>
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
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  note: { fontSize: 11, color: colors.inkSoft },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 3 },
  warn: { fontSize: 13, color: colors.warn, fontWeight: '700', lineHeight: 18 },
  err: { fontSize: 13, color: colors.danger },
  photo: { width: '100%', height: 220, borderRadius: radius.md },
  photoSmall: { width: '100%', height: 130, borderRadius: radius.md },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
});
