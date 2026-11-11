import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, View } from 'react-native';
import { Loading } from '../src/components/Loading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { Button, Card } from '../src/components/ui';
import { Key, coachLanguageName } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { nowMs } from '../src/lib/clock';
import { WHO_WEEKLY_MINUTES, weekSummary as activityWeek } from '../src/lib/activity';
import { readiness, restDaysThisWeek, sleepStats, trainingStreakBefore } from '../src/lib/recovery';
import { analyzeCoach } from '../src/lib/coach';
import { ChatMsg, GoalProposal, buildSystemInstruction, coachReply, makeFoodLookup, splitGoalProposal } from '../src/lib/coachChat';
import { buildCoachContext } from '../src/lib/coachContext';
import { DEFAULT_PROFILE, toDateKey } from '../src/lib/nutrition';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

const QUICK: Key[] = ['coach.q1', 'coach.q2', 'coach.q3', 'coach.q4', 'coach.q5'];

/** Chat with the Kabe coach: what to eat more or less of, and how to reach your goals. Opened from the insights card on Progress. */
export default function CoachChatScreen() {
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
  const [proposal, setProposal] = useState<GoalProposal | null>(null);

  const a = useMemo(
    () => analyzeCoach({ profile, goals: k.goals, entries: k.entries, weights: tk.weights, goalWeight: tk.goalWeight, today }),
    [profile, k.goals, k.entries, tk.weights, tk.goalWeight, today],
  );

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText('');
    setError('');
    setProposal(null);
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
      const parts = splitGoalProposal(reply);
      tk.addCoachMessage({ id: `${nowMs()}-c`, role: 'coach', text: parts.text });
      if (parts.goals && (parts.goals.kcal !== k.goals.kcal || parts.goals.protein !== k.goals.protein)) setProposal(parts.goals);
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('coach.chatTitle')}</Text>
          <Text style={styles.sub}>{t('coach.chatSub')}</Text>
        </View>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30, gap: 14 }} keyboardShouldPersistTaps="handled">
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
            {proposal && !busy && (
              <Card style={{ gap: 8 }}>
                <Text style={styles.h2}>{t('coach.tuneTitle')}</Text>
                <Text style={styles.body}>{t('coach.tuneBody', { kcal: proposal.kcal, p: proposal.protein, c: proposal.carbs, f: proposal.fat })}</Text>
                <Button title={t('coach.tuneYes')} icon="checkmark" onPress={() => { k.setCustomGoals({ ...k.goals, ...proposal }); setProposal(null); tk.addCoachMessage({ id: `${nowMs()}-g`, role: 'coach', text: t('coach.tuneDone') }); }} />
                <Button title={t('coach.tuneNo')} variant="ghost" onPress={() => setProposal(null)} />
              </Card>
            )}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
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
