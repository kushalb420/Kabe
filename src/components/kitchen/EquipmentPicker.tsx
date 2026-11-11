import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { EQUIPMENT_IDS, Equipment } from '../../lib/kitchenAi';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../theme';
import { Text } from '../Text';

const ICONS: Record<(typeof EQUIPMENT_IDS)[number], keyof typeof Ionicons.glyphMap> = {
  stove: 'flame-outline',
  oven: 'square-outline',
  microwave: 'radio-outline',
  fridge: 'snow-outline',
  kettle: 'cafe-outline',
  blender: 'nutrition-outline',
  pressureCooker: 'speedometer-outline',
  riceCooker: 'restaurant-outline',
  airFryer: 'cloudy-outline',
  toaster: 'albums-outline',
  sandwichMaker: 'layers-outline',
  tawa: 'ellipse-outline',
  induction: 'flash-outline',
  steamer: 'water-outline',
  slowCooker: 'time-outline',
  foodProcessor: 'cut-outline',
  mixerGrinder: 'sync-outline',
  waffleMaker: 'grid-outline',
  idliSteamer: 'cloud-outline',
  grill: 'bonfire-outline',
};

/** Tick what you cook with. Used on the Cook tab (first time) and on Me. */
export function EquipmentPicker({ value, onChange }: { value: Equipment; onChange: (e: Equipment) => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  return (
    <View style={styles.wrap}>
      {EQUIPMENT_IDS.map((id) => (
        <Pressable key={id} onPress={() => onChange({ ...value, [id]: !value[id] })} style={[styles.chip, value[id] && styles.on]} accessibilityRole="checkbox" accessibilityState={{ checked: value[id] }}>
          <Ionicons name={value[id] ? 'checkmark-circle' : ICONS[id]} size={18} color={value[id] ? colors.onPrimary : colors.ink} />
          <Text style={[styles.text, value[id] && { color: colors.onPrimary }]}>{t(`k2.eq.${id}` as Key)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.line },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 13, fontWeight: '700', color: colors.ink },
});
