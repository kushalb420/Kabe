import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import type { Food } from '../data/foods';
import { nativeToEnglish } from '../data/nativeFoods';
import { r0, r1 } from '../lib/nutrition';
import { useT } from '../i18n/useT';
import { useKabe } from '../store/kabe';
import { radius, useColors, useThemedStyles, type Colors } from '../theme';
import { OnlineFoods, useOnlineFood } from './OnlineFoods';

/** Small inline search: your foods first, then an automatic web / AI lookup. Calls onPick with the chosen food. */
export function FoodPicker({ initialQuery, onPick }: { initialQuery: string; onPick: (f: Food) => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { allFoods } = useKabe();
  const { t } = useT();
  const [q, setQ] = useState(initialQuery);

  const local = useMemo(() => {
    const s = nativeToEnglish(q.trim()).toLowerCase();
    if (!s) return [];
    return allFoods.filter((f) => f.name.toLowerCase().includes(s)).slice(0, 6);
  }, [q, allFoods]);
  const lookupQuery = local.length < 3 ? q : '';
  const online = useOnlineFood(lookupQuery);

  return (
    <View style={styles.wrap}>
      <TextInput value={q} onChangeText={setQ} placeholder={t('picker.search')} placeholderTextColor={colors.inkSoft} style={styles.input} />
      {local.map((f) => (
        <Pressable key={f.id} style={styles.row} onPress={() => onPick(f)}>
          <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
          <Text style={styles.sub}>{t('picker.sub', { kcal: r0(f.kcal), protein: t('macro.protein'), p: r1(f.protein) })}</Text>
        </Pressable>
      ))}
      <OnlineFoods online={online} query={lookupQuery} onPick={onPick} />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { gap: 6, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10 },
  input: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10, fontSize: 15, color: colors.ink },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
});
