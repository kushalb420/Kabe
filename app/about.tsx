import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { CARE_IDS, CareId, GOAL_IDS, GoalId, MAX_NOTE, STRUGGLE_IDS, StruggleId, isAnswered, toggle } from '../src/lib/intent';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function About() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const k = useKabe();
  const tk = useTracker();
  const [goals, setGoals] = useState<GoalId[]>(k.intent.goals);
  const [struggles, setStruggles] = useState<StruggleId[]>(k.intent.struggles);
  const [care, setCare] = useState<CareId[]>(k.intent.care);
  const [note, setNote] = useState(k.intent.note);
  const [gw, setGw] = useState(tk.goalWeight ? String(tk.goalWeight) : '');
  const [saved, setSaved] = useState(false);

  const save = () => {
    const intent = { goals, struggles, care, note, answered: false };
    k.setIntent({ ...intent, answered: isAnswered(intent) });
    const v = parseFloat(gw.replace(',', '.'));
    tk.setGoalWeight(v >= 30 && v <= 250 ? Math.round(v * 10) / 10 : null);
    setSaved(true);
  };

  const chips = <T extends string>(ids: readonly T[], on: T[], set: (l: T[]) => void, prefix: string, max: number) => (
    <View style={styles.wrap}>
      {ids.map((id) => (
        <Pressable key={id} onPress={() => { set(toggle(on, id, max)); setSaved(false); }} style={[styles.chip, on.includes(id) && styles.chipOn]}>
          <Text style={[styles.chipText, on.includes(id) && { color: colors.onPrimary }]}>{t(`${prefix}${id}` as Key)}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('about.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.sub}>{t('about.intro')}</Text>

        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('about.goalsQ')}</Text>
          {chips(GOAL_IDS, goals, setGoals, 'about.goal.', 4)}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('about.strugglesQ')}</Text>
          {chips(STRUGGLE_IDS, struggles, setStruggles, 'about.struggle.', 8)}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('about.careQ')}</Text>
          {chips(CARE_IDS, care, setCare, 'about.care.', 8)}
          <Text style={styles.sub}>{t('about.careNote')}</Text>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('about.goalWeight')}</Text>
          <TextInput value={gw} onChangeText={(v) => { setGw(v); setSaved(false); }} keyboardType="decimal-pad" style={[styles.input, { width: 120 }]} />
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('about.noteQ')}</Text>
          <TextInput
            value={note}
            onChangeText={(v) => { setNote(v.slice(0, MAX_NOTE)); setSaved(false); }}
            multiline
            placeholder={t('about.notePh')}
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          />
        </Card>

        <Button title={t('about.save')} icon="checkmark" onPress={save} />
        {saved && <Text style={styles.ok}>{t('about.saved')}</Text>}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  ok: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
});
