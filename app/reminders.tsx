import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { DEFAULT_ITEM_REMIND, stepRemind } from '../src/lib/itemReminders';
import { LIMITS, MAX_CUSTOM } from '../src/lib/notify';
import { REMINDER_IDS, ReminderId, formatTime, stepTime } from '../src/lib/reminders';
import { useTracker } from '../src/store/tracker';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';
import { ensurePermission, explainPermission } from '../src/lib/permissions';

/** One number with − and + buttons. */
function Stepper({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; format?: (n: number) => string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepRow}>
      <Text style={[styles.name, { flex: 1 }]}>{label}</Text>
      <Pressable hitSlop={8} onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        <Ionicons name="remove-circle-outline" size={28} color={value <= min ? colors.line : colors.primary} />
      </Pressable>
      <Text style={styles.stepVal}>{format ? format(value) : value}</Text>
      <Pressable hitSlop={8} onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        <Ionicons name="add-circle-outline" size={28} color={value >= max ? colors.line : colors.primary} />
      </Pressable>
    </View>
  );
}

/** Notifications: every kind in one place, each with its own switch. */
export default function Notifications_() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { reminders, setReminders, habits, supplements, setItemReminder, notif, setNotif, customReminders, saveCustomReminder, removeCustomReminder } = useTracker();
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<{ title: string; hour: number; minute: number; days: number[] } | null>(null);

  /** Asks the phone's permission the first time something is switched on. */
  const allow = async (): Promise<boolean> => {
    try {
      const perm = await ensurePermission(Notifications.getPermissionsAsync, Notifications.requestPermissionsAsync);
      setDenied(perm !== 'granted');
      if (perm !== 'granted') explainPermission(perm, t('perm.notifications'), t);
      return perm === 'granted';
    } catch {
      setDenied(true);
      return false;
    }
  };

  const setGeneral = async (id: ReminderId, on: boolean) => {
    if (on && !(await allow())) return;
    setReminders({ ...reminders, [id]: { ...reminders[id], on } });
  };
  const moveGeneral = (id: ReminderId, delta: number) => setReminders({ ...reminders, [id]: stepTime(reminders[id], delta) });

  const count =
    REMINDER_IDS.filter((id) => reminders[id].on).length +
    habits.filter((h) => h.remind).length +
    supplements.filter((s) => s.remind).length +
    customReminders.filter((r) => r.on).length +
    (notif.idle.on ? 1 : 0);

  const saveDraft = () => {
    if (!draft || !draft.title.trim()) return;
    saveCustomReminder({ title: draft.title, hour: draft.hour, minute: draft.minute, days: draft.days, on: true });
    setDraft(null);
  };

  const itemRow = (kind: 'habit' | 'supplement', it: (typeof habits)[number]) => (
    <View key={`${kind}-${it.id}`} style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {it.name}
        </Text>
        {it.remind ? (
          <View style={styles.timeRow}>
            <Pressable hitSlop={8} onPress={() => setItemReminder(kind, it.id, stepRemind(it.remind!, -15))}>
              <Ionicons name="remove-circle-outline" size={26} color={colors.primary} />
            </Pressable>
            <Text style={styles.time}>{formatTime(it.remind.hour, it.remind.minute)}</Text>
            <Pressable hitSlop={8} onPress={() => setItemReminder(kind, it.id, stepRemind(it.remind!, 15))}>
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.sub}>{t('notifs.off')}</Text>
        )}
      </View>
      <Switch
        value={!!it.remind}
        onValueChange={async (on) => {
          if (on && !(await allow())) return;
          setItemReminder(kind, it.id, on ? DEFAULT_ITEM_REMIND : null);
        }}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('notifs.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 6 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>{t('notifs.all')}</Text>
              <Text style={styles.sub}>{notif.allOn ? t('notifs.summary', { n: count }) : t('notifs.allOff')}</Text>
            </View>
            <Switch value={notif.allOn} onValueChange={(allOn) => setNotif({ ...notif, allOn })} trackColor={{ true: colors.primary }} />
          </View>
          <Text style={styles.sub}>{t('rem.intro')}</Text>
          {denied && <Text style={styles.err}>{t('rem.denied')}</Text>}
        </Card>

        <Text style={styles.heading}>{t('notifs.daily')}</Text>
        <Card style={{ gap: 4 }}>
          {REMINDER_IDS.map((id, i) => {
            const s = reminders[id];
            return (
              <View key={id} style={[styles.row, i > 0 && styles.rowLine]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{t(`rem.${id}` as Key)}</Text>
                  {id === 'water' ? (
                    <Text style={styles.sub}>{t('rem.waterWhen')}</Text>
                  ) : (
                    <View style={styles.timeRow}>
                      <Pressable hitSlop={8} disabled={!s.on} onPress={() => moveGeneral(id, -30)}>
                        <Ionicons name="remove-circle-outline" size={26} color={s.on ? colors.primary : colors.line} />
                      </Pressable>
                      <Text style={[styles.time, !s.on && { color: colors.inkSoft }]}>{formatTime(s.hour, s.minute)}</Text>
                      <Pressable hitSlop={8} disabled={!s.on} onPress={() => moveGeneral(id, 30)}>
                        <Ionicons name="add-circle-outline" size={26} color={s.on ? colors.primary : colors.line} />
                      </Pressable>
                    </View>
                  )}
                </View>
                <Switch value={s.on} onValueChange={(on) => void setGeneral(id, on)} trackColor={{ true: colors.primary }} />
              </View>
            );
          })}
        </Card>

        <Text style={styles.heading}>{t('notifs.habits')}</Text>
        <Card style={{ gap: 4 }}>
          {habits.length + supplements.length === 0 ? <Text style={styles.sub}>{t('notifs.habitsEmpty')}</Text> : null}
          {habits.map((h) => itemRow('habit', h))}
          {supplements.map((s) => itemRow('supplement', s))}
          <Pressable onPress={() => router.push('/daily')}>
            <Text style={styles.link}>{t('notifs.openHabits')}</Text>
          </Pressable>
        </Card>

        <Text style={styles.heading}>{t('notifs.mine')}</Text>
        <Card style={{ gap: 8 }}>
          {customReminders.map((r) => (
            <View key={r.id} style={styles.mineRow}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {r.title}
                  </Text>
                  <Text style={styles.sub}>
                    {formatTime(r.hour, r.minute)} · {r.days.length === 0 ? t('notifs.everyDay') : r.days.map((d) => t(`day.${d}` as Key)).join(' ')}
                  </Text>
                </View>
                <Switch
                  value={r.on}
                  onValueChange={async (on) => {
                    if (on && !(await allow())) return;
                    saveCustomReminder({ ...r, on });
                  }}
                  trackColor={{ true: colors.primary }}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert(t('notifs.deleteQ', { name: r.title }), '', [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('common.delete'), style: 'destructive', onPress: () => removeCustomReminder(r.id) },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={22} color={colors.inkSoft} />
                </Pressable>
              </View>
            </View>
          ))}
          {draft ? (
            <View style={{ gap: 10 }}>
              <TextInput value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} placeholder={t('notifs.titlePh')} placeholderTextColor={colors.inkSoft} style={styles.input} maxLength={60} />
              <View style={styles.timeRow}>
                <Pressable hitSlop={8} onPress={() => setDraft({ ...draft, ...stepRemind(draft, -15) })}>
                  <Ionicons name="remove-circle-outline" size={28} color={colors.primary} />
                </Pressable>
                <Text style={styles.time}>{formatTime(draft.hour, draft.minute)}</Text>
                <Pressable hitSlop={8} onPress={() => setDraft({ ...draft, ...stepRemind(draft, 15) })}>
                  <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                </Pressable>
              </View>
              <View style={styles.dayRow}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = draft.days.includes(d);
                  return (
                    <Pressable key={d} style={[styles.dayChip, on && styles.dayOn]} onPress={() => setDraft({ ...draft, days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}>
                      <Text style={[styles.dayText, on && { color: colors.onPrimary }]}>{t(`day.${d}` as Key)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.sub}>{draft.days.length === 0 ? t('notifs.everyDay') : ''}</Text>
              <Button title={t('common.save')} icon="checkmark" onPress={async () => { if (await allow()) saveDraft(); }} disabled={!draft.title.trim()} />
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setDraft(null)} />
            </View>
          ) : (
            <Button title={t('notifs.add')} icon="add" variant="ghost" disabled={customReminders.length >= MAX_CUSTOM} onPress={() => setDraft({ title: '', hour: 9, minute: 0, days: [] })} />
          )}
        </Card>

        <Text style={styles.heading}>{t('notifs.follow')}</Text>
        <Card style={{ gap: 6 }}>
          <View style={styles.row}>
            <Text style={[styles.name, { flex: 1 }]}>{t('notifs.repeat')}</Text>
            <Switch value={notif.repeatUntilDone} onValueChange={(repeatUntilDone) => setNotif({ ...notif, repeatUntilDone })} trackColor={{ true: colors.primary }} />
          </View>
          {notif.repeatUntilDone && (
            <>
              <Stepper label={t('notifs.every', { n: notif.repeatEveryMin })} value={notif.repeatEveryMin} min={LIMITS.repeatEveryMin[0]} max={LIMITS.repeatEveryMin[1]} step={5} onChange={(repeatEveryMin) => setNotif({ ...notif, repeatEveryMin })} format={(n) => `${n}`} />
              <Stepper label={t('notifs.times', { n: notif.repeatTimes })} value={notif.repeatTimes} min={LIMITS.repeatTimes[0]} max={LIMITS.repeatTimes[1]} onChange={(repeatTimes) => setNotif({ ...notif, repeatTimes })} />
            </>
          )}
          <Stepper label={t('notifs.snoozeLen', { n: notif.snoozeMin })} value={notif.snoozeMin} min={LIMITS.snoozeMin[0]} max={LIMITS.snoozeMin[1]} step={5} onChange={(snoozeMin) => setNotif({ ...notif, snoozeMin })} />
          <Text style={styles.sub}>{t('notifs.buttonsNote')}</Text>
        </Card>

        {(
          <>
        <Text style={styles.heading}>{t('notifs.idle')}</Text>
        <Card style={{ gap: 6 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t('notifs.idleSwitch')}</Text>
              <Text style={styles.sub}>{t('notifs.idleBody')}</Text>
            </View>
            <Switch
              value={notif.idle.on}
              onValueChange={async (on) => {
                if (on && !(await allow())) return;
                setNotif({ ...notif, idle: { ...notif.idle, on } });
              }}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {notif.idle.on && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[30, 60, 90, 120, 180, 240].map((m) => (
                  <Pressable key={m} onPress={() => setNotif({ ...notif, idle: { ...notif.idle, afterMin: m } })} style={[styles.idleChip, notif.idle.afterMin === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.idleChipText, notif.idle.afterMin === m && { color: colors.onPrimary }]}>{m < 60 ? `${m} min` : `${m / 60} h`}</Text>
                  </Pressable>
                ))}
              </View>
              <Stepper label={t('notifs.idleAfter', { n: notif.idle.afterMin })} value={notif.idle.afterMin} min={LIMITS.idleAfterMin[0]} max={LIMITS.idleAfterMin[1]} step={15} onChange={(afterMin) => setNotif({ ...notif, idle: { ...notif.idle, afterMin } })} />
              <Stepper label={t('notifs.idleFrom')} value={notif.idle.from} min={0} max={notif.idle.to - 1} onChange={(from) => setNotif({ ...notif, idle: { ...notif.idle, from } })} format={(n) => `${n}:00`} />
              <Stepper label={t('notifs.idleTo')} value={notif.idle.to} min={notif.idle.from + 1} max={23} onChange={(to) => setNotif({ ...notif, idle: { ...notif.idle, to } })} format={(n) => `${n}:00`} />
            </>
          )}
        </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  idleChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  idleChipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  err: { fontSize: 13, color: colors.danger, lineHeight: 18 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  mineRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { fontSize: 18, fontWeight: '800', color: colors.ink, minWidth: 64, textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  stepVal: { fontSize: 16, fontWeight: '800', color: colors.ink, minWidth: 48, textAlign: 'center' },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.line },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.ink },
});
