import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { BoardRow, METRICS, Metric, addFriend, rank, removeFriend, saveProfile } from '../src/lib/social';
import { useFriends } from '../src/lib/useFriends';
import { useCloud } from '../src/store/cloud';
import { useKabe } from '../src/store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

export default function Friends() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const cloud = useCloud();
  const { client, me, setMe, board, refresh, totals } = useFriends();
  const { userName, setUserName } = useKabe();
  const [name, setName] = useState('');
  const [typed, setTyped] = useState('');
  const [metric, setMetric] = useState<Metric>('points');
  const [open, setOpen] = useState<string | null>(null); // the friend whose details are showing
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // a name saved for friends before the app had a nickname becomes the nickname
  useEffect(() => {
    if (!userName && me?.name) setUserName(me.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.name]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  }, []);

  const saveName = () =>
    run(async () => {
      if (!client) return;
      const code = await saveProfile(client, name, totals);
      setMe({ name: name.trim(), code });
      setUserName(name); // the Today greeting uses the same nickname
      refresh();
    });

  const add = () =>
    run(async () => {
      if (!client) return;
      const friend = await addFriend(client, typed);
      setTyped('');
      setMsg(t('friends.added', { name: friend }));
      refresh();
    });

  const remove = (id: string) =>
    run(async () => {
      if (!client) return;
      await removeFriend(client, id);
      setOpen(null);
      refresh();
    });

  const ranked = rank(board, metric);
  const value = (r: BoardRow, m: Metric = metric) => (m === 'steps' ? r.steps.toLocaleString() : r[m]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('friends.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 8 }}>
          <Text style={styles.body}>{t('friends.intro')}</Text>
        </Card>

        {!client ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.body}>{t('friends.needCloud')}</Text>
            <Button title={t('friends.openCloud')} icon="log-in-outline" onPress={() => router.push('/account')} />
          </Card>
        ) : (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.label}>{t('friends.nameLabel')}</Text>
              <TextInput style={styles.input} value={name || me?.name || userName || ''} onChangeText={setName} placeholder={t('friends.namePlaceholder')} placeholderTextColor={colors.inkSoft} maxLength={30} />
              <Button title={t('friends.saveName')} onPress={saveName} disabled={busy || !(name || me?.name || userName || '').trim()} />
              {me?.code ? (
                <>
                  <Text style={styles.label}>{t('friends.myCode')}</Text>
                  <Text style={styles.code} selectable>
                    {me.code}
                  </Text>
                  <Button title={t('friends.shareCode')} variant="ghost" icon="share-outline" onPress={() => Share.share({ message: t('friends.codeMsg', { code: me.code }) }).catch(() => {})} />
                </>
              ) : null}
            </Card>

            {me ? (
              <>
                <Card style={{ gap: 8 }}>
                  <Text style={styles.h2}>{t('friends.addTitle')}</Text>
                  <TextInput style={styles.input} value={typed} onChangeText={setTyped} placeholder={t('friends.codePlaceholder')} placeholderTextColor={colors.inkSoft} autoCapitalize="characters" autoCorrect={false} maxLength={12} onSubmitEditing={add} />
                  <Button title={t('friends.add')} variant="ghost" icon="person-add-outline" onPress={add} disabled={busy || !typed.trim()} />
                </Card>

                <Card style={{ gap: 10 }}>
                  <View style={styles.row}>
                    <Text style={styles.h2}>{t('friends.board')}</Text>
                    <Pressable onPress={refresh} hitSlop={10}>
                      <Text style={styles.link}>{t('friends.refresh')}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.chips}>
                    {METRICS.map((m) => (
                      <Pressable key={m} onPress={() => setMetric(m)} style={[styles.chip, metric === m && styles.chipOn]}>
                        <Text style={[styles.chipText, metric === m && { color: colors.onPrimary }]}>{t(`friends.m.${m}` as Key)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {ranked.map((r) => (
                    <View key={r.userId}>
                      <Pressable style={styles.row} onPress={() => !r.isMe && setOpen(open === r.userId ? null : r.userId)} accessibilityRole="button">
                        <Text style={styles.rank}>{r.rank}</Text>
                        <Text style={[styles.rowName, r.isMe && { color: colors.primaryDark }]} numberOfLines={1}>
                          {r.isMe ? `${r.name} (${t('friends.you')})` : r.name}
                        </Text>
                        <Text style={styles.rowVal}>{value(r)}</Text>
                        {!r.isMe && <Ionicons name={open === r.userId ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />}
                      </Pressable>
                      {open === r.userId && (
                        <View style={styles.detail}>
                          <View style={styles.detailGrid}>
                            {METRICS.map((m) => (
                              <View key={m} style={styles.detailCell}>
                                <Text style={styles.detailVal}>{value(r, m)}</Text>
                                <Text style={styles.sub}>{t(`friends.m.${m}` as Key)}</Text>
                              </View>
                            ))}
                          </View>
                          <Button title={t('friends.remove')} variant="ghost" icon="person-remove-outline" onPress={() => remove(r.userId)} disabled={busy} />
                        </View>
                      )}
                    </View>
                  ))}
                  <Text style={styles.sub}>{t('friends.pointsHelp')}</Text>
                </Card>
              </>
            ) : null}
          </>
        )}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        {cloud.user && !cloud.user.email ? <Text style={styles.sub}>{t('friends.guestNote')}</Text> : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  msg: { fontSize: 13, color: colors.primaryDark },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 3, color: colors.primaryDark },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between', paddingVertical: 4 },
  rank: { width: 22, fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  rowVal: { fontSize: 15, fontWeight: '800', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  detail: { gap: 10, padding: 12, marginVertical: 6, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: BORDER, borderColor: colors.line },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailCell: { flexBasis: '46%', flexGrow: 1 },
  detailVal: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
