import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CookTab } from '../src/components/kitchen/CookTab';
import { BuyTab } from '../src/components/kitchen/BuyTab';
import { PantryTab } from '../src/components/kitchen/PantryTab';
import { SavedTab } from '../src/components/kitchen/SavedTab';
import { useT } from '../src/i18n/useT';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

const TABS = [
  { key: 'cook', label: 'kitchen.cook', icon: 'restaurant-outline' },
  { key: 'pantry', label: 'kitchen.pantry', icon: 'file-tray-stacked-outline' },
  { key: 'saved', label: 'k2.tabSaved', icon: 'bookmark-outline' },
  { key: 'buy', label: 'k2.tabBuy', icon: 'cart-outline' },
] as const;

export default function Kitchen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('cook');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('today.kitchen')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.tabs}>
        {TABS.map((x) => (
          <Pressable key={x.key} onPress={() => setTab(x.key)} style={[styles.tab, tab === x.key && styles.tabOn]}>
            <Ionicons name={x.icon} size={16} color={tab === x.key ? colors.onPrimary : colors.ink} />
            <Text style={[styles.tabText, tab === x.key && { color: colors.onPrimary }]}>{t(x.label)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {tab === 'cook' && <CookTab />}
        {tab === 'pantry' && <PantryTab />}
        {tab === 'saved' && <SavedTab />}
        {tab === 'buy' && <BuyTab />}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingBottom: 4 },
  tab: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.ink },
});
