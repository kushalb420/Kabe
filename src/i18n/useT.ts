import { useCallback } from 'react';
import { useKabe } from '../store/kabe';
import { Key, Vars, translate, translatePlural } from './index';

/** `t('tab.today')`, `t('today.level', { level: 3, … })`, `tn('today.streak', 5)` in the user's chosen language. */
export function useT() {
  const { language } = useKabe();
  const t = useCallback((key: Key, vars?: Vars) => translate(language, key, vars), [language]);
  const tn = useCallback((base: string, n: number, vars?: Vars) => translatePlural(language, base, n, vars), [language]);
  return { t, tn, lang: language };
}
