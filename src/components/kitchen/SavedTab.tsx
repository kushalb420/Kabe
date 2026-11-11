import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '../../lib/alert';
import { useT } from '../../i18n/useT';
import { SavedRecipe, useKitchen } from '../../store/kitchen';
import { useColors, useThemedStyles, type Colors } from '../../theme';
import { NutrientGrid } from '../NutrientGrid';
import { Text } from '../Text';
import { Card } from '../ui';
import { DishDetail } from './DishDetail';
import { Sticker } from '../Sticker';

/** Recipes you saved. Tap one to open it again; long-press to delete. */
export function SavedTab() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const kit = useKitchen();
  const [open, setOpen] = useState<SavedRecipe | null>(null);

  if (open) return <DishDetail dish={open} saved={open} onBack={() => setOpen(null)} />;
  if (kit.savedRecipes.length === 0)
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Sticker name="salmon" size={64} tilt={-6} />
        <Text style={[styles.sub, { flex: 1 }]}>{t('k2.savedEmpty')}</Text>
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {kit.savedRecipes.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => setOpen(r)}
          onLongPress={() => Alert.alert(r.name, '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => kit.removeRecipe(r.id) }])}
        >
          <Card style={{ gap: 8 }}>
            <View style={styles.row}>
              <Text style={[styles.name, { flex: 1 }]}>{r.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </View>
            <NutrientGrid values={r.nutrition} compact />
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  sub: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
