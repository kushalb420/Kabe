import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { DEFAULT_ITEM_REMIND, Remind, stepRemind } from '../lib/itemReminders';
import { formatTime } from '../lib/reminders';
import { BORDER, radius, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';

/** The daily reminder line under a habit or supplement: set a time, nudge it 15 minutes either way, or turn it off. */
/** `supplement`: simpler wording; `scope` says on which days the reminder comes (for a supplement that is not taken every day). */
export function ItemReminder({ remind, onRemind, supplement, scope }: { remind?: Remind; onRemind: (r: Remind | null) => void; supplement?: boolean; scope?: string }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  return (
    <View style={styles.box}>
      {remind ? (
        <>
          <Text style={styles.txt}>🔔 {t(supplement ? 'supp.remindAt' : 'daily.remindAt', { time: formatTime(remind.hour, remind.minute) })}</Text>
          {scope ? <Text style={styles.scope}>{scope}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.stepBtn} onPress={() => onRemind(stepRemind(remind, -15))} accessibilityLabel="−15 min">
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.time}>{formatTime(remind.hour, remind.minute)}</Text>
            <Pressable style={styles.stepBtn} onPress={() => onRemind(stepRemind(remind, 15))} accessibilityLabel="+15 min">
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
            <Pressable onPress={() => onRemind(null)} hitSlop={8} style={{ marginLeft: 6 }}>
              <Text style={styles.link}>{t('daily.remindOff')}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={() => onRemind(DEFAULT_ITEM_REMIND)} hitSlop={8}>
          <Text style={styles.link}>🔔 {t(supplement ? 'supp.remind' : 'daily.remind')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  box: { gap: 8, paddingBottom: 10, paddingTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  scope: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  time: { minWidth: 56, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.ink },
  txt: { fontSize: 13, fontWeight: '700', color: colors.ink },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  stepBtn: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
