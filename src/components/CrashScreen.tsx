import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from './Text';
import { onCrash, reportCrash } from '../lib/crashCatcher';

/** Catches errors while drawing the app and reports them (see crashCatcher). Draws nothing itself. */
export class CrashBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportCrash(error, true);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** A plain full-screen message (no theme, no fonts: it must work even when the rest of the app does not). */
export function CrashOverlay() {
  const [message, setMessage] = useState('');
  useEffect(() => onCrash(setMessage), []);
  if (!message) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFE17C', padding: 20, paddingTop: 56, zIndex: 999 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#000' }}>Kabe hit a problem</Text>
      <Text style={{ fontSize: 14, color: '#000', marginVertical: 8 }}>Please take a screenshot of this and send it to the developer.</Text>
      <ScrollView style={{ flex: 1, backgroundColor: '#FFFEFA', borderWidth: 2, borderColor: '#000', borderRadius: 12, padding: 10 }}>
        <Text selectable style={{ fontSize: 12, color: '#000' }}>{message}</Text>
      </ScrollView>
      <Pressable onPress={() => setMessage('')} style={{ marginTop: 12, backgroundColor: '#000', borderRadius: 12, padding: 14, alignItems: 'center' }}>
        <Text style={{ color: '#FFFEFA', fontWeight: '800' }}>Try to continue</Text>
      </Pressable>
    </View>
  );
}
