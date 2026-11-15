import React, { useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type Svg from 'react-native-svg';
import { Dots } from '../src/components/Dots';
import { RouteStory } from '../src/components/RouteStory';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/ui';
import { useT } from '../src/i18n/useT';
import { shareRouteCard } from '../src/lib/routeStory';
import { parseStoryHash, routeOfStory } from '../src/lib/routeShare';
import { useColors, useThemedStyles, type Colors } from '../src/theme';

/**
 * The website page that opens a route card sent from the Kabe app (the card is in the link after "#", which no server sees).
 * The picture can be downloaded or shared from here.
 */
export default function RoutePage() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { width } = useWindowDimensions();
  const ref = useRef<Svg>(null);
  const [note, setNote] = React.useState('');
  const data = useMemo(() => (Platform.OS === 'web' ? parseStoryHash((globalThis as any).location?.hash ?? '') : null), []);
  const route = useMemo(() => (data ? routeOfStory(data) : []), [data]);
  const w = Math.min(340, Math.max(240, width - 40));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, gap: 16, paddingBottom: 60 }}>
        {data ? (
          <>
            <RouteStory ref={ref} {...data} width={w} route={route} />
            <View style={{ alignSelf: 'stretch', maxWidth: 340, gap: 10 }}>
              <Button
                title={t('route.download')}
                icon="download-outline"
                onPress={async () => {
                  if (!ref.current) return;
                  const r = await shareRouteCard(ref.current as never, data);
                  setNote(r === 'downloaded' ? t('route.saved') : r === 'failed' ? t('route.failed') : '');
                }}
              />
              {note ? <Text style={styles.sub}>{note}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={styles.sub}>{t('route.badLink')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  sub: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
});
