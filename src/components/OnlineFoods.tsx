import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Loading } from './Loading';
import { Text } from './Text';
import type { Food } from '../data/foods';
import { nativeToEnglish } from '../data/nativeFoods';
import { useT } from '../i18n/useT';
import { lookupFood } from '../lib/mealAi';
import { r0, r1 } from '../lib/nutrition';
import { useKabe } from '../store/kabe';
import { useThemedStyles, type Colors } from '../theme';
import { Button } from './ui';

type State = 'idle' | 'busy' | 'done' | 'retry';

/** Looks the typed food up with Gemini after a short pause. Pass '' to switch it off (e.g. when local results are plentiful). */
export function useOnlineFood(query: string) {
  const { geminiKey, aiConsent } = useKabe();
  const can = !!geminiKey && aiConsent;
  const q = nativeToEnglish(query.trim()).toLowerCase();
  const cache = useRef(new Map<string, Food[]>());
  const [res, setRes] = useState<{ q: string; foods: Food[]; state: State }>({ q: '', foods: [], state: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!can || q.length < 3) return;
    const hit = cache.current.get(q);
    if (hit) {
      setRes({ q, foods: hit, state: 'done' });
      return;
    }
    let live = true;
    setRes({ q, foods: [], state: 'busy' });
    const id = setTimeout(async () => {
      let foods: Food[] = [];
      try {
        const found = await lookupFood(geminiKey, q);
        foods = found ? [found] : [];
      } catch {
        /* shown as the friendly "try again" below */
      }
      if (!live) return;
      if (foods.length) cache.current.set(q, foods);
      setRes({ q, foods, state: foods.length ? 'done' : 'retry' });
    }, 800);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, can, geminiKey, nonce]);

  const current = res.q === q && q.length >= 3 && can;
  return {
    can,
    hasKey: !!geminiKey,
    foods: current ? res.foods : [],
    state: (current ? res.state : 'idle') as State,
    retry: () => setNonce((n) => n + 1),
  };
}

/** The lookup's rows and its friendly states (looking, retry, how to switch it on). Never shows an error. */
export function OnlineFoods({ online, query, onPick }: { online: ReturnType<typeof useOnlineFood>; query: string; onPick: (f: Food) => void }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { setAiConsent } = useKabe();
  if (query.trim().length < 3) return null;

  if (!online.can) {
    return (
      <View style={styles.box}>
        <Text style={styles.sub}>{online.hasKey ? t('lookup.needAgree') : t('lookup.needKey')}</Text>
        {online.hasKey && <Button title={t('photo.continue')} variant="ghost" onPress={() => setAiConsent(true)} />}
      </View>
    );
  }
  return (
    <View style={styles.box}>
      {online.state === 'busy' && (
        <View style={styles.row}>
          <Loading />
          <Text style={styles.sub}>{t('lookup.busy')}</Text>
        </View>
      )}
      {online.foods.map((f) => (
        <Pressable key={f.id} style={styles.item} onPress={() => onPick(f)}>
          <Text style={styles.name} numberOfLines={2}>{f.name}</Text>
          <Text style={styles.sub}>
            {t('picker.sub', { kcal: r0(f.kcal), protein: t('macro.protein'), p: r1(f.protein) })}
          </Text>
        </Pressable>
      ))}
      {online.state === 'retry' && (
        <Pressable onPress={online.retry}>
          <Text style={styles.link}>{t('lookup.retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  box: { gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
