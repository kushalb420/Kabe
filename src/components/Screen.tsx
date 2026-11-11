import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useThemedStyles, type Colors } from '../theme';
import { Dots } from './Dots';
import { StaggerProvider } from './Motion';

export function Screen({
  title,
  subtitle,
  headerRight,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  /** something small at the right of the title (the streak, for example) */
  headerRight?: React.ReactNode;
  /** something small above the title (the Kabe wordmark on Today) */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [y] = useState(() => new Animated.Value(0)); // scroll position drives the title: it drifts up slower and fades
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Dots />
    <Animated.ScrollView
      style={{ flex: 1 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 40, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, opacity: y.interpolate({ inputRange: [0, 90], outputRange: [1, 0.15], extrapolate: 'clamp' }), transform: [{ translateY: y.interpolate({ inputRange: [0, 200], outputRange: [0, 70], extrapolate: 'clamp' }) }, { scale: y.interpolate({ inputRange: [-120, 0, 120], outputRange: [1.08, 1, 0.94], extrapolate: 'clamp' }) }] }}>
        {eyebrow ? (
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
              {eyebrow}
              {headerRight}
            </View>
            <Text style={[styles.title, styles.titleSmall]} numberOfLines={2}>{title}</Text>
            {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
            </View>
            {headerRight}
          </>
        )}
      </Animated.View>
      <StaggerProvider>{children}</StaggerProvider>
    </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  titleSmall: { fontSize: 27, letterSpacing: -0.6, marginTop: 2 },
  sub: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
});
