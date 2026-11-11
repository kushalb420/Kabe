import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, View } from 'react-native';
import { Loading } from '../../src/components/Loading';
import { Alert } from '../../src/lib/alert';
import { Dots } from '../../src/components/Dots';
import { Text, TextInput } from '../../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../../src/components/ui';
import { Key, coachLanguageName } from '../../src/i18n';
import { useT } from '../../src/i18n/useT';
import { nowMs } from '../../src/lib/clock';
import { WHO_WEEKLY_MINUTES, weekSummary as activityWeek } from '../../src/lib/activity';
import { readiness, restDaysThisWeek, sleepStats, trainingStreakBefore } from '../../src/lib/recovery';
import { analyzeCoach } from '../../src/lib/coach';
import { ChatMsg, buildSystemInstruction, coachReply, makeFoodLookup, splitGoalProposal } from '../../src/lib/coachChat';
import { buildCoachContext } from '../../src/lib/coachContext';
import { DEFAULT_PROFILE, macrosForCalories, r0, toDateKey } from '../../src/lib/nutrition';
import { useKabe } from '../../src/store/kabe';
import { useTracker } from '../../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../../src/theme';

const QUICK: Key[] = ['coach.q1', 'coach.q2', 'coach.q3', 'coach.q4', 'coach.q5'];

export default function Coach() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const k = useKabe();
  const tk = useTracker();
  const { t } = useT();
  const today = toDateKey(new Date());
  const profile = k.profile ?? DEFAULT_PROFILE;
  const scroll = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [goalText, setGoalText] = useState(tk.goalWeight ? String(tk.goalWeight) : '');

  const a = useMemo(
    () => analyzeCoach({ profile, goals: k.goals, entries: k.entries, weights: tk.weights, goalWeight: tk.goalWeight, today }),
    [profile, k.goals, k.entries, tk.weights, tk.goalWeight, today],
  );

  const slopeText = a.slope ? `${a.slope.kgPerWeek > 0 ? '+' : ''}${Math.round(a.slope.kgPerWeek * 100) / 100}` : '';
  const diff = a.target.kcal - k.goals.kcal;

  // the analysis comes back with English text plus a code; show the code in the user's language
  const noteText = t(`coach.note.${a.target.noteCode}` as Key, { floor: a.target.kcal });
  const tdeeReason = (r: Extract<typeof a.tdee, { ok: false }>) =>
    r.code ? t(`coach.reason.${r.code}` as Key, { days: r.days ?? 0, window: r.window ?? 28 }) : r.reason;

  const useTarget = () =>
    Alert.alert(t('coach.updateQ'), t('coach.updateBody', { from: r0(k.goals.kcal), to: a.target.kcal }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('coach.update'), onPress: () => k.setGoals(macrosForCalories(a.target.kcal, a.weightKg, profile.goal)) },
    ]);

  const saveGoal = () => {
    const v = parseFloat(goalText.replace(',', '.'));
    if (!goalText.trim()) return tk.setGoalWeight(null);
    if (!(v >= 30 && v <= 250)) return Alert.alert(t('body.checkNumber'), t('coach.goalRange'));
    tk.setGoalWeight(Math.round(v * 10) / 10);
  };

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText('');
    setError('');
    const history = tk.coachChat;
    tk.addCoachMessage({ id: `${nowMs()}-u`, role: 'user', text: question });
    setBusy(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    try {
      const quickFoods = [...k.favorites.map((id) => k.allFoods.find((f) => f.id === id)), ...k.recentFoods].filter((f): f is NonNullable<typeof f> => !!f);
      const ctx = buildCoachContext({
        today, profile: k.profile, goals: k.goals, entries: k.entries, weights: tk.weights, goalWeight: tk.goalWeight, workouts: k.workouts,
        water: tk.water, waterGoal: tk.waterGoal, caffeine: tk.caffeine, habits: tk.habits, habitLog: tk.habitLog, supplements: tk.supplements,
        supplementLog: tk.supplementLog, quickFoods, analysis: a,
        lifestyle: (() => {
          const streak = trainingStreakBefore(today, k.workouts, tk.activities, tk.restDays);
          const ck = tk.checkins[today];
          const sl = sleepStats(tk.checkins, today, tk.sleepGoal);
          const wk = activityWeek(tk.activities, tk.steps, today, a.weightKg, tk.stepGoal);
          return {
            readinessToday: ck ? readiness(ck, streak).score : 'no check-in today',
            todayCheckin: ck ?? undefined,
            hardTrainingDaysInARow: streak,
            restDaysLast7: restDaysThisWeek(today, k.workouts, tk.activities, tk.restDays),
            sleepAvgHours7d: sl.avg7 ?? 'not logged',
            sleepShortOfGoalHours7d: sl.debtH,
            sleepGoalHours: tk.sleepGoal,
            activeMinutes7d: wk.activeMinutes,
            whoWeeklyGuidelineMinutes: WHO_WEEKLY_MINUTES,
            km7d: wk.km,
            avgSteps7d: wk.avgSteps ?? 'not logged',
            stepGoal: tk.stepGoal,
          };
        })(),
      });
      const reply = await coachReply(k.geminiKey, history, question, buildSystemInstruction(JSON.stringify(ctx), coachLanguageName(k.language)), makeFoodLookup(k.geminiKey, k.allFoods));
      tk.addCoachMessage({ id: `${nowMs()}-c`, role: 'coach', text: splitGoalProposal(reply).text });
    } catch (e) {
      // keep the technical detail (it is often an API message) after a message in the user's language
      setError(e instanceof Error && e.message ? `${t('coach.failed')} (${e.message})` : t('coach.failed'));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const chatReady = !!k.geminiKey && k.coachConsent;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Dots />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 30, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.title}>{t('tab.coach')}</Text>
          <Text style={styles.sub}>{t('coach.subtitle')}</Text>
        </View>

        {!k.profile && (
          <Card style={{ backgroundColor: colors.primarySoft, gap: 6 }}>
            <Text style={styles.h2}>{t('coach.tipTitle')}</Text>
            <Text style={styles.body}>{t('coach.tipBody')}</Text>
          </Card>
        )}

        {/* Calories */}
        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('coach.calories')}</Text>
          {a.tdee.ok ? (
            <Text style={styles.body}>{t('coach.tdeeOk', { kcal: a.tdee.tdee, conf: t(`coach.conf.${a.tdee.confidence}` as Key) })}</Text>
          ) : (
            <Text style={styles.body}>{t('coach.tdeeNo', { reason: tdeeReason(a.tdee) })}</Text>
          )}
          <Text style={styles.big}>{t('coach.suggested', { kcal: a.target.kcal })}</Text>
          <Text style={styles.sub}>
            {t(a.target.basis === 'your logs' ? 'coach.basis.logs' : 'coach.basis.formula', { note: noteText })}
            {!a.tdee.ok || a.tdee.confidence === 'low' ? t('coach.formulaNote') : ''}
          </Text>
          {Math.abs(diff) >= 50 ? (
            <Button title={t('coach.useTarget', { kcal: a.target.kcal })} variant="ghost" onPress={useTarget} />
          ) : (
            <Text style={styles.sub}>{t('coach.matches', { kcal: r0(k.goals.kcal) })}</Text>
          )}
        </Card>

        {/* Weight */}
        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('coach.weightTrend')}</Text>
          <Text style={styles.body}>{t(`coach.status.${a.status}` as Key, { s: slopeText })}</Text>
          {a.tooFast && <Text style={styles.warn}>{t('coach.tooFast')}</Text>}
          <Text style={styles.body}>
            {a.forecast.ok
              ? t('coach.forecast', { kg: tk.goalWeight ?? '', date: a.forecast.date, weeks: a.forecast.weeks })
              : t(`coach.forecast.${a.forecast.reason}` as Key)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={styles.sub}>{t('coach.goalWeight')}</Text>
            <TextInput
              value={goalText}
              onChangeText={setGoalText}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor={colors.inkSoft}
              style={styles.goalInput}
              onSubmitEditing={saveGoal}
            />
            <Pressable onPress={saveGoal}>
              <Text style={styles.link}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </Card>

        {/* Week */}
        <Card style={{ gap: 6 }}>
          <Text style={styles.h2}>{t('prog.subtitle')}</Text>
          {a.week.loggedDays === 0 ? (
            <Text style={styles.body}>{t('coach.noFood')}</Text>
          ) : (
            <>
              <Text style={styles.body}>
                {t('coach.weekLine', { days: a.week.loggedDays, kcal: a.week.avgKcal, tk: r0(k.goals.kcal), p: a.week.avgProtein, tp: r0(k.goals.protein) })}
              </Text>
              <Text style={styles.sub}>{t('coach.weekSub', { p: a.week.proteinGoalDays, k: a.week.kcalGoalDays })}</Text>
            </>
          )}
        </Card>

        {/* Chat */}
        <Text style={[styles.h2, { marginTop: 6 }]}>{t('coach.ask')}</Text>

        {!k.geminiKey ? (
          <Card style={{ gap: 8 }}>
            <Text style={styles.body}>{t('coach.needKey')}</Text>
          </Card>
        ) : !k.coachConsent ? (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('coach.consentTitle')}</Text>
            <Text style={styles.body}>{t('coach.consentBody')}</Text>
            <Button title={t('coach.consentBtn')} onPress={() => k.setCoachConsent(true)} />
          </Card>
        ) : null}

        {chatReady && (
          <>
            {tk.coachChat.length === 0 && (
              <View style={styles.chips}>
                {QUICK.map((q) => (
                  <Pressable key={q} style={styles.chip} onPress={() => send(t(q))} disabled={busy}>
                    <Text style={styles.chipText}>{t(q)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {tk.coachChat.map((m: ChatMsg) => (
              <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
                <Text style={m.role === 'user' ? styles.mineText : styles.theirText}>{m.text}</Text>
              </View>
            ))}
            {busy && (
              <View style={[styles.bubble, styles.theirs, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <Loading />
                <Text style={styles.theirText}>{t('coach.thinking')}</Text>
              </View>
            )}
            {error ? <Text style={styles.warn}>{error}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('coach.placeholder')}
                placeholderTextColor={colors.inkSoft}
                style={styles.chatInput}
                multiline
                onSubmitEditing={() => send(text)}
              />
              <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} style={[styles.send, (busy || !text.trim()) && { opacity: 0.4 }]}>
                <Ionicons name="send" size={20} color={colors.onPrimary} />
              </Pressable>
            </View>
            {tk.coachChat.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                <Pressable onPress={() => tk.clearCoachChat()}>
                  <Text style={styles.link}>{t('coach.clear')}</Text>
                </Pressable>
                <Pressable onPress={() => k.setCoachConsent(false)}>
                  <Text style={styles.link}>{t('coach.withdraw')}</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.note}>{t('coach.disclaimer')}</Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  big: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  bold: { fontWeight: '800' },
  warn: { fontSize: 13, color: colors.danger, lineHeight: 18 },
  note: { fontSize: 11, color: colors.inkSoft, textAlign: 'center', lineHeight: 16 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  goalInput: { width: 90, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  bubble: { maxWidth: '88%', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  mineText: { color: colors.onPrimary, fontSize: 14, lineHeight: 20 },
  theirText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  chatInput: { flex: 1, maxHeight: 110, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
