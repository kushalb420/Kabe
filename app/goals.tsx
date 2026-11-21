import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../src/components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { TargetsCalculator } from '../src/components/TargetsCalculator';
import { Text } from '../src/components/Text';
import { useT } from '../src/i18n/useT';
import { goBack } from '../src/lib/nav';
import { useColors, useThemedStyles, type Colors } from '../src/theme';

/** Shown once, right after the welcome screen (or the first sign in), so nobody has to hunt for the targets in Settings. */
export default function Goals() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top, 16) + 8, paddingHorizontal: 18, paddingBottom: 60, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('goals.title')}</Text>
        <Text style={styles.sub}>{t('goals.sub')}</Text>
        <TargetsCalculator onDone={() => goBack()} />
        <Pressable onPress={() => goBack()} accessibilityRole="button" style={{ paddingVertical: 8 }}>
          <Text style={styles.skip}>{t('goals.skip')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  skip: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
});
