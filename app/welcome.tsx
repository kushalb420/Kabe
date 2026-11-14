import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { OutlineText } from '../src/components/OutlineText';
import { Text, TextInput } from '../src/components/Text';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { fontFor } from '../src/lib/fonts';
import { useKabe } from '../src/store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Sticker } from '../src/components/Sticker';
import { TargetsCalculator } from '../src/components/TargetsCalculator';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; t: Key; s: Key }[] = [
  { icon: 'camera-outline', t: 'welcome.f1t', s: 'welcome.f1s' },
  { icon: 'restaurant-outline', t: 'welcome.f2t', s: 'welcome.f2s' },
  { icon: 'people-outline', t: 'welcome.f3t', s: 'welcome.f3s' },
];

/** Shown once, the first time Kabe opens. */
export default function Welcome() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { setWelcomed, setUserName } = useKabe();
  const [name, setName] = useState('');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [goalsSaved, setGoalsSaved] = useState(false);

  const finish = (next?: '/about' | '/account' | '/account?mode=up') => {
    setUserName(name);
    setWelcomed(true);
    router.replace('/(tabs)');
    if (next) setTimeout(() => router.push(next), 50);
  };

  const heading = { fontFamily: fontFor('800'), fontSize: 36, lineHeight: 42, letterSpacing: -1.5 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <Sticker name="wordmark" size={120} style={{ marginLeft: -2 }} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('welcome.badge')}</Text>
        </View>

        <View style={{ gap: 2 }}>
          <Text style={[heading, { color: colors.ink }]}>{t('welcome.h1')}</Text>
          <Text style={[heading, { color: colors.ink }]}>{t('welcome.h2')}</Text>
          <OutlineText style={heading} fill={colors.bg} stroke={colors.ink}>
            {t('welcome.h3')}
          </OutlineText>
        </View>
        <Text style={styles.sub}>{t('welcome.sub')}</Text>

        <View style={{ alignItems: 'center', marginVertical: 4 }}>
          <Sticker name="mascot" size={190} tilt={-4} bob />
          <Sticker name="sparkles" size={70} style={{ position: 'absolute', right: 6, top: -6 }} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.nameLabel}>{t('welcome.nameLabel')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('welcome.namePh')} placeholderTextColor={colors.inkSoft} maxLength={30} style={styles.nameInput} />
        </View>

        {goalsOpen ? (
          <TargetsCalculator onDone={() => { setGoalsOpen(false); setGoalsSaved(true); }} />
        ) : goalsSaved ? (
          <Text style={styles.sub}>{t('welcome.goalsDone')}</Text>
        ) : (
          <Button title={t('welcome.goalsBtn')} icon="flag-outline" variant="ghost" onPress={() => setGoalsOpen(true)} />
        )}

        <View style={{ gap: 10 }}>
          <Button title={t('welcome.signUp')} icon="person-add-outline" onPress={() => finish('/account?mode=up')} />
          <Button title={t('welcome.signIn')} variant="ghost" icon="log-in-outline" onPress={() => finish('/account')} />
          <Pressable onPress={() => finish('/about')} accessibilityRole="button" style={{ paddingVertical: 8 }}>
            <Text style={styles.skip}>{t('welcome.skip')}</Text>
          </Pressable>
        </View>

        <View style={{ gap: 14, marginTop: 8 }}>
          {FEATURES.map((f) => (
            <Card key={f.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.iconBox}>
                <Ionicons name={f.icon} size={26} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t(f.t)}</Text>
                <Text style={styles.cardSub}>{t(f.s)}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.ink, letterSpacing: 0.3 },
  nameLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  nameInput: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
  skip: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  sub: { fontSize: 16, color: colors.inkSoft, lineHeight: 24 },
  iconBox: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  cardSub: { fontSize: 13, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
});
