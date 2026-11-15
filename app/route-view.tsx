import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type Svg from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { RouteStory } from '../src/components/RouteStory';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { goBack } from '../src/lib/nav';
import { decodeRoute } from '../src/lib/routeCard';
import { buildStoryData } from '../src/lib/routeShare';
import { shareRouteCard } from '../src/lib/routeStory';
import { useTracker } from '../src/store/tracker';
import { useColors, useThemedStyles, type Colors } from '../src/theme';

/** A saved route opened again from the activity history: the same card, ready to share. */
export default function RouteView() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activities } = useTracker();
  const { width } = useWindowDimensions();
  const ref = useRef<Svg>(null);
  const [note, setNote] = useState('');
  const a = activities.find((x) => x.id === id);
  const story = useMemo(() => {
    if (!a?.route || (a.type !== 'walk' && a.type !== 'run' && a.type !== 'cycle')) return null;
    const [y, m, d] = a.date.split('-').map(Number);
    return buildStoryData({ kind: a.type, date: new Date(y, (m || 1) - 1, d || 1), km: a.km ?? 0, minutes: a.minutes, seconds: a.seconds, route: decodeRoute(a.route) }, t);
  }, [a, t]);
  const w = Math.min(330, Math.max(240, width - 60));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('route.viewTitle')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 18, gap: 14, paddingBottom: 60 }}>
        {story && a?.route ? (
          <>
            <RouteStory ref={ref} {...story} width={w} route={decodeRoute(a.route)} />
            <View style={{ alignSelf: 'stretch', gap: 10 }}>
              <Button
                title={t('route.share')}
                icon="share-social"
                onPress={async () => {
                  if (!ref.current) return;
                  const r = await shareRouteCard(ref.current as never, story);
                  setNote(r === 'downloaded' ? t('route.saved') : r === 'opened' ? t('route.opened') : r === 'failed' ? t('route.failed') : '');
                }}
              />
              {note ? <Text style={styles.sub}>{note}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={styles.sub}>{t('route.none')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
});
