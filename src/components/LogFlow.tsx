import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { Command, parseCommand } from '../lib/commands';
import { MealItem, foodFromItem, isMeasure, itemGrams, itemNutrients, mealTotals, setCount, setGrams, stepFor } from '../lib/gemFood';
import { MealResult, analyzeMealAudio, analyzeMealPhoto, analyzeMealText, refineItem } from '../lib/mealAi';
import { toDateKey } from '../lib/nutrition';
import { MAX_AUDIO_BYTES, bytesToBase64, mealFromText } from '../lib/voice';
import { MEALS, MealType, useKabe } from '../store/kabe';
import { useTracker } from '../store/tracker';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Calculating } from './Calculating';
import { WebCamera } from './WebCamera';
import { Dots } from './Dots';
import { NutrientGrid } from './NutrientGrid';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';
import { goBack, goHome } from '../lib/nav';
import { ensurePermission, explainPermission } from '../lib/permissions';
import { useDiscardPhoto } from '../lib/photoCache';

type Stage = 'idle' | 'recording' | 'calculating' | 'review' | 'command';
type Mode = 'text' | 'photo' | 'voice';

/**
 * Log a meal: type a list, speak, or take a photo. Gemini works out every food, its amount and its nutrition in one go
 * (a "calculating" screen is shown; nothing can be edited until it is complete). Then the person can change any amount,
 * sees the total for the whole meal, and adds it to the diary.
 */
export function LogFlow({ mode, embedded }: { mode: Mode; embedded?: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; meal?: string }>();
  const { geminiKey, aiConsent, setAiConsent, addEntry } = useKabe();
  const tracker = useTracker();
  const { t } = useT();
  const date = params.date ?? toDateKey(new Date());
  const ready = !!geminiKey && aiConsent;
  const [meal, setMeal] = useState<MealType>((params.meal as MealType) ?? mealFromText('', new Date().getHours()));
  const [stage, setStage] = useState<Stage>('idle');
  const [typed, setTyped] = useState('');
  const [more, setMore] = useState('');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Record<string, string>>({}); // extra detail typed for an item, by item id
  const [refining, setRefining] = useState<string | null>(null);
  const [items, setItems] = useState<MealItem[]>([]);
  const [uri, setUri] = useState<string | null>(null);
  useDiscardPhoto(uri); // the cached copy of the picture is removed when it is replaced or the screen closes
  const [error, setError] = useState('');
  const [cmd, setCmd] = useState<Command | null>(null);
  const [cmdDone, setCmdDone] = useState(false);
  const [source, setSource] = useState<'photo' | 'voice'>('voice');
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  // on the web there is no phone recorder: the browser's own speech recognition writes what you say into the box
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => () => rec.current?.stop?.(), []);
  const toggleListening = () => {
    if (listening) {
      rec.current?.stop?.();
      return;
    }
    const SR = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;
    if (!SR) return setError(t('log.noSpeech'));
    setError('');
    const r = new SR();
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      let said = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript + ' ';
      if (said.trim()) setTyped((x) => (x ? x.trim() + ', ' : '') + said.trim());
    };
    r.onerror = (e: any) => {
      setListening(false);
      setError(e?.error === 'not-allowed' ? t('voice.errMic') : t('log.noSpeech'));
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  const friendly = (e: unknown) => (e instanceof Error && e.message ? e.message : t('log.empty'));

  const finish = (r: MealResult, src: 'photo' | 'voice') => {
    if (r.meal) setMeal(r.meal);
    setItems(r.items);
    setSource(src);
    setStage('review');
  };

  const fromText = async () => {
    setError('');
    const text = typed.trim();
    if (!text) return;
    const c = parseCommand(text);
    if (c) {
      setCmd(c);
      setCmdDone(false);
      return setStage('command');
    }
    setStage('calculating');
    try {
      finish(await analyzeMealText(geminiKey, text), 'voice');
    } catch (e) {
      setError(friendly(e));
      setStage('idle');
    }
  };

  const [webCam, setWebCam] = useState(false);
  /** A picture is ready (from the gallery, the phone camera or the web camera): send it for analysis. */
  const analyzePicture = async (base64: string, mime: string, previewUri: string) => {
    setUri(previewUri);
    setStage('calculating');
    try {
      finish(await analyzeMealPhoto(geminiKey, base64, mime), 'photo');
    } catch (e) {
      setError(friendly(e));
      setStage('idle');
    }
  };

  const fromPhoto = async (src: 'camera' | 'library') => {
    setError('');
    if (src === 'camera' && Platform.OS === 'web') return setWebCam(true); // the browser asks for camera access
    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      if (src === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          return setError(t('photo.errCamera'));
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true }; // detail matters for judging portions
      const res = src === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      asset = res.assets?.[0];
    } catch (e) {
      return setError(friendly(e));
    }
    if (!asset?.base64) return setError(t('photo.errRead'));
    setUri(asset.uri);
    setStage('calculating');
    try {
      finish(await analyzeMealPhoto(geminiKey, asset.base64, asset.mimeType ?? 'image/jpeg'), 'photo');
    } catch (e) {
      setError(friendly(e));
      setStage('idle');
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const perm = await ensurePermission(getRecordingPermissionsAsync, requestRecordingPermissionsAsync);
      if (perm !== 'granted') {
        explainPermission(perm, t('perm.mic'), t);
        return setError(t('voice.errMic'));
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage('recording');
    } catch (e) {
      setError(friendly(e));
      setStage('idle');
    }
  };

  const stopRecording = async () => {
    setStage('calculating');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const file = recorder.uri;
      if (!file) throw new Error(t('voice.errRecord'));
      const bytes = new Uint8Array(await new File(file).arrayBuffer());
      if (bytes.length > MAX_AUDIO_BYTES) {
        setError(t('voice.errTooBig'));
        return setStage('idle');
      }
      finish(await analyzeMealAudio(geminiKey, bytesToBase64(bytes), 'audio/mp4'), 'voice');
    } catch (e) {
      setError(friendly(e));
      setStage('idle');
    }
  };

  const addMore = async () => {
    const text = more.trim();
    if (!text) return;
    setAdding(true);
    try {
      const r = await analyzeMealText(geminiKey, text);
      setItems((l) => [...l, ...r.items]);
      setMore('');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setAdding(false);
    }
  };

  /** Work one item out again with the extra detail the person typed for it. */
  const refine = async (it: MealItem) => {
    const d = (detail[it.id] ?? '').trim();
    if (!d) return;
    setRefining(it.id);
    setError('');
    try {
      const n = await refineItem(geminiKey, it, d);
      if (n) {
        setItems((l) => l.map((x) => (x.id === it.id ? n : x)));
        setDetail((m) => ({ ...m, [it.id]: '' }));
      } else setError(t('log.detailFail'));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setRefining(null);
    }
  };

  const total = mealTotals(items);

  const save = () => {
    for (const it of items) {
      const n = itemNutrients(it);
      addEntry(foodFromItem(it), itemGrams(it), meal, date, { [source]: true, macros: { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat, fiber: n.fiber, sugar: n.sugar, satFat: n.satFat } });
    }
    goHome();
  };

  const runCommand = () => {
    if (!cmd) return;
    const day = toDateKey(new Date());
    if (cmd.type === 'water') tracker.addWater(day, cmd.ml);
    else if (cmd.type === 'weight') tracker.logWeight(day, cmd.kg);
    else tracker.addActivity({ date: day, type: cmd.kind, minutes: cmd.minutes, ...(cmd.km ? { km: cmd.km } : {}) });
    setCmdDone(true);
  };

  const reset = () => {
    setStage('idle');
    setItems([]);
    setTyped('');
    setUri(null);
    setError('');
    setCmd(null);
    setCmdDone(false);
  };

  const content = (
    <>
        {webCam && stage === 'idle' && (
          <WebCamera
            onCancel={() => setWebCam(false)}
            onError={(m) => { setWebCam(false); setError(m); }}
            onShot={(b64, u) => { setWebCam(false); void analyzePicture(b64, 'image/jpeg', u); }}
          />
        )}

        {stage === 'idle' && !webCam && (
          <>
            {geminiKey && !aiConsent && (
              <Card style={{ gap: 8 }}>
                <Text style={styles.h2}>{t('photo.googleTitle')}</Text>
                <Text style={styles.sub}>{t('photo.consentBody')}</Text>
                <Button title={t('photo.continue')} onPress={() => setAiConsent(true)} />
              </Card>
            )}
            {mode === 'voice' && (
              <Card style={{ gap: 10 }}>
                <Ionicons style={{ alignSelf: 'center' }} name={listening ? 'mic' : 'mic-outline'} size={44} color={listening ? colors.danger : colors.primary} />
                <Text style={[styles.body, { textAlign: 'center' }]}>{listening ? t('log.listening') : t('log.voiceIntro')}</Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <Button
                    title={listening ? t('log.stop') : t('log.speak')}
                    icon={listening ? 'stop' : 'mic'}
                    disabled={!ready}
                    onPress={Platform.OS === 'web' ? toggleListening : startRecording}
                  />
                </View>
                {!geminiKey ? <Text style={styles.sub}>{t('rest.needKey')}</Text> : null}
              </Card>
            )}
            {mode === 'photo' ? (
              <Card style={{ gap: 10 }}>
                <Text style={styles.body}>{t('log.photoIntro')}</Text>
                <Button title={t('log.photo')} icon="camera" disabled={!ready} onPress={() => fromPhoto('camera')} />
                <Button title={t('log.gallery')} icon="images" variant="ghost" disabled={!ready} onPress={() => fromPhoto('library')} />
                {!geminiKey ? <Text style={styles.sub}>{t('rest.needKey')}</Text> : null}
                {error ? <Text style={styles.err}>{error}</Text> : null}
              </Card>
            ) : (
            <Card style={{ gap: 10 }}>
              <Text style={styles.body}>{t('log.intro')}</Text>
              <TextInput value={typed} onChangeText={setTyped} multiline placeholder={t('log.ph')} placeholderTextColor={colors.inkSoft} style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} />
              <Button title={t('log.go')} icon="sparkles" disabled={!typed.trim() || !ready} onPress={fromText} />
              {error ? <Text style={styles.err}>{error}</Text> : null}
            </Card>
            )}
            {mode === 'text' && Platform.OS !== 'web' && (
              <Card style={{ gap: 10 }}>
                <Button title={t('log.photo')} icon="camera" variant="ghost" disabled={!ready} onPress={() => fromPhoto('camera')} />
                <Button title={t('log.gallery')} icon="images" variant="ghost" disabled={!ready} onPress={() => fromPhoto('library')} />
                <Button title={t('log.record')} icon="mic" variant="ghost" disabled={!ready} onPress={startRecording} />
              </Card>
            )}
          </>
        )}

        {stage === 'recording' && (
          <Card style={{ alignItems: 'center', gap: 14 }}>
            <Ionicons name="mic" size={48} color={colors.danger} />
            <Text style={styles.body}>{t('log.recording')}</Text>
            <Button title={t('log.stop')} icon="stop" onPress={stopRecording} />
          </Card>
        )}

        {stage === 'calculating' && <Calculating photoUri={uri} />}

        {stage === 'command' && cmd && (
          <Card style={{ gap: 10 }}>
            <Text style={styles.h2}>{t('voice.cmd.title')}</Text>
            <Text style={styles.body}>
              {cmd.type === 'water' && t('voice.cmd.water', { ml: cmd.ml })}
              {cmd.type === 'weight' && t('voice.cmd.weight', { kg: cmd.kg })}
              {cmd.type === 'activity' && `${t('voice.cmd.activity', { kind: t(`act.type.${cmd.kind}` as Key), minutes: cmd.minutes })}${cmd.km ? t('voice.cmd.km', { km: cmd.km }) : ''}`}
            </Text>
            {cmd.type === 'activity' && cmd.assumedPace && <Text style={styles.sub}>{t('voice.cmd.pace')}</Text>}
            <Button title={cmdDone ? t('voice.cmd.done') : t('voice.cmd.add')} icon={cmdDone ? 'checkmark' : 'add'} disabled={cmdDone} onPress={runCommand} />
            <Button title={t('log.again')} variant="ghost" onPress={reset} />
          </Card>
        )}

        {stage === 'review' && (
          <>
            {uri && <Image source={{ uri }} style={styles.photo} />}
            {items.length === 0 ? (
              <Card style={{ gap: 8 }}>
                <Text style={styles.body}>{t('log.empty')}</Text>
                <Button title={t('log.again')} variant="ghost" onPress={reset} />
              </Card>
            ) : (
              <>
                <Card style={{ gap: 10 }}>
                  <Text style={styles.h2}>{t('log.total')}</Text>
                  <NutrientGrid values={total} />
                </Card>

                <Text style={styles.h2}>{t('log.items')}</Text>
                {items.map((it) => {
                  const n = itemNutrients(it);
                  return (
                    <Card key={it.id} style={{ gap: 8 }}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.h2, { flex: 1 }]} numberOfLines={2}>{it.name}</Text>
                        <Text style={styles.kcal}>{n.kcal} kcal</Text>
                      </View>
                      <Text style={styles.sub}>{it.stated ? t('log.yours') : t('log.assumed')}</Text>
                      {it.note ? <Text style={styles.note}>📝 {it.note}</Text> : null}
                      <View style={styles.rowBetween}>
                        <View style={styles.stepper}>
                          <Pressable style={styles.step} onPress={() => setItems((l) => l.map((x) => (x.id === it.id ? setCount(x, x.count - stepFor(x)) : x)))} accessibilityLabel="−">
                            <Text style={styles.stepText}>−</Text>
                          </Pressable>
                          <Text style={styles.qty}>{isMeasure(it) ? `${it.count} ${it.unit}` : `${it.count} × ${it.unit}`}</Text>
                          <Pressable style={styles.step} onPress={() => setItems((l) => l.map((x) => (x.id === it.id ? setCount(x, x.count + stepFor(x)) : x)))} accessibilityLabel="+">
                            <Text style={styles.stepText}>+</Text>
                          </Pressable>
                        </View>
                        <View style={styles.gramsBox}>
                          <TextInput
                            value={String(itemGrams(it))}
                            onChangeText={(v) => {
                              const g = parseFloat(v);
                              if (g > 0) setItems((l) => l.map((x) => (x.id === it.id ? setGrams(x, g) : x)));
                            }}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            style={styles.grams}
                          />
                          <Text style={styles.sub}>{t('log.grams')}</Text>
                        </View>
                      </View>
                      <Text style={styles.sub}>
                        {t('macro.protein')} {n.protein} g · {t('macro.carbs')} {n.carbs} g · {t('macro.fat')} {n.fat} g
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TextInput
                          value={detail[it.id] ?? ''}
                          onChangeText={(v) => setDetail((m) => ({ ...m, [it.id]: v }))}
                          placeholder={t('log.detailPh')}
                          placeholderTextColor={colors.inkSoft}
                          style={[styles.input, { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 13 }]}
                          onSubmitEditing={() => void refine(it)}
                        />
                        <Pressable onPress={() => void refine(it)} disabled={refining !== null || !(detail[it.id] ?? '').trim()} style={[styles.step, { width: 44, opacity: (detail[it.id] ?? '').trim() ? 1 : 0.4 }]} accessibilityLabel={t('log.detailBtn')}>
                          {refining === it.id ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="refresh" size={20} color={colors.ink} />}
                        </Pressable>
                      </View>
                      <Pressable onPress={() => setItems((l) => l.filter((x) => x.id !== it.id))}>
                        <Text style={[styles.link, { color: colors.danger }]}>{t('common.remove')}</Text>
                      </Pressable>
                    </Card>
                  );
                })}

                <Card style={{ gap: 8 }}>
                  <Text style={styles.h2}>{t('log.addMore')}</Text>
                  <TextInput value={more} onChangeText={setMore} placeholder={t('log.addPh')} placeholderTextColor={colors.inkSoft} style={styles.input} />
                  <Button title={t('log.addBtn')} icon="add" variant="ghost" disabled={!more.trim() || adding} onPress={addMore} />
                  {error ? <Text style={styles.err}>{error}</Text> : null}
                </Card>

                <Text style={styles.h2}>{t('log.meal')}</Text>
                <View style={styles.mealRow}>
                  {MEALS.map((m) => (
                    <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.mealChip, meal === m.key && styles.mealOn]}>
                      <Text style={[styles.mealText, meal === m.key && { color: colors.onPrimary }]}>{t(`meal.${m.key}` as Key)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Button title={t('log.save')} icon="checkmark" onPress={save} />
                <Button title={t('log.again')} variant="ghost" onPress={reset} />
              </>
            )}
          </>
        )}
    </>
  );
  if (embedded) return <View style={{ gap: 14 }}>{content}</View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('log.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  err: { fontSize: 13, color: colors.danger },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  note: { fontSize: 12, color: colors.ink, lineHeight: 17, fontStyle: 'italic' },
  photo: { width: '100%', height: 150, borderRadius: radius.md, borderWidth: BORDER, borderColor: colors.cardBorder },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kcal: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '800', color: colors.ink },
  qty: { minWidth: 70, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.ink },
  gramsBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grams: { width: 66, textAlign: 'center', fontSize: 16, fontWeight: '700', borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, color: colors.ink, backgroundColor: colors.card },
  mealRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mealChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.line },
  mealOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
