import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BUY_CATEGORIES, buyIdeas, type BuyCategory } from '../../lib/buyIdeas';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { useKitchen } from '../../store/kitchen';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../theme';
import { Text, TextInput } from '../Text';
import { Button, Card } from '../ui';
import { Sticker } from '../Sticker';

/** Things to buy. Tick what you bought and move it to the pantry in one tap. */
export function BuyTab() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const kit = useKitchen();
  const [name, setName] = useState('');
  const add = () => {
    kit.addShopping(name);
    setName('');
  };
  const [cat, setCat] = useState<BuyCategory | null>(null);
  const [all, setAll] = useState(false);
  const ideas = useMemo(() => buyIdeas({ equipment: kit.equipment, diet: kit.diet, pantry: kit.pantry, shopping: kit.shopping, cat }), [kit.equipment, kit.diet, kit.pantry, kit.shopping, cat]);
  const shown = all || cat ? ideas : ideas.slice(0, 16);
  const ticked = kit.shopping.filter((s) => s.done).length;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={name} onChangeText={setName} placeholder={t('k2.buyItem')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1, minWidth: 0 }]} onSubmitEditing={add} />
        </View>
        <Button title={t('common.add')} icon="add" variant="ghost" onPress={add} disabled={!name.trim()} />
      </Card>
      {ideas.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.name}>{t('buy.suggest')}</Text>
          <Text style={styles.sub}>{t('buy.suggestSub')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {([null, ...BUY_CATEGORIES] as (BuyCategory | null)[]).map((c) => (
              <Pressable key={c ?? 'all'} onPress={() => setCat(c)} style={[styles.cat, cat === c && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.catText, cat === c && { color: colors.onPrimary }]}>{t(c ? (`buy.cat.${c}` as Key) : 'buy.all')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {shown.map((x) => (
              <Pressable key={x.name} onPress={() => kit.addShopping(x.name, t(x.why === 'fridge' ? 'buy.whyFridge' : x.why === 'cook' ? 'buy.whyCook' : 'buy.whyShelf'))} style={styles.chip} accessibilityRole="button">
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.chipText}>{x.name}</Text>
              </Pressable>
            ))}
          </View>
          {!all && !cat && ideas.length > shown.length && (
            <Pressable onPress={() => setAll(true)}><Text style={styles.more}>{t('buy.showAll', { n: ideas.length })}</Text></Pressable>
          )}
        </Card>
      )}
      {kit.shopping.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Sticker name="rice" size={46} tilt={-6} />
          <Text style={[styles.sub, { flex: 1 }]}>{t('k2.buyEmpty')}</Text>
        </View>
      ) : (
        <Card style={{ gap: 2 }}>
          {kit.shopping.map((s) => (
            <View key={s.id} style={styles.row}>
              <Pressable onPress={() => kit.toggleShopping(s.id)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: s.done }}>
                <Ionicons name={s.done ? 'checkbox' : 'square-outline'} size={26} color={colors.primary} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, s.done && { textDecorationLine: 'line-through', color: colors.inkSoft }]}>{s.name}</Text>
                {s.why ? <Text style={styles.sub}>{s.why}</Text> : null}
              </View>
              <Pressable onPress={() => kit.removeShopping(s.id)} hitSlop={10} accessibilityLabel={t('common.remove')}>
                <Ionicons name="close-circle-outline" size={22} color={colors.inkSoft} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {ticked > 0 && <Button title={t('k2.moveBought')} icon="file-tray-stacked-outline" onPress={kit.moveBought} />}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  cat: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg },
  catText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  more: { fontSize: 13, fontWeight: '800', color: colors.primaryDark, textAlign: 'center', paddingTop: 4 },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
