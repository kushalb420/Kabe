import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { Text, TextInput } from '../../src/components/Text';
import { Screen } from '../../src/components/Screen';
import { Button, Card, LinkRow } from '../../src/components/ui';
import { FEATURES } from '../../src/config/app';
import { DEFAULT_PROFILE, r0, suggestGoals } from '../../src/lib/nutrition';
import { useKabe } from '../../src/store/kabe';
import { useCloud } from '../../src/store/cloud';
import { useFriends } from '../../src/lib/useFriends';
import { friendsOf, rank } from '../../src/lib/social';
import { useT } from '../../src/i18n/useT';
import { router } from 'expo-router';
import { radius, useThemedStyles, type Colors } from '../../src/theme';
import { Sticker } from '../../src/components/Sticker';
import { sugarLimit } from '../../src/lib/limits';

export default function ProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const { profile, goals, goalsCustom, setGoals, setCustomGoals, sugarGoal, setSugarGoal } = useKabe();
  const { t } = useT();
  const cloud = useCloud();
  const fr = useFriends();
  const friendRows = friendsOf(fr.board, 'points');
  const ranked = rank(fr.board, 'points');
  const mine = ranked.find((r) => r.isMe);
  const leading = !!mine && mine.rank === 1 && ranked.length > 1;
  const statLine = (r: { steps: number; activeMinutes: number; loggedDays: number }) =>
    `${t('friends.m.steps')} ${r.steps.toLocaleString()} · ${t('friends.m.activeMinutes')} ${r.activeMinutes} · ${t('friends.m.loggedDays')} ${r.loggedDays}`;

  const [editing, setEditing] = useState(false);
  const [own, setOwn] = useState({ kcal: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '' });
  const startEdit = () => {
    setOwn({ kcal: String(r0(goals.kcal)), protein: String(r0(goals.protein)), carbs: String(r0(goals.carbs)), fat: String(r0(goals.fat)), fiber: String(r0(goals.fiber)), sugar: String(r0(sugarLimit(goals, sugarGoal))) });
    setEditing(true);
  };
  const saveOwn = () => {
    const n = (v: string) => Math.round(parseFloat(v.replace(',', '.')));
    const g = { kcal: n(own.kcal), protein: n(own.protein), carbs: n(own.carbs), fat: n(own.fat), fiber: n(own.fiber) };
    if (!(g.kcal >= 800 && g.kcal <= 6000) || ![g.protein, g.carbs, g.fat, g.fiber].every((x) => x >= 0 && x <= 1000)) {
      Alert.alert(t('me.checkNumbers'), t('me.goalsRange'));
      return;
    }
    const sugar = n(own.sugar);
    if (!(sugar >= 0 && sugar <= 500)) {
      Alert.alert(t('me.checkNumbers'), t('me.goalsRange'));
      return;
    }
    setCustomGoals(g);
    setSugarGoal(sugar > 0 ? sugar : null);
    setEditing(false);
  };

  const useSuggested = () => {
    setGoals(suggestGoals(profile ?? DEFAULT_PROFILE));
    setSugarGoal(null);
  };

  return (
    <Screen title={t('me.title')} subtitle={t('me.subtitle')} headerRight={<Sticker name="mascot" size={66} tilt={6} bob />}>
      <Card style={{ gap: 12 }}>
        <Text style={styles.h2}>{t('me.targets')}</Text>
        {editing ? (
          <>
            <Text style={styles.sub}>{t('me.goalsOwnHint')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['kcal', 'protein'] as const).map((k) => (
                <View key={k} style={{ flex: 1 }}>
                  <Text style={styles.label}>{k === 'kcal' ? t('macro.kcal') : t('macro.protein')}</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={own[k]} onChangeText={(v) => setOwn({ ...own, [k]: v })} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['carbs', 'fat', 'fiber'] as const).map((k) => (
                <View key={k} style={{ flex: 1 }}>
                  <Text style={styles.label}>{k === 'carbs' ? t('macro.carbs') : k === 'fat' ? t('macro.fat') : t('macro.fiber')}</Text>
                  <TextInput style={styles.input} keyboardType="decimal-pad" value={own[k]} onChangeText={(v) => setOwn({ ...own, [k]: v })} />
                </View>
              ))}
            </View>
            <View>
              <Text style={styles.label}>{t('macro.sugar')}</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={own.sugar} onChangeText={(v) => setOwn({ ...own, sugar: v })} />
              <Text style={[styles.sub, { marginTop: 4 }]}>{t('me.sugarHint')}</Text>
            </View>
            <Button title={t('common.save')} onPress={saveOwn} />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
          </>
        ) : (
          <>
            <Text style={styles.big}>{r0(goals.kcal)} kcal</Text>
            <Text style={styles.sub}>
              {t('macro.protein')} {r0(goals.protein)}g · {t('macro.carbs')} {r0(goals.carbs)}g · {t('macro.fat')} {r0(goals.fat)}g · {t('macro.fiber')} {r0(goals.fiber)}g · {t('macro.sugar')} ≤ {r0(sugarLimit(goals, sugarGoal))}g
            </Text>
            {goalsCustom ? <Text style={styles.sub}>{t('me.goalsOwn')}</Text> : null}
            <Button title={t('me.goalsSetOwn')} variant="ghost" icon="create-outline" onPress={startEdit} />
            {goalsCustom ? <Button title={t('me.goalsUseSuggested')} variant="ghost" onPress={useSuggested} /> : null}
          </>
        )}
      </Card>

      {FEATURES.friends && cloud.user ? (
        <Card style={{ gap: friendRows.length ? 14 : 8 }}>
          <Text style={styles.h2}>{t('me.friends')}</Text>
          {mine && (
            <View style={styles.meBox}>
              <Text style={styles.meTitle}>{leading ? t('me.challengeLead') : t('me.challengeRank', { n: mine.rank, total: ranked.length })}</Text>
              <Text style={styles.sub}>{statLine(mine)}</Text>
            </View>
          )}
          {friendRows.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Sticker name="sparkles" size={32} />
              </View>
              <Text style={[styles.sub, { flex: 1 }]}>{t('me.friendsNone')}</Text>
            </View>
          ) : (
            friendRows.map((f) => (
              <View key={f.userId} style={styles.friendBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.rank}>{f.rank}</Text>
                  <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.pts}>{f.points} {t('friends.m.points')}</Text>
                </View>
                <Text style={styles.sub}>{statLine(f)}</Text>
              </View>
            ))
          )}
          <Button title={t('friends.add')} icon="person-add-outline" variant="ghost" onPress={() => router.push('/friends')} />
          {friendRows.length > 0 && <Button title={t('me.openFriends')} icon="people-outline" variant="ghost" onPress={() => router.push('/friends')} />}
        </Card>
      ) : null}
      <LinkRow icon="alarm-outline" title={t('notifs.mine')} sub={t('rem.linkSub')} onPress={() => router.push('/reminders')} />
      <LinkRow icon="settings-outline" title={t('set.link')} sub={t('set.linkSub')} onPress={() => router.push('/settings')} />
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, padding: 12, gap: 2 },
  meTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  friendBox: { gap: 4, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rank: { width: 24, fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  friendName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink },
  pts: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  big: { fontSize: 32, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 12, color: colors.inkSoft },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
  seg: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
