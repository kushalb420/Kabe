import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import type { Remind } from '../src/lib/itemReminders';
import { ItemReminder } from '../src/components/ItemReminder';
import { SupplementsCard } from '../src/components/SupplementsCard';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ProgressRing } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { toDateKey } from '../src/lib/nutrition';
import { streak } from '../src/lib/tracker';
import { Named, useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function Daily() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const tk = useTracker();
  const { t } = useT();
  const today = toDateKey(new Date());
  const ml = tk.water[today] ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('daily.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Water */}
        <Card style={{ gap: 12, alignItems: 'center' }}>
          <Text style={[styles.h2, { alignSelf: 'flex-start' }]}>{t('macro.water')}</Text>
          <ProgressRing size={140} stroke={12} progress={ml / tk.waterGoal} color="#3B9AE1">
            <Text style={styles.big}>{(ml / 1000).toFixed(2)}</Text>
            <Text style={styles.sub}>{t('daily.ofL', { n: (tk.waterGoal / 1000).toFixed(2) })}</Text>
          </ProgressRing>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {[150, 250, 500].map((v) => (
              <Pressable key={v} style={styles.pill} onPress={() => tk.addWater(today, v)}>
                <Text style={styles.pillText}>+{v} ml</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.pill, { backgroundColor: colors.bg }]} onPress={() => tk.addWater(today, -250)} disabled={ml === 0}>
              <Text style={[styles.pillText, { color: colors.inkSoft }]}>−250</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.sub}>{t('daily.goal')}</Text>
            <Pressable hitSlop={8} onPress={() => tk.setWaterGoal(tk.waterGoal - 250)}>
              <Ionicons name="remove-circle-outline" size={24} color={colors.primary} />
            </Pressable>
            <Text style={styles.rowR}>{tk.waterGoal} ml</Text>
            <Pressable hitSlop={8} onPress={() => tk.setWaterGoal(tk.waterGoal + 250)}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sub}>{t('daily.waterNote')}</Text>
        </Card>

        <SupplementsCard />

        <Checklist
          title={t('daily.habits')}
          emptyHint={t('daily.habitsEmpty')}
          addLabel={t('daily.habitAdd')}
          items={tk.habits}
          done={tk.habitLog[today] ?? []}
          onToggle={(id) => tk.toggleHabit(today, id)}
          onAdd={(name) => tk.addHabit(name)}
          onRemove={tk.removeHabit}
          onRemind={(id, r) => tk.setItemReminder('habit', id, r)}
          streakFor={(id) => streak(tk.habitLog, id, today)}
        />
      </ScrollView>
    </View>
  );
}

function Checklist({
  title,
  emptyHint,
  addLabel,
  items,
  done,
  onToggle,
  onAdd,
  onRemove,
  onRemind,
  streakFor,
}: {
  title: string;
  emptyHint: string;
  addLabel: string;
  items: Named[];
  done: string[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onRemind: (id: string, remind: Remind | null) => void;
  streakFor: (id: string) => number;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
  };
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.h2}>{title}</Text>
        {items.length > 0 && <Text style={styles.sub}>{t('daily.doneToday', { done: done.filter((id) => items.some((i) => i.id === id)).length, total: items.length })}</Text>}
      </View>
      {items.length === 0 && <Text style={styles.sub}>{emptyHint}</Text>}
      {items.map((it) => {
        const on = done.includes(it.id);
        const s = streakFor(it.id);
        return (
          <View key={it.id}>
          <Pressable
            style={styles.row}
            onPress={() => onToggle(it.id)}
            onLongPress={() =>
              Alert.alert(t('daily.deleteAsk', { name: it.name }), t('daily.deleteNote'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: () => onRemove(it.id) },
              ])
            }
          >
            <View style={[styles.check, on && styles.checkOn]}>{on && <Ionicons name="checkmark" size={18} color={colors.onPrimary} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowL}>{it.name}</Text>
            </View>
            {s > 0 && <Text style={styles.streak}>🔥 {t('daily.days', { n: s })}</Text>}
          </Pressable>
          <View style={{ marginLeft: 44 }}>
            <ItemReminder remind={it.remind} onRemind={(r) => onRemind(it.id, r)} />
          </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <TextInput value={name} onChangeText={setName} placeholder={addLabel} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 2, minWidth: 0 }]} onSubmitEditing={add} />
      </View>
      <Button title={t('common.add')} variant="ghost" onPress={add} disabled={!name.trim()} />
      {items.length > 0 && <Text style={styles.sub}>{t('daily.checkHint')}</Text>}
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  big: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, justifyContent: 'space-between' },
  rowL: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  rowR: { fontSize: 15, color: colors.ink, fontWeight: '700' },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  pillText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  streak: { fontSize: 13, fontWeight: '700', color: colors.warn },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
});
