import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { MOTION, TABS, type TabName } from '../../src/config/app';
import { useT } from '../../src/i18n/useT';
import { fontFor } from '../../src/lib/fonts';
import { BORDER, useColors } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Training and Coach are hidden from the app (their files are kept): `href: null` removes the tab but keeps the route. */
const hidden = (name: string) => <Tabs.Screen key={name} name={name} options={{ href: null }} />;

/** The tab icon hops when its tab is chosen. */
function TabIcon({ name, color, size, focused }: { name: IconName; color: string; size: number; focused: boolean }) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!focused || !MOTION.enabled) return;
    const a = Animated.sequence([
      Animated.timing(y, { toValue: -6, duration: MOTION.tabBounceMs / 2, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, friction: 4, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [focused, y]);
  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

const tab = (name: string, title: string, icon: IconName, iconActive: IconName) => (
  <Tabs.Screen
    key={name}
    name={name}
    options={{
      title,
      tabBarIcon: ({ color, size, focused }) => <TabIcon name={focused ? iconActive : icon} size={size} color={color as string} focused={focused} />,
    }}
  />
);

export default function TabsLayout() {
  const colors = useColors();
  const { t } = useT();
  const shown = (name: TabName) => TABS.find((x) => x.name === name)?.show !== false;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.cardBorder, borderTopWidth: BORDER, height: 66, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fontFor('700') },
      }}
    >
      {shown('index') ? tab('index', t('tab.today'), 'home-outline', 'home') : hidden('index')}
      {shown('diary') ? tab('diary', t('tab.diary'), 'restaurant-outline', 'restaurant') : hidden('diary')}
      {shown('workouts') ? tab('workouts', t('tab.train'), 'barbell-outline', 'barbell') : hidden('workouts')}
      {shown('progress') ? tab('progress', t('tab.progress'), 'stats-chart-outline', 'stats-chart') : hidden('progress')}
      {hidden('coach')}
      {shown('profile') ? tab('profile', t('tab.me'), 'person-outline', 'person') : hidden('profile')}
    </Tabs>
  );
}
