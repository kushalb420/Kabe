import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/lib/crashCatcher'; // shows an error on screen instead of closing the app
import '../src/lib/gpsTask'; // registers the background GPS task
import '../src/lib/stepTask'; // registers the background step reading (builds that have it)
import { CaffeineWatcher } from '../src/components/CaffeineWatcher';
import { IdleWatcher } from '../src/components/IdleWatcher';
import { NotificationActions } from '../src/components/NotificationActions';
import { ReminderScheduler } from '../src/components/ReminderScheduler';
import { StepCounter } from '../src/components/StepCounter';
import { CloudProvider } from '../src/store/cloud';
import { KabeProvider, useKabe } from '../src/store/kabe';
import { KitchenProvider } from '../src/store/kitchen';
import { TrackerProvider } from '../src/store/tracker';
import { ThemeProvider, useTheme } from '../src/theme';
import { AlertHost } from '../src/components/AlertHost';
import { CrashBoundary, CrashOverlay } from '../src/components/CrashScreen';
import { LoadingScreen } from '../src/components/Loading';
import { NicknamePrompt } from '../src/components/NicknamePrompt';
import { PermissionCheckup } from '../src/components/PermissionCheckup';

/** Everything that needs the current palette sits below the ThemeProvider. */
function Shell() {
  const { colors } = useTheme();
  const { ready, welcomed, profile } = useKabe();
  const pathname = usePathname();
  // the first time Kabe opens, show the welcome screen
  useEffect(() => {
    if (ready && !welcomed && pathname !== '/welcome' && pathname !== '/route') router.replace('/welcome'); // /route is a shared route card from a link
  }, [ready, welcomed, pathname]);
  // right after the welcome flow (or the first sign in), ask for the person's goals once, so nobody has to look for them in Settings
  useEffect(() => {
    if (!ready || !welcomed || profile || pathname !== '/') return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        if ((await AsyncStorage.getItem('kabe.goalsAsked')) === '1' || !alive) return;
        await AsyncStorage.setItem('kabe.goalsAsked', '1');
        if (alive) router.push('/goals');
      } catch {
        /* storage failed: skip the question rather than ask every time */
      }
    }, 900); // only once the person has settled on Today (not while heading to sign in)
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, welcomed, profile, pathname]);
  // the navigation layer has its own idea of "background"; give it ours so nothing flashes white between screens
  const base = DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.card, border: colors.line, text: colors.ink, primary: colors.primary } };
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style="dark" />
      <StepCounter />
      <ReminderScheduler />
      <NotificationActions />
      <IdleWatcher />
      <CaffeineWatcher />
      <NicknamePrompt />
      <PermissionCheckup />
      <AlertHost />
      {!ready && <LoadingScreen />}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 260, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="pick-exercise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="photo" options={{ presentation: 'modal' }} />
        <Stack.Screen name="restaurant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="label" options={{ presentation: 'modal' }} />
        <Stack.Screen name="voice" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cloud" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
        <Stack.Screen name="route" />
        <Stack.Screen name="route-view" options={{ presentation: 'modal' }} />
        <Stack.Screen name="kitchen" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="recovery" />
        <Stack.Screen name="body" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stats" options={{ presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="about" options={{ presentation: 'modal' }} />
        <Stack.Screen name="micros" options={{ presentation: 'modal' }} />
        <Stack.Screen name="customize" options={{ presentation: 'modal' }} />
        <Stack.Screen name="photos" options={{ presentation: 'modal' }} />
        <Stack.Screen name="track" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reminders" options={{ presentation: 'modal' }} />
        <Stack.Screen name="daily" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="save-meal" options={{ presentation: 'modal' }} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ SpaceGrotesk_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  if (!fontsReady && !fontError) return null; // a moment on the splash screen; if a font fails, the system font is used
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <KabeProvider>
            <TrackerProvider>
              <KitchenProvider>
                <CloudProvider>
                  <CrashBoundary>
                    <Shell />
                  </CrashBoundary>
                </CloudProvider>
              </KitchenProvider>
            </TrackerProvider>
          </KabeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      <CrashOverlay />
    </GestureHandlerRootView>
  );
}
