import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import { r0, sumMacros } from '../src/lib/nutrition';
import { useKabe } from '../src/store/kabe';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

export default function SaveMeal() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const { entries, saveMeal, saveFoods } = useKabe();
  const insets = useSafeAreaInsets();
  const items = entries.filter((e) => e.date === date && e.meal === meal);
  const { t, tn } = useT();
  const label = t(`meal.${meal}` as Key);
  const [name, setName] = useState('');
  const [keep, setKeep] = useState<string[]>([]); // ids of items to also save as foods on their own
  const total = sumMacros(items);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <Dots />
      <Text style={styles.title}>{t('saveMeal.title', { meal: label })}</Text>
      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>{t('saveMeal.name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('saveMeal.placeholder')}
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
          autoFocus
        />
        <Text style={styles.sub}>
          {tn('saveMeal.items', items.length)} · {r0(total.kcal)} kcal · {t('macro.protein')} {r0(total.protein)}g
        </Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>{t('saveMeal.eachFood')}</Text>
          <Pressable hitSlop={8} onPress={() => setKeep(keep.length === items.length ? [] : items.map((i) => i.id))}>
            <Text style={styles.link}>{keep.length === items.length ? t('saveMeal.none') : t('saveMeal.all')}</Text>
          </Pressable>
        </View>
        {items.map((i) => {
          const on = keep.includes(i.id);
          return (
            <Pressable key={i.id} style={styles.itemRow} onPress={() => setKeep(on ? keep.filter((x) => x !== i.id) : [...keep, i.id])}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.inkSoft} />
              <Text style={[styles.item, { flex: 1 }]} numberOfLines={2}>
                {i.name} ({r0(i.grams)} g)
              </Text>
            </Pressable>
          );
        })}
      </Card>
      <Button
        title={t('saveMeal.save')}
        icon="bookmark"
        disabled={!name.trim() || !items.length}
        onPress={() => {
          saveMeal(name.trim(), items);
          saveFoods(items.filter((i) => keep.includes(i.id)));
          goBack();
        }}
      />
      <Button title={t('common.cancel')} variant="ghost" onPress={() => goBack()} />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink },
  sub: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  item: { fontSize: 14, color: colors.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
