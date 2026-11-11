import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { MAX_EVERY, MAX_TIMES, Schedule, SuppMode } from '../lib/supplements';
import { useKabe } from '../store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';

const MODES: SuppMode[] = ['daily', 'every', 'weekdays', 'asNeeded'];
const QUICK_EVERY = [2, 3, 5, 7, 10, 14, 30];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short weekday name (0 = Sunday) in the app's language. */
export function dayName(i: number, language: string): string {
  try {
    return new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(`${language}-IN`, { weekday: 'short', timeZone: 'UTC' });
  } catch {
    return EN_DAYS[i];
  }
}

function Step({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={styles.stepRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable style={[styles.stepBtn, value <= min && { opacity: 0.4 }]} onPress={() => onChange(Math.max(min, value - 1))} accessibilityLabel="−">
          <Text style={[styles.stepTxt, { color: colors.ink }]}>−</Text>
        </Pressable>
        <Text style={styles.stepVal}>{value}</Text>
        <Pressable style={[styles.stepBtn, value >= max && { opacity: 0.4 }]} onPress={() => onChange(Math.min(max, value + 1))} accessibilityLabel="+">
          <Text style={[styles.stepTxt, { color: colors.ink }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * How often a supplement is taken: every day, every few days (every 2, 3, 7, 14, 30... days, any number up to 60), on chosen
 * weekdays, or only when needed, and how many doses on each of those days (1 to 6).
 */
export function ScheduleEditor({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { t } = useT();
  const { language } = useKabe();
  const chip = (on: boolean, text: string, onPress: () => void, key?: string | number) => (
    <Pressable key={key} onPress={onPress} style={[styles.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={[styles.chipText, on && { color: colors.onPrimary }]}>{text}</Text>
    </Pressable>
  );
  const toggleDay = (d: number) => {
    const has = value.days.includes(d);
    if (has && value.days.length === 1) return; // at least one day stays chosen
    onChange({ ...value, days: has ? value.days.filter((x) => x !== d) : [...value.days, d].sort() });
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>{t('supp.howOften')}</Text>
      <View style={styles.wrap}>{MODES.map((m) => chip(value.mode === m, t(`supp.mode.${m}` as Key), () => onChange({ ...value, mode: m }), m))}</View>

      {value.mode === 'every' && (
        <>
          <View style={styles.wrap}>{QUICK_EVERY.map((n) => chip(value.every === n, String(n), () => onChange({ ...value, every: n }), n))}</View>
          <Step label={t('supp.everyLabel')} value={value.every} min={2} max={MAX_EVERY} onChange={(n) => onChange({ ...value, every: n })} />
        </>
      )}
      {value.mode === 'weekdays' && (
        <>
          <Text style={styles.label}>{t('supp.pickDays')}</Text>
          <View style={styles.wrap}>{[1, 2, 3, 4, 5, 6, 0].map((d) => chip(value.days.includes(d), dayName(d, language), () => toggleDay(d), d))}</View>
        </>
      )}
      {value.mode !== 'asNeeded' && <Step label={t('supp.timesLabel')} value={value.times} min={1} max={MAX_TIMES} onChange={(n) => onChange({ ...value, times: n })} />}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: BORDER, borderColor: colors.line, backgroundColor: colors.card },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 18, fontWeight: '800' },
  stepVal: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.ink },
});
