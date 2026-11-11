import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, LinkRow } from '../src/components/ui';
import { FEATURES } from '../src/config/app';
import { clearMicroCache } from '../src/lib/microCache';
import { deletePhotoFiles } from '../src/lib/photoFiles';
import { useCloud } from '../src/store/cloud';
import { useKitchen } from '../src/store/kitchen';
import { useTracker } from '../src/store/tracker';
import { LANGUAGES, type Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { useGamify } from '../src/store/gamify';
import { useKabe } from '../src/store/kabe';
import { ACCENT_IDS, ACCENT_UNLOCK_LEVEL, isAccentUnlocked, paletteFor, radius, useColors, useTheme, useThemedStyles, type Colors } from '../src/theme';
import { EquipmentPicker } from '../src/components/kitchen/EquipmentPicker';
import { TargetsCalculator } from '../src/components/TargetsCalculator';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

/** Everything you can change: language, colours, Today's layout, reminders, about you, backup, privacy. */
export default function Settings() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const game = useGamify();
  const { language, setLanguage, resetAll, userName, setUserName } = useKabe();
  const [nameDraft, setNameDraft] = useState(userName);
  const [seenName, setSeenName] = useState(userName);
  if (seenName !== userName) {
    setSeenName(userName);
    setNameDraft(userName);
  }
  const cloud = useCloud();
  const { resetTracker, photos, notif, reminders, habits, supplements, customReminders } = useTracker();
  const notifCount = (['water', 'logFood', 'checkin', 'weigh'] as const).filter((id) => reminders[id].on).length + habits.filter((h) => h.remind).length + supplements.filter((x) => x.remind).length + customReminders.filter((r) => r.on).length + 0;
  const { resetKitchen, equipment, setEquipment } = useKitchen();
  const { accent, setAccent } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('set.link')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('me.language')} · Language</Text>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Pressable key={l.code} onPress={() => setLanguage(l.code)} style={[styles.seg, language === l.code && styles.segOn]} accessibilityLabel={l.english}>
                <Text style={[styles.segText, language === l.code && { color: colors.onPrimary }]}>{l.native}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sub}>{t('me.languageNote')}</Text>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('welcome.nameLabel')}</Text>
          <TextInput value={nameDraft} onChangeText={(v) => { setNameDraft(v); setUserName(v); }} placeholder={t('welcome.namePh')} placeholderTextColor={colors.inkSoft} maxLength={30} style={{ borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.card }} />
        </Card>
        <TargetsCalculator />
        {FEATURES.kitchen && (
          <Card style={{ gap: 10 }}>
            <Text style={styles.h2}>{t('k2.setupMe')}</Text>
            <Text style={styles.sub}>{t('k2.setupMeSub')}</Text>
            <EquipmentPicker value={equipment} onChange={setEquipment} />
          </Card>
        )}
        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('theme.accent')}</Text>
          <View style={styles.wrap}>
            {ACCENT_IDS.map((id) => {
              const open = isAccentUnlocked(id, game.level.level);
              return (
                <Pressable key={id} disabled={!open} onPress={() => setAccent(id)} style={[styles.seg, accent === id && styles.segOn, !open && { opacity: 0.55 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: paletteFor(id).primary }} />
                    <Text style={[styles.segText, accent === id && { color: colors.onPrimary }]}>{t(`theme.accent.${id}` as Key)}</Text>
                    {!open && <Ionicons name="lock-closed" size={12} color={colors.inkSoft} />}
                  </View>
                  {!open && <Text style={[styles.sub, { fontSize: 11 }]}>{t('theme.lockedAt', { n: ACCENT_UNLOCK_LEVEL[id] })}</Text>}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sub}>{t('theme.note')}</Text>
        </Card>
        <LinkRow icon="grid-outline" title={t('dash.link')} onPress={() => router.push('/customize')} />
        <LinkRow icon="options-outline" title={t('about.link')} sub={t('about.linkSub')} onPress={() => router.push('/about')} />
        {FEATURES.reminders && <LinkRow icon="notifications-outline" title={t('notifs.title')} sub={notif.allOn ? t('notifs.summary', { n: notifCount }) : t('notifs.allOff')} onPress={() => router.push('/reminders')} />}
        {FEATURES.cloudBackup && (
          <LinkRow
            icon="cloud-outline"
            title={cloud.user?.email ? t('account.row') : t('account.rowGuest')}
            sub={cloud.user?.email ? t('me.signedAs', { email: cloud.user.email }) : t('account.sub')}
            onPress={() => router.push('/account')}
          />
        )}
        <LinkRow icon="shield-checkmark-outline" title={t('privacy.link')} sub={t('privacy.linkSub')} onPress={() => router.push('/privacy')} />
        <Button
          title={t('me.erase')}
          variant="ghost"
          onPress={() =>
            Alert.alert(t('me.eraseQ'), t('me.eraseBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('me.eraseBtn'), style: 'destructive', onPress: () => { deletePhotoFiles(photos.map((p) => p.uri)); resetAll(); resetTracker(); resetKitchen(); void clearMicroCache(); } },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
