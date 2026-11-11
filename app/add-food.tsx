import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { LogFlow } from '../src/components/LogFlow';
import { MyFoods } from '../src/components/MyFoods';
import { PressScale } from '../src/components/Motion';
import { Text } from '../src/components/Text';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { toDateKey } from '../src/lib/nutrition';
import { MEALS, MealType } from '../src/store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

const guessMeal = (): MealType => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
};

type Tab = 'describe' | 'mine';

/** The other ways to log: photo of your plate, your voice, a food label and a restaurant menu (no barcode scanning). */
const WAYS: { icon: keyof typeof Ionicons.glyphMap; label: Key; path: '/photo' | '/voice' | '/label' | '/restaurant' }[] = [
  { icon: 'camera-outline', label: 'addFood.wayPhoto', path: '/photo' },
  { icon: 'mic-outline', label: 'addFood.wayVoice', path: '/voice' },
  { icon: 'pricetag-outline', label: 'addFood.wayLabel', path: '/label' },
  { icon: 'receipt-outline', label: 'addFood.wayMenu', path: '/restaurant' },
];

/** Log food. Describe what you ate (type, speak or take a photo) or pick something you have logged before. */
export default function AddFood() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const date = params.date ?? toDateKey(new Date());
  const [meal, setMeal] = useState<MealType>((params.meal as MealType) ?? guessMeal());
  const [tab, setTab] = useState<Tab>('describe');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Dots />
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
        <Text style={styles.title}>{t('addFood.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View style={styles.ways}>
          {WAYS.map((w) => (
            <PressScale key={w.path} style={{ flex: 1, alignSelf: 'stretch' }} onPress={() => router.push({ pathname: w.path, params: { date, meal } })} accessibilityLabel={t(w.label)}>
              <View style={styles.way}>
                <Ionicons name={w.icon} size={24} color={colors.ink} />
                <Text style={styles.wayText} numberOfLines={2}>{t(w.label)}</Text>
              </View>
            </PressScale>
          ))}
        </View>

        <View style={styles.seg}>
          {(['describe', 'mine'] as const).map((k) => (
            <Pressable key={k} style={[styles.segBtn, tab === k && styles.segOn]} onPress={() => setTab(k)}>
              <Ionicons name={k === 'describe' ? 'sparkles-outline' : 'bookmark-outline'} size={16} color={tab === k ? colors.onPrimary : colors.ink} />
              <Text style={[styles.segText, tab === k && { color: colors.onPrimary }]}>{t(k === 'describe' ? 'addFood.tabDescribe' : 'addFood.tabMine')}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'describe' ? (
          <LogFlow mode="text" embedded />
        ) : (
          <>
            <View style={styles.mealRow}>
              {MEALS.map((m) => (
                <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.chip, meal === m.key && styles.chipOn]}>
                  <Text style={[styles.chipText, meal === m.key && { color: colors.onPrimary }]}>{t(`meal.${m.key}` as Key)}</Text>
                </Pressable>
              ))}
            </View>
            <MyFoods meal={meal} date={date} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  ways: { flexDirection: 'row', gap: 8 },
  way: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder },
  wayText: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  mealRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
