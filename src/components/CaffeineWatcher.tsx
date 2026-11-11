import { useEffect, useRef } from 'react';
import {  } from 'react-native';
import { Alert } from '../lib/alert';
import { useT } from '../i18n/useT';
import { CAFFEINE_LIMIT_MG, caffeineOnDay } from '../lib/caffeine';
import { toDateKey } from '../lib/nutrition';
import { useKabe } from '../store/kabe';

/** When a logged meal or drink takes today's caffeine over the daily limit, show a reminder. Renders nothing. */
export function CaffeineWatcher() {
  const { entries, ready } = useKabe();
  const { t } = useT();
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const total = caffeineOnDay(entries, toDateKey(new Date()));
    const before = last.current;
    last.current = total;
    if (before !== null && total > before && total > CAFFEINE_LIMIT_MG) {
      Alert.alert(t('caff.alertTitle'), t('caff.alertBody', { mg: total, limit: CAFFEINE_LIMIT_MG }));
    }
  }, [entries, ready, t]);
  return null;
}
