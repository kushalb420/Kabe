import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { useCloud } from '../store/cloud';
import { useKabe } from '../store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Sticker } from './Sticker';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

/**
 * Asks once, "What should we call you?". Skipped when the person already has a nickname (typed on the first screen, or
 * restored from their account backup), and it waits while a signed-in account's backup is still being fetched.
 */
export function NicknamePrompt() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const k = useKabe();
  const cloud = useCloud();
  const [name, setName] = useState('');
  const restoring = !!cloud.user?.email && (cloud.status === 'syncing' || !cloud.lastSyncedAt);
  if (!k.ready || !k.welcomed || k.userName || k.nameAsked || restoring) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.dim]}>
      <Card style={{ gap: 12, width: '100%', maxWidth: 420 }}>
        <View style={{ alignItems: 'center' }}>
          <Sticker name="mascot" size={96} tilt={-4} bob />
        </View>
        <Text style={styles.title}>{t('welcome.nameLabel')}</Text>
        <Text style={styles.sub}>{t('name.why')}</Text>
        <TextInput value={name} onChangeText={setName} placeholder={t('welcome.namePh')} placeholderTextColor={colors.inkSoft} maxLength={30} autoFocus onSubmitEditing={() => name.trim() && k.setUserName(name)} style={styles.input} />
        <Button title={t('common.save')} icon="checkmark" disabled={!name.trim()} onPress={() => k.setUserName(name)} />
        <Button title={t('name.later')} variant="ghost" onPress={k.skipNameAsk} />
      </Card>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 60 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
});
