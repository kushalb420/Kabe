import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Dots } from '../src/components/Dots';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NumBox } from '../src/components/NumBox';
import { Button, Card } from '../src/components/ui';
import { r0, r1, scaleToGrams } from '../src/lib/nutrition';
import { Entry, useKabe } from '../src/store/kabe';
import { useT } from '../src/i18n/useT';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { goBack } from '../src/lib/nav';

type Vals = { kcal: number; protein: number; carbs: number; fat: number };

export default function EditEntry() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, entries } = useKabe();
  const { t } = useT();
  const entry = entries.find((e) => e.id === id);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />; // wait for saved data before building the form
  if (!entry) {
    return (
      <View style={styles.wrap}>
        <Dots />
        <Text style={styles.title}>{t('edit.notFound')}</Text>
        <Button title={t('common.close')} variant="ghost" onPress={() => goBack()} />
      </View>
    );
  }
  return <EditForm entry={entry} />;
}

function EditForm({ entry }: { entry: Entry }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { updateEntry, removeEntry } = useKabe();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [grams, setGrams] = useState(String(r1(entry.grams)));
  const [vals, setVals] = useState<Vals>({ kcal: r0(entry.kcal), protein: r1(entry.protein), carbs: r1(entry.carbs), fat: r1(entry.fat) });
  const [edited, setEdited] = useState(false); // true once the user typed their own macro numbers

  const g = parseFloat(grams.replace(',', '.'));

  // changing grams rescales the numbers from the saved entry, unless the user has typed their own numbers
  const onGrams = (text: string) => {
    setGrams(text);
    const n = parseFloat(text.replace(',', '.'));
    if (!edited && n > 0) {
      const s = scaleToGrams(entry, n);
      setVals({ kcal: r0(s.kcal), protein: r1(s.protein), carbs: r1(s.carbs), fat: r1(s.fat) });
    }
  };
  const setMacro = (k: keyof Vals) => (v: number) => {
    setEdited(true);
    setVals((p) => ({ ...(p as Vals), [k]: v }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Dots />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} numberOfLines={2}>
        {entry.name}
      </Text>
      <Card style={{ gap: 12 }}>
        <Text style={styles.label}>{t('edit.amount')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={grams} onChangeText={onGrams} keyboardType="decimal-pad" selectTextOnFocus style={styles.input} />
          <Text style={styles.unit}>g</Text>
        </View>
        <Text style={styles.label}>
          {t('edit.nutrition')}
          {edited ? t('edit.yourNumbers') : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <NumBox live label="kcal" value={vals.kcal} onCommit={setMacro('kcal')} />
          <NumBox live label={t('edit.proteinG')} value={vals.protein} onCommit={setMacro('protein')} />
          <NumBox live label={t('edit.carbsG')} value={vals.carbs} onCommit={setMacro('carbs')} />
          <NumBox live label={t('edit.fatG')} value={vals.fat} onCommit={setMacro('fat')} />
        </View>
        <Text style={styles.hint}>{t('edit.hint')}</Text>
      </Card>
      <Button
        title={t('edit.save')}
        icon="checkmark"
        disabled={!(g > 0)}
        onPress={() => {
          updateEntry(entry.id, { grams: g, ...vals });
          goBack();
        }}
      />
      <Button
        title={t('edit.delete')}
        variant="ghost"
        onPress={() =>
          Alert.alert(t('edit.deleteAsk'), entry.name, [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: () => {
                removeEntry(entry.id);
                goBack();
              },
            },
          ])
        }
      />
    </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { padding: 18, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  input: { width: 120, fontSize: 26, fontWeight: '700', borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.ink },
  unit: { fontSize: 18, color: colors.inkSoft, fontWeight: '600' },
});
