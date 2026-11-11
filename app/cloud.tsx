import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { secondsSince } from '../src/lib/clock';
import { SUPABASE_SQL, buildSnapshot, exportJson } from '../src/lib/sync';
import { useCloud } from '../src/store/cloud';
import { useKabe } from '../src/store/kabe';
import { useKitchen } from '../src/store/kitchen';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function Cloud() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const c = useCloud();
  const kabe = useKabe();
  const tracker = useTracker();
  const kitchen = useKitchen();
  const { t } = useT();
  const [url, setUrl] = useState(c.config?.url ?? '');
  const [key, setKey] = useState(c.config?.key ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const ago = (d: Date | null) => {
    if (!d) return t('cloud.never');
    const s = secondsSince(d);
    return s < 60 ? t('cloud.justNow') : s < 3600 ? t('cloud.minAgo', { n: Math.round(s / 60) }) : d.toLocaleTimeString();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      // the technical detail (often from the server) stays in English
      setMsg(e instanceof Error && e.message ? e.message : t('cloud.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const exportData = () =>
    Share.share({ title: 'Kabe data export', message: exportJson(buildSnapshot(kabe as any, tracker as any, kitchen as any)) }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('cloud.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* ---------- 1. connect to your Supabase project ---------- */}
        {!c.config && (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('cloud.optional')}</Text>
              <Text style={styles.body}>{t('cloud.intro')}</Text>
            </Card>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('cloud.setupTitle')}</Text>
              <Text style={styles.body}>{t('cloud.setupSteps')}</Text>
              <Button title={t('cloud.shareSql')} icon="share-outline" variant="ghost" onPress={() => Share.share({ message: SUPABASE_SQL }).catch(() => {})} />
            </Card>
            <Card style={{ gap: 8 }}>
              <Text style={styles.label}>{t('cloud.url')}</Text>
              <TextInput value={url} onChangeText={setUrl} placeholder="https://abcdefgh.supabase.co" placeholderTextColor={colors.inkSoft} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
              <Text style={styles.label}>{t('cloud.pubKey')}</Text>
              <TextInput value={key} onChangeText={setKey} placeholder="sb_publishable_…" placeholderTextColor={colors.inkSoft} autoCapitalize="none" autoCorrect={false} style={styles.input} />
              {msg ? <Text style={styles.err}>{msg}</Text> : null}
              <Button
                title={t('cloud.connect')}
                disabled={!url.trim() || !key.trim()}
                onPress={() => {
                  const problem = c.saveConfig({ url, key });
                  setMsg(problem ?? '');
                }}
              />
            </Card>
          </>
        )}

        {/* ---------- 2. account ---------- */}
        {c.config && !c.user?.email && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('cloud.accountTitle')}</Text>
            <Text style={styles.body}>{t('cloud.accountBody')}</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder={t('cloud.email')} placeholderTextColor={colors.inkSoft} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} placeholder={t('cloud.passwordPh')} placeholderTextColor={colors.inkSoft} autoCapitalize="none" secureTextEntry style={styles.input} />
            {msg ? <Text style={styles.err}>{msg}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button title={t('cloud.signIn')} disabled={busy || !email.trim() || password.length < 6} onPress={() => run(() => c.signIn(email, password))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={t('cloud.create')}
                  variant="ghost"
                  disabled={busy || !email.trim() || password.length < 6}
                  onPress={() =>
                    run(async () => {
                      const r = await c.signUp(email, password);
                      if (r.needsConfirm) setMsg(t('cloud.needsConfirm'));
                    })
                  }
                />
              </View>
            </View>
            {!c.builtin && <Pressable onPress={() => Alert.alert(t('cloud.changeQ'), t('cloud.changeBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('cloud.change'), onPress: () => c.clearConfig() }])}>
              <Text style={styles.link}>{t('cloud.changeLink')}</Text>
            </Pressable>}
          </Card>
        )}

        {/* ---------- 3. signed in ---------- */}
        {c.config && c.user?.email && (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('cloud.signedIn')}</Text>
              <Text style={styles.body}>{c.user.email}</Text>
              <Text style={styles.sub}>
                {t('cloud.lastSynced', {
                  status: c.status === 'syncing' ? t('cloud.st.syncing') : c.status === 'conflict' ? t('cloud.st.conflict') : c.status === 'error' ? t('cloud.st.error') : t('cloud.st.ok'),
                  when: ago(c.lastSyncedAt),
                })}
              </Text>
              {c.error ? <Text style={styles.err}>{c.error}</Text> : null}
              <Button title={t('cloud.syncNow')} icon="sync" disabled={c.status === 'syncing'} onPress={() => run(() => c.syncNow())} />
              <Text style={styles.sub}>{t('cloud.auto')}</Text>
            </Card>

            {c.status === 'conflict' && (
              <Card style={{ gap: 8, borderWidth: 2, borderColor: colors.accent }}>
                <Text style={styles.h2}>{t('cloud.conflictTitle')}</Text>
                <Text style={styles.body}>{t('cloud.conflictBody')}</Text>
                <Button
                  title={t('cloud.useCloud')}
                  variant="ghost"
                  onPress={() => Alert.alert(t('cloud.useCloudQ'), t('cloud.useCloudBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('cloud.useCloudBtn'), style: 'destructive', onPress: () => run(() => c.syncNow('cloud')) }])}
                />
                <Button
                  title={t('cloud.keepPhone')}
                  onPress={() => Alert.alert(t('cloud.keepPhoneQ'), t('cloud.keepPhoneBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('cloud.keepPhoneBtn'), style: 'destructive', onPress: () => run(() => c.syncNow('local')) }])}
                />
              </Card>
            )}

            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('cloud.account')}</Text>
              <Button title={t('cloud.signOut')} variant="ghost" onPress={() => run(async () => { await c.signOut(); kabe.setWelcomed(false); })} />
              <Button
                title={t('cloud.deleteCloud')}
                variant="ghost"
                onPress={() =>
                  Alert.alert(t('cloud.deleteQ'), t('cloud.deleteBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => run(() => c.deleteCloudData()) },
                  ])
                }
              />
              <Button
                title={t('cloud.deleteAccount')}
                variant="ghost"
                onPress={() =>
                  Alert.alert(t('cloud.deleteAccountQ'), t('cloud.deleteAccountBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: () => run(() => c.deleteAccount()) },
                  ])
                }
              />
              {!c.builtin && <Pressable onPress={() => Alert.alert(t('cloud.disconnectQ'), t('cloud.disconnectBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('cloud.disconnect'), onPress: () => c.clearConfig() }])}>
                <Text style={styles.link}>{t('cloud.disconnectLink')}</Text>
              </Pressable>}
              {msg ? <Text style={styles.err}>{msg}</Text> : null}
            </Card>
          </>
        )}

        {/* ---------- export (always available) ---------- */}
        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('cloud.exportTitle')}</Text>
          <Text style={styles.body}>{t('cloud.exportBody')}</Text>
          <Button title={t('cloud.exportBtn')} icon="download-outline" variant="ghost" onPress={exportData} />
        </Card>
        <Text style={styles.note}>{t('cloud.syncedNote')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  note: { fontSize: 12, color: colors.inkSoft, lineHeight: 17, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  err: { fontSize: 13, color: colors.danger, lineHeight: 18 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  mono: { fontFamily: 'monospace', fontSize: 11, color: colors.inkSoft, backgroundColor: colors.bg, padding: 10, borderRadius: radius.sm },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
});
