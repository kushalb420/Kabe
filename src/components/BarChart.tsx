import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useColors, useThemedStyles, type Colors } from '../theme';

/** Tiny bar chart: one bar per item, optional goal line. Values of 0 show as an empty slot. */
export function BarChart({
  data,
  goal,
  color,
  height = 96,
  format = (v: number) => String(Math.round(v * 10) / 10),
}: {
  data: { label: string; value: number }[];
  goal?: number;
  color?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  return (
    <View>
      <View style={[styles.row, { height }]}>
        {goal ? <View style={[styles.goal, { bottom: (goal / max) * (height - 18) + 18 }]} /> : null}
        {data.map((d, i) => (
          <View key={i} style={styles.col}>
            <Text style={styles.val}>{d.value > 0 ? format(d.value) : ''}</Text>
            <View style={styles.slot}>
              <View style={[styles.bar, { height: `${(d.value / max) * 100}%`, backgroundColor: goal && d.value >= goal ? colors.primary : (color ?? colors.primary), opacity: i === data.length - 1 ? 1 : 0.75 }]} />
            </View>
            <Text style={styles.lab}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  slot: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5, minHeight: 2 },
  val: { fontSize: 10, color: colors.inkSoft, height: 14 },
  lab: { fontSize: 11, color: colors.inkSoft, marginTop: 4 },
  goal: { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.accent },
});
