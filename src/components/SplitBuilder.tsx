import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Routine } from '../store/kabe';
import { useKabe } from '../store/kabe';
import { useT } from '../i18n/useT';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

/** Build or edit your own split: a name, the exercises you choose and how many sets of each. */
export function SplitBuilder({ routine, onDone }: { routine?: Routine; onDone: () => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { allExercises, createRoutine, updateRoutine } = useKabe();
  const [name, setName] = useState(routine?.name ?? '');
  const [picked, setPicked] = useState<Routine['exercises']>(routine?.exercises ?? []);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return allExercises.filter((e) => e.name.toLowerCase().includes(s) || e.muscle.toLowerCase().includes(s)).slice(0, 8);
  }, [q, allExercises]);
  const has = (id: string) => picked.some((p) => p.exerciseId === id);
  const save = () => {
    if (routine) updateRoutine(routine.id, name, picked);
    else createRoutine(name, picked);
    onDone();
  };
  const setSets = (id: string, d: number) => setPicked((p) => p.map((x) => (x.exerciseId === id ? { ...x, sets: Math.min(10, Math.max(1, x.sets + d)) } : x)));
  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.h2}>{routine ? t('split.edit') : t('split.new')}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={t('split.name')} placeholderTextColor={colors.inkSoft} style={styles.input} />
      {picked.map((p) => (
        <View key={p.exerciseId} style={styles.row}>
          <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          <Pressable onPress={() => setSets(p.exerciseId, -1)} hitSlop={8}><Ionicons name="remove-circle-outline" size={24} color={colors.primary} /></Pressable>
          <Text style={styles.sets}>{t('split.sets', { n: p.sets })}</Text>
          <Pressable onPress={() => setSets(p.exerciseId, 1)} hitSlop={8}><Ionicons name="add-circle-outline" size={24} color={colors.primary} /></Pressable>
          <Pressable onPress={() => setPicked((x) => x.filter((y) => y.exerciseId !== p.exerciseId))} hitSlop={8}><Ionicons name="close-circle-outline" size={22} color={colors.inkSoft} /></Pressable>
        </View>
      ))}
      <TextInput value={q} onChangeText={setQ} placeholder={t('split.search')} placeholderTextColor={colors.inkSoft} style={styles.input} />
      {matches.map((m) => (
        <Pressable key={m.id} style={styles.row} disabled={has(m.id)} onPress={() => { setPicked((p) => [...p, { exerciseId: m.id, name: m.name, sets: 3 }]); setQ(''); }}>
          <Text style={[styles.name, { flex: 1 }, has(m.id) && { color: colors.inkSoft }]}>{m.name}</Text>
          <Text style={styles.sub}>{m.muscle}</Text>
        </Pressable>
      ))}
      <Button title={t('common.save')} icon="checkmark" onPress={save} disabled={!name.trim() || picked.length === 0} />
      <Button title={t('common.cancel')} variant="ghost" onPress={onDone} />
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
  sets: { fontSize: 13, fontWeight: '700', color: colors.ink, minWidth: 52, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
});
