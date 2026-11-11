import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/ui';
import { MUSCLES, Muscle } from '../src/data/exercises';
import { useKabe } from '../src/store/kabe';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

export default function PickExercise() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { allExercises, addExerciseToActive, addCustomExercise } = useKabe();
  const { t } = useT();
  const muscleName = (m: string) => t(`muscle.${m}` as Key);
  // custom equipment names or older data fall back to the stored text
  const equipName = (e: string) => (['Barbell', 'Dumbbell', 'Bodyweight', 'Machine', 'Cable', 'Kettlebell'].includes(e) ? t(`equip.${e}` as Key) : e);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [showOwn, setShowOwn] = useState(false);
  const [ownName, setOwnName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<Muscle>('Full body');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allExercises.filter((x) => (!muscle || x.muscle === muscle) && (!s || x.name.toLowerCase().includes(s)));
  }, [q, muscle, allExercises]);

  const name = (ownName.trim() || q.trim());
  const noExactMatch = name.length > 1 && !allExercises.some((x) => x.name.toLowerCase() === name.toLowerCase());
  const formOpen = showOwn || (q.trim().length > 1 && noExactMatch);

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 16) }]}>
      <Dots />
      <View style={styles.header}>
        <Text style={styles.title}>{t('pick.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.inkSoft} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('pick.search')} placeholderTextColor={colors.inkSoft} style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.ink }} />
      </View>
      <View style={styles.chips}>
        {MUSCLES.map((m) => (
          <Pressable key={m} onPress={() => setMuscle(muscle === m ? null : m)} style={[styles.chip, muscle === m && styles.chipOn]}>
            <Text style={[styles.chipText, muscle === m && { color: colors.onPrimary }]}>{muscleName(m)}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        ListHeaderComponent={
          !formOpen ? (
            <Pressable style={styles.custom} onPress={() => setShowOwn(true)} accessibilityRole="button">
              <Text style={styles.itemName}>{t('pick.addOwn')}</Text>
            </Pressable>
          ) : (
            <View style={styles.custom}>
              <TextInput value={ownName || q} onChangeText={setOwnName} placeholder={t('pick.ownName')} placeholderTextColor={colors.inkSoft} style={{ paddingVertical: 10, fontSize: 15, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line }} />
              <Text style={styles.itemName}>{t('pick.addCustom', { name: (ownName || q).trim() })}</Text>
              <View style={styles.chips}>
                {MUSCLES.map((m) => (
                  <Pressable key={m} onPress={() => setCustomMuscle(m)} style={[styles.chip, customMuscle === m && styles.chipOn]}>
                    <Text style={[styles.chipText, customMuscle === m && { color: colors.onPrimary }]}>{muscleName(m)}</Text>
                  </Pressable>
                ))}
              </View>
              <Button
                title={t('pick.create')}
                disabled={!(ownName || q).trim()}
                onPress={() => {
                  addExerciseToActive(addCustomExercise((ownName || q).trim(), customMuscle));
                  goBack();
                }}
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => {
              addExerciseToActive(item);
              goBack();
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSub}>{muscleName(item.muscle)} · {equipName(item.equipment)}</Text>
            </View>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          </Pressable>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18, marginBottom: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  itemSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  custom: { gap: 10, paddingVertical: 8, marginHorizontal: -18, paddingHorizontal: 0 },
});
