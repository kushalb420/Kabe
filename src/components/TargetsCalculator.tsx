import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { Alert } from '../lib/alert';
import { DEFAULT_PROFILE, Profile, suggestGoals } from '../lib/nutrition';
import { useKabe } from '../store/kabe';
import { radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, value === o.key && styles.segOn]}>
          <Text style={[styles.segText, value === o.key && { color: colors.onPrimary }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** "Calculate my targets": your body details and goal, turned into daily calories and macros. Lives in Settings. */
export function TargetsCalculator() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { profile, setProfile, setGoals } = useKabe();
  const [p, setP] = useState<Profile>(profile ?? DEFAULT_PROFILE);

  const num = (k: 'age' | 'heightCm' | 'weightKg', label: string) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={String(p[k])} onChangeText={(text) => setP({ ...p, [k]: parseFloat(text) || 0 })} />
    </View>
  );

  const apply = () => {
    if (p.age < 10 || p.heightCm < 100 || p.weightKg < 25) {
      Alert.alert(t('me.checkNumbers'), t('me.realistic'));
      return;
    }
    setProfile(p);
    setGoals(suggestGoals(p));
  };

  return (
    <Card style={{ gap: 12 }}>
      <Text style={styles.h2}>{t('me.calc')}</Text>
      <Seg value={p.sex} options={[{ key: 'female', label: t('me.female') }, { key: 'male', label: t('me.male') }]} onChange={(sex) => setP({ ...p, sex })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {num('age', t('me.age'))}
        {num('heightCm', t('me.height'))}
        {num('weightKg', t('me.weight'))}
      </View>
      <Text style={styles.label}>{t('me.activity')}</Text>
      <Seg
        value={p.activity}
        options={[
          { key: 'sedentary', label: t('me.act.sedentary') },
          { key: 'light', label: t('me.act.light') },
          { key: 'moderate', label: t('me.act.moderate') },
          { key: 'active', label: t('me.act.active') },
        ]}
        onChange={(activity) => setP({ ...p, activity })}
      />
      <Text style={styles.label}>{t('me.goal')}</Text>
      <Seg
        value={p.goal}
        options={[
          { key: 'lose', label: t('me.goal.lose') },
          { key: 'maintain', label: t('me.goal.maintain') },
          { key: 'gain', label: t('me.goal.gain') },
        ]}
        onChange={(goal) => setP({ ...p, goal })}
      />
      <Button title={t('me.update')} onPress={apply} />
      <Text style={styles.sub}>{t('me.formula')}</Text>
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
  seg: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
