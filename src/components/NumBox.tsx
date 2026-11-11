import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { radius, useThemedStyles, type Colors } from '../theme';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/**
 * Small labelled number field. `live` commits on every keystroke; otherwise it commits when you leave the field or press
 * done. `onDraft` reports what is typed so a parent can still apply it if the user taps Save without leaving the field.
 */
export function NumBox({
  label,
  value,
  onCommit,
  onDraft,
  live = false,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  onDraft?: (n: number | null) => void;
  live?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  // while you are typing the box shows what you typed; otherwise it always shows the current value
  const [typedText, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const text = focused ? typedText : fmt(value);

  const parse = (t: string) => {
    const n = parseFloat(t.replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : null;
  };
  const commit = (t: string) => {
    const n = parse(t);
    if (n !== null) onCommit(n);
    onDraft?.(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={text}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={styles.input}
        onFocus={() => {
          setText(fmt(value));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          if (!live) commit(text);
        }}
        onChangeText={(t) => {
          setText(t);
          if (live) {
            const n = parse(t);
            if (n !== null) onCommit(n);
          } else onDraft?.(parse(t));
        }}
        onSubmitEditing={() => !live && commit(text)}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { flex: 1, gap: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  input: { backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.ink, borderWidth: 2, borderColor: colors.line },
});
