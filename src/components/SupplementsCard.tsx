import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { Alert } from '../lib/alert';
import { toDateKey } from '../lib/nutrition';
import { ensurePermission, explainPermission } from '../lib/permissions';
import { SuppRead, readSupplementByName, readSupplementLabel } from '../lib/suppAi';
import { MAX_TIMES, Schedule, cleanSchedule, daysBetween, defaultSchedule, dosesDue, dosesTaken, nextDue, streakOf, topAmounts } from '../lib/supplements';
import { useKabe } from '../store/kabe';
import { Named, useTracker } from '../store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../theme';
import { ItemReminder } from './ItemReminder';
import { Loading } from './Loading';
import { ScheduleEditor, dayName } from './ScheduleEditor';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

/**
 * The supplements card on the Daily screen. Each supplement has its own schedule (several doses a day, every few days, chosen
 * weekdays or only when needed). The first time one is added, Kabe works out what one dose contains (from its name, or from a
 * photo of the label for exact numbers) and every dose you tick off is added to Vitamins & minerals.
 */
export function SupplementsCard() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const k = useKabe();
  const tk = useTracker();
  const ai = !!k.geminiKey && k.aiConsent;
  const today = toDateKey(new Date());
  const takenToday = tk.supplementLog[today];

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [sched, setSched] = useState<Schedule>(() => defaultSchedule(today));
  const [scanned, setScanned] = useState<SuppRead | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [reading, setReading] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const attempted = useRef(new Set<string>());
  const [open, setOpen] = useState<string | null>(null);
  const [editDose, setEditDose] = useState('');
  const [editSched, setEditSched] = useState<Schedule | null>(null);

  /** Ask what one dose contains, from the name (and the dose). */
  const read = async (s: Named) => {
    if (!ai) return;
    attempted.current.add(s.id);
    setReading((r) => [...r, s.id]);
    setFailed((f) => f.filter((x) => x !== s.id));
    try {
      const r = await readSupplementByName(k.geminiKey, s.name, s.dose ?? '');
      if (r) tk.updateSupplement(s.id, { composition: r.composition });
      else setFailed((f) => [...f, s.id]);
    } catch {
      setFailed((f) => [...f, s.id]);
    } finally {
      setReading((r) => r.filter((x) => x !== s.id));
    }
  };

  // every supplement without a reading (new ones, or ones added before this existed) is read once, one at a time
  useEffect(() => {
    if (!ai || !tk.ready || reading.length > 0) return;
    const next = tk.supplements.find((s) => !s.composition && !attempted.current.has(s.id));
    if (next) void read(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, tk.ready, tk.supplements, reading.length]);

  /** Take or choose a photo of a label and read it. */
  const scanLabel = async (src: 'camera' | 'library', doseText: string): Promise<SuppRead | null> => {
    setMsg('');
    if (!ai) {
      setMsg(t('supp.needAi'));
      return null;
    }
    try {
      if (src === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          setMsg(t('photo.errCamera'));
          return null;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true };
      const res = src === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = res.canceled ? undefined : res.assets?.[0];
      if (!asset) return null;
      if (!asset.base64) {
        setMsg(t('photo.errRead'));
        return null;
      }
      setScanning(true);
      const r = await readSupplementLabel(k.geminiKey, asset.base64, asset.mimeType ?? 'image/jpeg', doseText);
      if (!r) setMsg(t('supp.labelFail'));
      return r;
    } catch {
      setMsg(t('photo.errOpen'));
      return null;
    } finally {
      setScanning(false);
    }
  };

  const scanForNew = async (src: 'camera' | 'library') => {
    const r = await scanLabel(src, dose);
    if (!r) return;
    setScanned(r);
    if (!name.trim() && r.name) setName(r.name);
  };

  const scanForOld = async (s: Named, src: 'camera' | 'library') => {
    const r = await scanLabel(src, s.dose ?? '');
    if (r) tk.updateSupplement(s.id, { composition: r.composition });
  };

  const canAdd = !!(name.trim() || scanned?.name);
  const add = () => {
    const n = name.trim() || scanned?.name || '';
    if (!n) return;
    const id = tk.addSupplement(n, dose.trim() || undefined, sched, scanned?.composition);
    if (scanned) attempted.current.add(id); // already read from the label
    setName('');
    setDose('');
    setScanned(null);
    setSched(defaultSchedule(today));
    setMsg('');
  };

  const label = (sc: Schedule): string => {
    const times = sc.times > 1 ? ` · ${t('supp.timesN', { n: sc.times })}` : '';
    if (sc.mode === 'asNeeded') return t('supp.mode.asNeeded');
    if (sc.mode === 'every') return t('supp.everyN', { n: sc.every }) + times;
    if (sc.mode === 'weekdays') return t('supp.onDays', { days: [1, 2, 3, 4, 5, 6, 0].filter((d) => sc.days.includes(d)).map((d) => dayName(d, k.language)).join(', ') }) + times;
    return sc.times > 1 ? t('supp.timesN', { n: sc.times }) : t('supp.mode.daily');
  };

  const nextText = (sc: Schedule): string => {
    const n = nextDue(sc, today);
    if (!n) return '';
    const gap = daysBetween(today, n);
    return t('supp.next', { when: gap === 1 ? t('supp.tomorrow') : t('supp.inDays', { n: gap }) });
  };

  const tickAll = tk.supplements.map((s) => ({ s, sc: cleanSchedule(s.schedule, today) }));
  const total = tickAll.reduce((a, x) => a + dosesDue(x.sc, today), 0);
  const done = tickAll.reduce((a, x) => a + Math.min(dosesDue(x.sc, today), dosesTaken(takenToday, x.s.id)), 0);

  const remove = (s: Named) =>
    Alert.alert(t('daily.deleteAsk', { name: s.name }), t('daily.deleteNote'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => tk.removeSupplement(s.id) },
    ]);

  const openEdit = (s: Named) => {
    if (open === s.id) return setOpen(null);
    setOpen(s.id);
    setEditDose(s.dose ?? '');
    setEditSched(cleanSchedule(s.schedule, today));
  };

  const saveEdit = (s: Named) => {
    if (!editSched) return;
    const nd = editDose.trim();
    const changed = nd !== (s.dose ?? '');
    tk.updateSupplement(s.id, { dose: nd || undefined, schedule: editSched });
    setOpen(null);
    if (changed) {
      // the amounts depend on the dose: read them again
      attempted.current.delete(s.id);
      void read({ ...s, dose: nd || undefined });
    }
  };

  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.h2}>{t('daily.supplements')}</Text>
        {total > 0 && <Text style={styles.sub}>{t('daily.doneToday', { done, total })}</Text>}
      </View>
      {tk.supplements.length === 0 && <Text style={styles.sub}>{t('supp.empty')}</Text>}

      {tickAll.map(({ s, sc }) => {
        const taken = dosesTaken(takenToday, s.id);
        const due = dosesDue(sc, today);
        const complete = due > 0 ? taken >= due : taken > 0;
        const streak = streakOf(sc, tk.supplementLog, s.id, today);
        const c = s.composition;
        const sub = [s.dose, label(sc)].filter(Boolean).join(' · ');
        const tap = () => (taken < Math.max(1, due) || (sc.mode === 'asNeeded' && taken < MAX_TIMES) ? tk.takeDose(today, s.id) : tk.undoDose(today, s.id));
        return (
          <View key={s.id} style={styles.item}>
            <Pressable style={styles.row} onPress={tap} onLongPress={() => remove(s)}>
              <View style={[styles.check, complete && styles.checkOn, !complete && taken > 0 && { borderColor: colors.primary }]}>
                {complete ? <Ionicons name="checkmark" size={18} color={colors.onPrimary} /> : due > 1 || taken > 0 ? <Text style={styles.count}>{due > 0 ? `${taken}/${due}` : `×${taken}`}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowL, due === 0 && sc.mode !== 'asNeeded' && { color: colors.inkSoft }]}>{s.name}</Text>
                <Text style={styles.sub}>{sub}</Text>
                {due === 0 && sc.mode !== 'asNeeded' ? <Text style={styles.sub}>{nextText(sc)}</Text> : null}
              </View>
              {streak > 0 && <Text style={styles.streak}>🔥 {t('daily.days', { n: streak })}</Text>}
            </Pressable>

            {reading.includes(s.id) ? (
              <View style={styles.info}>
                <Loading />
                <Text style={[styles.sub, { flex: 1 }]}>{t('supp.reading')}</Text>
              </View>
            ) : c ? (
              <View style={styles.info}>
                <Ionicons name="flask-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  {topAmounts(c).length > 0 && (
                    <Text style={styles.sub}>{t('supp.gives', { list: topAmounts(c).map((a) => `${t(`micro.n.${a.id}` as Key)} ${a.amount} ${a.unit}`).join(', ') })}</Text>
                  )}
                  {c.others.length > 0 && <Text style={styles.sub}>{t('supp.others', { list: c.others.join(', ') })}</Text>}
                  <Text style={styles.sub}>{c.source === 'label' ? t('supp.fromLabel') : t('supp.estimateNote')}</Text>
                </View>
              </View>
            ) : ai ? (
              <Pressable style={styles.info} onPress={() => void read(s)}>
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={[styles.link, { flex: 1 }]}>{failed.includes(s.id) ? t('supp.failed') : t('supp.readAgain')}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.sub, { marginLeft: 44 }]}>{t('supp.needAi')}</Text>
            )}

            <ItemReminder remind={s.remind} onRemind={(r) => tk.setItemReminder('supplement', s.id, r)} />
            <Pressable onPress={() => openEdit(s)} hitSlop={8} style={{ marginLeft: 44, paddingBottom: 8 }}>
              <Text style={styles.link}>{open === s.id ? t('supp.close') : t('supp.edit')}</Text>
            </Pressable>
            {open === s.id && editSched && (
              <View style={styles.edit}>
                <Text style={styles.label}>{t('daily.dose')}</Text>
                <TextInput value={editDose} onChangeText={setEditDose} placeholder={t('daily.dose')} placeholderTextColor={colors.inkSoft} style={styles.input} />
                <ScheduleEditor value={editSched} onChange={setEditSched} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button title={t('supp.scanLabel')} icon="camera" variant="ghost" disabled={scanning} onPress={() => void scanForOld(s, 'camera')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title={t('log.gallery')} icon="images" variant="ghost" disabled={scanning} onPress={() => void scanForOld(s, 'library')} />
                  </View>
                </View>
                {scanning && <Loading />}
                <Button title={t('common.save')} icon="checkmark" onPress={() => saveEdit(s)} />
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.add}>
        <Text style={styles.label}>{t('daily.suppAdd')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder={t('supp.namePh')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 2, minWidth: 0 }]} />
          <TextInput value={dose} onChangeText={setDose} placeholder={t('daily.dose')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1, minWidth: 0 }]} />
        </View>
        <ScheduleEditor value={sched} onChange={setSched} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('supp.scanLabel')} icon="camera" variant="ghost" disabled={scanning} onPress={() => void scanForNew('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('log.gallery')} icon="images" variant="ghost" disabled={scanning} onPress={() => void scanForNew('library')} />
          </View>
        </View>
        {scanning && (
          <View style={styles.info}>
            <Loading />
            <Text style={[styles.sub, { flex: 1 }]}>{t('supp.scanning')}</Text>
          </View>
        )}
        {scanned && !scanning && (
          <Text style={styles.sub}>
            ✓ {t('supp.fromLabel')} {topAmounts(scanned.composition).map((a) => `${t(`micro.n.${a.id}` as Key)} ${a.amount} ${a.unit}`).join(', ')}
          </Text>
        )}
        {msg ? <Text style={styles.err}>{msg}</Text> : null}
        <Button title={t('common.add')} onPress={add} disabled={!canAdd} />
        <Text style={styles.sub}>{t('supp.hint')}</Text>
      </View>
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  err: { fontSize: 13, color: colors.danger },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowL: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  check: { minWidth: 34, height: 34, paddingHorizontal: 4, borderRadius: 17, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  count: { fontSize: 12, fontWeight: '800', color: colors.ink },
  streak: { fontSize: 13, fontWeight: '700', color: colors.warn },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginLeft: 44, paddingBottom: 6 },
  edit: { gap: 10, marginLeft: 44, paddingBottom: 10 },
  add: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12, marginTop: 4 },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
});
