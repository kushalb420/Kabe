import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { badgeDesc, badgeName, challengeTitle, nudgeVars, unitLabel } from '../src/i18n/gamifyText';
import { useT } from '../src/i18n/useT';
import { CHALLENGE_POINTS, Group, TIER_POINTS } from '../src/lib/gamify';
import { useGamify } from '../src/store/gamify';
import { useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

const TIER_COLOR = { bronze: '#B87333', silver: '#8A97A6', gold: '#E0A800' } as const;
const GROUPS: Group[] = ['Logging', 'Nutrition', 'Training', 'Activity', 'Body', 'Recovery', 'Kitchen'];

export default function Achievements() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const g = useGamify();
  const { t, lang } = useT();
  const earned = g.badges.filter((b) => b.earned).length;
  const streakRows = [
    { id: 'log', label: t('ach.s.log'), icon: 'restaurant', s: g.streaks.log },
    { id: 'water', label: t('ach.s.water'), icon: 'water', s: g.streaks.water },
    { id: 'steps', label: t('ach.s.steps'), icon: 'footsteps', s: g.streaks.steps },
    { id: 'move', label: t('ach.s.move'), icon: 'barbell', s: g.streaks.move },
    { id: 'checkin', label: t('ach.s.checkin'), icon: 'moon', s: g.streaks.checkin },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('ach.title')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <Card style={{ gap: 8 }}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.big}>{t('ach.level', { n: g.level.level })}</Text>
              <Text style={styles.sub}>{t('ach.levelSub', { title: t(`level.${Math.min(g.level.level, 10)}` as Key), points: g.points })}</Text>
            </View>
            <Ionicons name="ribbon" size={44} color={colors.accent} />
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (g.level.into / g.level.needed) * 100)}%` }]} />
          </View>
          <Text style={styles.sub}>
            {t('ach.toNext', { n: g.level.needed - g.level.into, next: g.level.level + 1, b: TIER_POINTS.bronze, s: TIER_POINTS.silver, g: TIER_POINTS.gold, c: CHALLENGE_POINTS })}
          </Text>
          <Text style={styles.nudge}>{t(g.nudgeInfo.key, nudgeVars(lang, g.nudgeInfo))}</Text>
        </Card>

        <Card style={{ gap: 6 }}>
          <Text style={styles.h2}>{t('ach.streaks')}</Text>
          {streakRows.map((r) => (
            <View key={r.id} style={styles.streakRow}>
              <Ionicons name={r.icon} size={20} color={colors.primary} />
              <Text style={[styles.name, { flex: 1 }]}>{r.label}</Text>
              <Text style={[styles.flame, r.s.current === 0 && { color: colors.inkSoft }]}>🔥 {r.s.current}</Text>
              <Text style={styles.sub}>{t('ach.best', { n: r.s.longest })}</Text>
            </View>
          ))}
          <Text style={styles.sub}>{t('ach.streakNote')}</Text>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('ach.challenges')}</Text>
          {g.challenges.map((c) => (
            <View key={c.key} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text style={[styles.name, { flex: 1 }, c.done && { color: colors.primaryDark }]}>{c.done ? '✓ ' : ''}{challengeTitle(lang, c.id, c.title)}</Text>
                <Text style={styles.sub}>{Math.min(c.current, c.target)}/{c.target}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${c.progress * 100}%`, backgroundColor: c.done ? colors.primary : colors.accent }]} />
              </View>
            </View>
          ))}
          <Text style={styles.sub}>{t('ach.challengeNote', { n: CHALLENGE_POINTS })}</Text>
        </Card>

        <Text style={styles.h2}>{t('ach.badges', { earned, total: g.badges.length })}</Text>
        {GROUPS.map((grp) => (
          <Card key={grp} style={{ gap: 8 }}>
            <Text style={styles.group}>{t(`grp.${grp}` as Key)}</Text>
            {g.badges.filter((b) => b.group === grp).map((b) => (
              <View key={b.id} style={[styles.badge, !b.earned && { opacity: 0.8 }]}>
                <View style={[styles.medal, { backgroundColor: b.earned ? TIER_COLOR[b.tier] : colors.line }]}>
                  <Ionicons name={(b.earned ? b.icon : 'lock-closed') as keyof typeof Ionicons.glyphMap} size={20} color={b.earned ? colors.onPrimary : colors.inkSoft} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{badgeName(lang, b.id, b.name)} <Text style={styles.sub}>· {t(`tier.${b.tier}` as Key)}</Text></Text>
                  <Text style={styles.sub}>{badgeDesc(lang, b.id, b.desc)}</Text>
                  {b.earned ? (
                    <Text style={[styles.sub, { color: colors.primaryDark, fontWeight: '700' }]}>{b.earnedOn ? t('ach.earnedOn', { date: b.earnedOn }) : t('ach.earned')}</Text>
                  ) : (
                    <>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${b.progress * 100}%` }]} />
                      </View>
                      <Text style={styles.sub}>{Math.min(b.current, b.target)} / {b.target} {unitLabel(lang, b.unit)}</Text>
                    </>
                  )}
                </View>
              </View>
            ))}
          </Card>
        ))}
        <Text style={styles.note}>{t('ach.note')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  big: { fontSize: 28, fontWeight: '800', color: colors.primaryDark },
  group: { fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  nudge: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, lineHeight: 20 },
  note: { fontSize: 11, color: colors.inkSoft, lineHeight: 16, textAlign: 'center' },
  flame: { fontSize: 16, fontWeight: '800', color: colors.warn },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: colors.primary },
  badge: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
