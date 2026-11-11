import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { DEFAULT_LAYOUT, isDefault, move, sanitizeLayout, toggleHidden } from '../src/lib/dashboard';
import { useKabe } from '../src/store/kabe';
import { useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function Customize() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { dashboard: saved, setDashboard } = useKabe();
  const dashboard = sanitizeLayout(saved); // a card added by a newer version shows up here even in an older saved layout

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>{t('dash.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
        <Text style={styles.sub}>{t('dash.intro')}</Text>
        <Card style={{ gap: 4 }}>
          {dashboard.order.map((id, i) => {
            const shown = !dashboard.hidden.includes(id);
            return (
              <View key={id} style={[styles.row, i > 0 && styles.rowLine]}>
                <Switch value={shown} onValueChange={() => setDashboard(toggleHidden(dashboard, id))} trackColor={{ true: colors.primary }} />
                <Text style={[styles.name, !shown && { color: colors.inkSoft }]} numberOfLines={2}>{t(`dash.card.${id}` as Key)}</Text>
                <Pressable hitSlop={8} disabled={i === 0} onPress={() => setDashboard(move(dashboard, id, -1))} accessibilityLabel={t('dash.up')}>
                  <Ionicons name="chevron-up" size={24} color={i === 0 ? colors.line : colors.primary} />
                </Pressable>
                <Pressable hitSlop={8} disabled={i === dashboard.order.length - 1} onPress={() => setDashboard(move(dashboard, id, 1))} accessibilityLabel={t('dash.down')}>
                  <Ionicons name="chevron-down" size={24} color={i === dashboard.order.length - 1 ? colors.line : colors.primary} />
                </Pressable>
              </View>
            );
          })}
        </Card>
        <Button title={t('dash.reset')} icon="refresh" variant="ghost" disabled={isDefault(dashboard)} onPress={() => setDashboard(DEFAULT_LAYOUT)} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
});
