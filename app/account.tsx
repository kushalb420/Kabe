import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { Button, Card } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { useCloud } from '../src/store/cloud';
import { useKabe } from '../src/store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack, goHome } from '../src/lib/nav';
import { Sticker } from '../src/components/Sticker';

type Mode = 'in' | 'up';

/**
 * Sign in or create an account. Signing in brings your saved data back onto this phone (the app downloads the backup
 * automatically); creating an account starts backing up what you have now.
 */
export default function Account() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const c = useCloud();
  const params = useLocalSearchParams<{ mode?: string }>();
  const k = useKabe();
  const [mode, setMode] = useState<Mode>(params.mode === 'up' ? 'up' : 'in');
  const done = () => (k.profile ? goBack() : router.replace('/about')); // a brand-new person goes on to set-up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [waiting, setWaiting] = useState(false); // signed in just now: waiting for the backup to arrive
  const signedIn = !!c.user?.email;

  // a data conflict (this phone and the backup both have data) is settled on the backup screen
  useEffect(() => {
    if (waiting && c.status === 'conflict') router.replace('/cloud');
  }, [waiting, c.status]);

  const submit = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'in') {
        await c.signIn(email, password);
        setWaiting(true);
      } else {
        const r = await c.signUp(email, password);
        if (r.needsConfirm) setMsg(t('cloud.needsConfirm'));
        else setWaiting(true);
      }
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : t('cloud.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (await c.signInWithGoogle()) setWaiting(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setMsg(/not enabled|unsupported provider/i.test(m) ? t('account.googleOff') : m || t('cloud.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const restoring = waiting && (c.status === 'syncing' || !c.lastSyncedAt);
  const ok = email.trim().includes('@') && password.length >= 6;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('account.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {signedIn && !waiting ? (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('account.signedAs', { email: c.user!.email })}</Text>
              <Text style={styles.body}>{t('account.backedUp')}</Text>
              {c.error ? <Text style={styles.err}>{c.error}</Text> : null}
              <Button title={t('cloud.syncNow')} icon="sync" disabled={c.status === 'syncing'} onPress={() => void c.syncNow()} />
              <Button title={t('cloud.signOut')} variant="ghost" onPress={() => void c.signOut().then(() => { k.setWelcomed(false); goHome(); })} />
            </Card>
            <Button title={t('account.manage')} variant="ghost" icon="cloud-outline" onPress={() => router.push('/cloud')} />
          </>
        ) : waiting ? (
          <Card style={{ gap: 12, alignItems: 'center' }}>
            {restoring ? <ActivityIndicator color={colors.primary} size="large" /> : <Sticker name="check" size={64} bob />}
            <Text style={styles.h2}>{restoring ? t('account.restoring') : t('account.restored')}</Text>
            {!restoring && (
              <View style={{ alignSelf: 'stretch' }}>
                <Button title={t('account.continue')} onPress={done} />
              </View>
            )}
          </Card>
        ) : (
          <>
            <Text style={styles.sub}>{t('account.sub')}</Text>
            <View style={styles.seg}>
              {(['in', 'up'] as const).map((m) => (
                <Pressable key={m} style={[styles.segBtn, mode === m && styles.segOn]} onPress={() => { setMode(m); setMsg(''); }}>
                  <Text style={[styles.segText, mode === m && { color: colors.onPrimary }]}>{m === 'in' ? t('cloud.signIn') : t('cloud.create')}</Text>
                </Pressable>
              ))}
            </View>
            <Button title={t('account.google')} icon="logo-google" variant="ghost" disabled={busy} onPress={() => void google()} />
            {msg && !email ? <Text style={styles.err}>{msg}</Text> : null}
            <Text style={[styles.sub, { textAlign: 'center' }]}>{t('account.or')}</Text>
            <Card style={{ gap: 10 }}>
              <TextInput value={email} onChangeText={setEmail} placeholder={t('cloud.email')} placeholderTextColor={colors.inkSoft} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input} />
              <TextInput value={password} onChangeText={setPassword} placeholder={t('cloud.passwordPh')} placeholderTextColor={colors.inkSoft} autoCapitalize="none" secureTextEntry style={styles.input} onSubmitEditing={() => ok && void submit()} />
              {mode === 'up' ? <Text style={styles.sub}>{t('account.createNote')}</Text> : null}
              {msg ? <Text style={styles.err}>{msg}</Text> : null}
              <Button title={mode === 'in' ? t('cloud.signIn') : t('cloud.create')} icon={mode === 'in' ? 'log-in-outline' : 'person-add-outline'} disabled={busy || !ok} onPress={submit} />
            </Card>
            <Pressable onPress={done}>
              <Text style={styles.link}>{t('account.skip')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  sub: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  err: { fontSize: 13, color: colors.danger },
  link: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
