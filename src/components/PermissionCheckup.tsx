import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { requestMotion, WEB_STEPS_EVENT, WEB_STEPS_KEY } from '../lib/webSteps';
import { registerStepTask } from '../lib/stepTask';
import { webLocationRequest } from '../lib/permissions';
import { loadHealthConnect, readTodayStepsWith } from '../lib/healthConnect';
import { useKabe } from '../store/kabe';
import { BORDER, radius, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';
import { Button, Card } from './ui';

const KEY = 'kabe.permCheckup.v1'; // how many times the person has been asked
const MAX_ASKS = 3;

/**
 * The next time someone opens Kabe (app or website) after they have settled in, ask once, in one tap, for everything Kabe needs:
 * motion and location in a browser; notifications, the step counter, Health Connect and location in the app. If they say "not now"
 * it asks again on the next visit, up to three times, then leaves them alone. Browsers only show these questions after a tap,
 * which is why this is a button and not something that happens by itself.
 */
export function PermissionCheckup() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { ready, welcomed } = useKabe();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !welcomed || pathname !== '/') return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const asked = parseInt((await AsyncStorage.getItem(KEY)) ?? '0', 10) || 0;
        if (asked >= MAX_ASKS || !alive) return;
        if (Platform.OS === 'web') {
          const done = (globalThis as any).localStorage?.getItem(WEB_STEPS_KEY) === '1';
          if (done) return;
        }
        await AsyncStorage.setItem(KEY, String(asked + 1));
        if (alive) setShow(true);
      } catch {
        /* storage failed: skip rather than ask every time */
      }
    }, 3500); // after Today has settled, and after the goals question if that is shown first
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, welcomed, pathname]);

  const allow = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        // each of these shows the browser's own question; they must all start from this one tap
        const motion = await requestMotion();
        if (motion === 'granted') {
          try {
            (globalThis as any).localStorage?.setItem(WEB_STEPS_KEY, '1');
          } catch {
            /* storage blocked */
          }
          (globalThis as any).dispatchEvent(new Event(WEB_STEPS_EVENT));
        }
        await webLocationRequest();
        try {
          await (globalThis as any).Notification?.requestPermission?.();
        } catch {
          /* only installed web apps can show notifications on iPhone */
        }
      } else {
        const [{ getPermissionsAsync, requestPermissionsAsync }, { Pedometer }, Location] = await Promise.all([import('expo-notifications'), import('expo-sensors'), import('expo-location')]);
        const n = await getPermissionsAsync();
        if (!n.granted && n.canAskAgain) await requestPermissionsAsync().catch(() => {});
        try {
          const p = await Pedometer.getPermissionsAsync();
          if (!p.granted && p.canAskAgain) await Pedometer.requestPermissionsAsync();
        } catch {
          /* no step counter on this phone */
        }
        const hc = loadHealthConnect();
        if (hc) await readTodayStepsWith(hc, new Date()); // asks for Health Connect step access when it is missing
        const l = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (l && !l.granted && l.canAskAgain) await Location.requestForegroundPermissionsAsync().catch(() => {});
        await registerStepTask(); // steps keep being read while the app is closed, in builds that can
      }
    } finally {
      setBusy(false);
      setShow(false);
    }
  };

  if (!show) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
      <View style={styles.backdrop}>
        <Card style={{ gap: 12 }}>
          <Text style={styles.title}>{t('perm.checkTitle')}</Text>
          <Text style={styles.body}>{t(Platform.OS === 'web' ? 'perm.checkBodyWeb' : 'perm.checkBody')}</Text>
          <Button title={t('perm.checkAllow')} icon="shield-checkmark-outline" disabled={busy} onPress={() => void allow()} />
          <Button title={t('perm.checkLater')} variant="ghost" disabled={busy} onPress={() => setShow(false)} />
        </Card>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  card: { borderWidth: BORDER, borderRadius: radius.lg },
});
