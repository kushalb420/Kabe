import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';

export type Nutrients = { kcal?: number; sugar?: number; protein?: number; carbs?: number; fiber?: number; satFat?: number; fat?: number };

/** The seven numbers shown everywhere, always in this order. */
export const NUTRIENT_ORDER = ['kcal', 'sugar', 'protein', 'carbs', 'fiber', 'satFat', 'fat'] as const;
export type NutrientId = (typeof NUTRIENT_ORDER)[number];

export const formatNutrient = (id: NutrientId, v: number | undefined): string => {
  if (v === undefined || !isFinite(v)) return '–';
  return id === 'kcal' ? String(Math.round(v)) : `${Math.round(v * 10) / 10} g`;
};

export function nutrientColor(id: NutrientId, c: Colors): string {
  return id === 'kcal' ? c.ink : id === 'sugar' ? c.accent : id === 'protein' ? c.protein : id === 'carbs' ? c.carbs : id === 'fiber' ? c.fiber : id === 'satFat' ? c.satFat : c.fat;
}

/** All seven nutrients of a meal or a day: calories on top, then two columns. */
export function NutrientGrid({ values, compact }: { values: Nutrients; compact?: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const tile = (id: NutrientId, wide?: boolean) => (
    <View key={id} style={[styles.tile, compact && styles.small, wide && styles.wide]}>
      <View style={[styles.dot, { backgroundColor: nutrientColor(id, colors) }]} />
      <Text style={styles.label} numberOfLines={1}>
        {t(`macro.${id}` as Key)}
      </Text>
      <Text style={[styles.value, id === 'kcal' && !compact && styles.big]}>{id === 'kcal' ? `${formatNutrient(id, values[id])}${compact ? '' : ' kcal'}` : formatNutrient(id, values[id])}</Text>
    </View>
  );
  return (
    <View style={styles.grid}>
      {!compact && tile('kcal', true)}
      {NUTRIENT_ORDER.slice(1).map((id) => tile(id))}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  small: { flexBasis: '31%', flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingVertical: 6, paddingHorizontal: 8 },
  wide: { flexBasis: '100%', backgroundColor: colors.primarySoft },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.line },
  label: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  value: { fontSize: 15, fontWeight: '800', color: colors.ink },
  big: { fontSize: 22 },
});
