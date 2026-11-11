import React, { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, View, type AlertButton } from 'react-native';
import { registerAlertHost } from '../lib/alert';
import { useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';
import { Button, Card } from './ui';

type Request = { title: string; message?: string; buttons: AlertButton[] };

/**
 * Draws every dialog that Alert.alert asks for, on the phone and on the web, in the app's own look (the phone's grey system
 * dialog and the browser's confirm box do not match it). Two buttons sit side by side, more are stacked; Delete is red.
 */
export function AlertHost() {
  const styles = useThemedStyles(makeStyles);
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => registerAlertHost(setReq), []);

  const cancel = req?.buttons.find((b) => b.style === 'cancel');
  const close = (b?: AlertButton) => {
    setReq(null);
    b?.onPress?.(undefined);
  };
  // the phone's back button closes the dialog like Cancel
  useEffect(() => {
    if (!req) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close(cancel);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;
  const row = req.buttons.length <= 2;
  const variantOf = (b: AlertButton) => (b.style === 'destructive' ? 'danger' : b === cancel || req.buttons.length === 1 ? 'ghost' : 'primary');
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancel)} statusBarTranslucent>
      <Pressable style={styles.dim} onPress={() => close(cancel)}>
        <Pressable style={{ width: '100%', maxWidth: 420 }} onPress={() => {}}>
          <Card style={{ gap: 12 }}>
            <Text style={styles.title}>{req.title}</Text>
            {req.message ? <Text style={styles.msg}>{req.message}</Text> : null}
            <View style={row ? styles.row : styles.col}>
              {req.buttons.map((b, i) => (
                <View key={`${b.text}-${i}`} style={row ? { flex: 1 } : undefined}>
                  <Button title={b.text ?? 'OK'} variant={variantOf(b)} onPress={() => close(b)} />
                </View>
              ))}
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  msg: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  col: { gap: 10, marginTop: 4 },
});
