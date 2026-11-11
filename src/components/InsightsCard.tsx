import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Loading } from './Loading';
import { Alert } from '../lib/alert';
import { FEATURES } from '../config/app';
import { Text } from './Text';
import type { Key } from '../i18n';
import { coachLanguageName } from '../i18n';
import { useT } from '../i18n/useT';
import { analyzeCoach } from '../lib/coach';
import { AiInsights, Tip, buildInsightFacts, factsKey, ruleTips } from '../lib/insights';
import { macrosForCalories, r0, toDateKey } from '../lib/nutrition';
import { writeInsights } from '../lib/vision';
import { useKabe } from '../store/kabe';
import { useKitchen } from '../store/kitchen';
import { useTracker } from '../store/tracker';
import { useColors, useThemedStyles, type Colors } from '../theme';
import { Button, Card } from './ui';

const SECTIONS = [
  { dir: 'more', title: 'ins.more', icon: 'arrow-up-circle' },
  { dir: 'less', title: 'ins.less', icon: 'arrow-down-circle' },
  { dir: 'improve', title: 'ins.improve', icon: 'build' },
] as const;

/** Replaces the coach tab: where to improve, what to have more and less of. Rule-based tips always show; AI tips replace them when available. */
export function InsightsCard() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const k = useKabe();
  const tk = useTracker();
  const kit = useKitchen();
  const today = toDateKey(new Date());
  const [busy, setBusy] = useState(false);
  const tried = useRef('');

  const facts = useMemo(
    () =>
      buildInsightFacts({
        today,
        entries: k.entries,
        goals: k.goals,
        steps: tk.steps,
        stepGoal: tk.stepGoal,
        weights: tk.weights,
        intent: k.intent,
        diet: kit.diet,
      }),
    [today, k.entries, k.goals, tk.steps, tk.stepGoal, tk.weights, k.intent, kit.diet],
  );
  // the calorie target Kabe would suggest from your weight trend and logs (only once your profile is filled in)
  const analysis = useMemo(
    () => (k.profile ? analyzeCoach({ profile: k.profile, goals: k.goals, entries: k.entries, weights: tk.weights, goalWeight: tk.goalWeight, today }) : null),
    [k.profile, k.goals, k.entries, tk.weights, tk.goalWeight, today],
  );
  const targetDiff = analysis ? analysis.target.kcal - k.goals.kcal : 0;
  const key = factsKey(today, facts);
  const tips = useMemo(() => ruleTips(facts), [facts]);
  const ai = !!k.geminiKey && k.aiConsent;
  const cached: AiInsights | null = k.insightCache && k.insightCache.key === key ? k.insightCache.tips : null;

  const run = async () => {
    if (!ai || busy) return;
    setBusy(true);
    try {
      const out = await writeInsights(k.geminiKey, facts, coachLanguageName(k.language) ?? 'English');
      if (out) k.setInsightCache({ key, tips: out });
    } catch {
      /* stay quiet: the quick tips below are already on screen */
    } finally {
      setBusy(false);
    }
  };

  // ask the AI once per change of facts, as soon as there is enough to talk about
  useEffect(() => {
    if (ai && !cached && facts.loggedDays >= 3 && tried.current !== key) {
      tried.current = key;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, cached, key, facts.loggedDays]);

  const useTarget = () => {
    if (!analysis || !k.profile) return;
    const to = analysis.target.kcal;
    Alert.alert(t('coach.updateQ'), t('coach.updateBody', { from: r0(k.goals.kcal), to }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('coach.update'), onPress: () => k.setGoals(macrosForCalories(to, analysis.weightKg, k.profile!.goal)) },
    ]);
  };

  const rule = (tip: Tip) => t(`ins.t.${tip.id}` as Key, tip.params);

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={20} color={colors.primary} />
        <Text style={[styles.h2, { flex: 1 }]}>{t('ins.title')}</Text>
        {ai && !busy && (
          <Pressable onPress={run} hitSlop={10}>
            <Text style={styles.link}>{t('ins.refresh')}</Text>
          </Pressable>
        )}
        {busy && <Loading />}
      </View>

      {SECTIONS.map((s) => {
        const lines = cached ? cached[s.dir] : tips.filter((x) => x.dir === s.dir).map(rule);
        if (!lines.length) return null;
        return (
          <View key={s.dir} style={{ gap: 4 }}>
            <View style={styles.sec}>
              <Ionicons name={s.icon} size={16} color={s.dir === 'less' ? colors.warn : colors.primary} />
              <Text style={styles.secTitle}>{t(s.title)}</Text>
            </View>
            {lines.map((line, i) => (
              <Text key={i} style={styles.body}>
                {line}
              </Text>
            ))}
          </View>
        );
      })}

      {analysis && Math.abs(targetDiff) >= 100 && (
        <View style={styles.target}>
          <Text style={styles.secTitle}>{t('coach.suggested', { kcal: analysis.target.kcal })}</Text>
          <Text style={styles.sub}>
            {t(analysis.target.basis === 'your logs' ? 'coach.basis.logs' : 'coach.basis.formula', {
              note: t(`coach.note.${analysis.target.noteCode}` as Key, { floor: analysis.target.kcal }),
            })}
          </Text>
          <Button title={t('coach.useTarget', { kcal: analysis.target.kcal })} variant="ghost" onPress={useTarget} />
        </View>
      )}

      <Text style={styles.sub}>{t('ins.disc')}</Text>
      {FEATURES.coachChat && (
        <Button title={t('coach.openChat')} icon="chatbubbles-outline" onPress={() => router.push('/coach-chat')} />
      )}

      {!k.intent.answered && (
        <Button title={t('ins.setup')} icon="options-outline" variant="ghost" onPress={() => router.push('/about')} />
      )}
      {!k.geminiKey && (
        <Text style={styles.sub}>{t('ins.needAi')}</Text>
      )}
      {!!k.geminiKey && !k.aiConsent && (
        <View style={{ gap: 6 }}>
          <Text style={styles.sub}>{t('photo.consentBody')}</Text>
          <Button title={t('ins.agree')} variant="ghost" onPress={() => k.setAiConsent(true)} />
        </View>
      )}
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sec: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  target: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
