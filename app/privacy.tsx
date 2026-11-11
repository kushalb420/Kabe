import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { clearMicroCache } from '../src/lib/microCache';
import { deletePhotoFiles } from '../src/lib/photoFiles';
import { dataFlows, sendsInBackground } from '../src/lib/privacy';
import { buildSnapshot, exportJson } from '../src/lib/sync';
import { useCloud } from '../src/store/cloud';
import { useKabe } from '../src/store/kabe';
import { useKitchen } from '../src/store/kitchen';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function Privacy() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const kabe = useKabe();
  const tracker = useTracker();
  const kitchen = useKitchen();
  const cloud = useCloud();
  const flows = dataFlows({ geminiKey: kabe.geminiKey, aiConsent: kabe.aiConsent, coachConsent: kabe.coachConsent, cloudUser: !!cloud.user?.email });
  const background = sendsInBackground({ cloudUser: !!cloud.user?.email });

  const exportData = () =>
    Share.share({ title: 'Kabe data export', message: exportJson(buildSnapshot(kabe as any, tracker as any, kitchen as any)) }).catch(() => {});

  const erase = () =>
    Alert.alert(t('me.eraseQ'), t('me.eraseBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('me.eraseBtn'), style: 'destructive', onPress: () => { deletePhotoFiles(tracker.photos.map((p) => p.uri)); kabe.resetAll(); tracker.resetTracker(); kitchen.resetKitchen(); void clearMicroCache(); } },
    ]);

  const tone = (s: 'on' | 'off' | 'possible') => (s === 'on' ? colors.primary : colors.inkSoft);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>{t('privacy.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <Card style={{ gap: 6 }}>
          <Text style={styles.body}>{t('privacy.intro')}</Text>
          <Text style={styles.sub}>{background ? t('privacy.bgYes') : t('privacy.bgNo')}</Text>
        </Card>

        <Card style={{ gap: 4 }}>
          <Text style={styles.h2}>{t('privacy.onPhone')}</Text>
          <Text style={styles.body}>
            {t('privacy.count', { entries: kabe.entries.length, weights: tracker.weights.length, foods: kabe.customFoods.length })}
          </Text>
          <Text style={styles.sub}>{t('privacy.onPhoneNote')}</Text>
        </Card>

        <Text style={styles.h2}>{t('privacy.flows')}</Text>
        {flows.map((f) => (
          <Card key={f.id} style={{ gap: 6 }}>
            <View style={styles.between}>
              <Text style={[styles.name, { flex: 1 }]}>{t(`privacy.f.${f.id}.name` as Key)}</Text>
              <Text style={[styles.badge, { color: tone(f.status), borderColor: tone(f.status) }]}>{t(`privacy.s.${f.status}` as Key)}</Text>
            </View>
            <Text style={styles.body}>{t(`privacy.f.${f.id}.sends` as Key)}</Text>
            <Text style={styles.sub}>{t(`privacy.f.${f.id}.when` as Key)}</Text>
            {f.id === 'ai' && <Text style={styles.sub}>{t('privacy.f.ai.note')}</Text>}
          </Card>
        ))}

        <Text style={styles.h2}>{t('privacy.controls')}</Text>
        <Card style={{ gap: 10 }}>
          <Button title={t('privacy.stopAi')} icon="hand-left-outline" variant="ghost" disabled={!kabe.aiConsent && !kabe.coachConsent} onPress={() => { kabe.setAiConsent(false); kabe.setCoachConsent(false); }} />
          <Button title={t('privacy.cloud')} icon="cloud-outline" variant="ghost" onPress={() => router.push('/cloud')} />
          <Button title={t('privacy.export')} icon="share-outline" variant="ghost" onPress={exportData} />
          <Button title={t('me.erase')} icon="trash-outline" variant="ghost" onPress={erase} />
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 11, fontWeight: '800', borderWidth: 2, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' },
});
