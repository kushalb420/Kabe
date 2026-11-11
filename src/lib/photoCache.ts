// Pictures taken or picked to be analysed are only needed while they are being read and shown. The phone keeps a copy in the
// app's cache for each one; this removes it once the screen no longer needs it, so scanning never piles up files.
import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function discardPhoto(uri?: string | null): void {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* the phone cleans its cache itself sooner or later */
  }
}

/** Deletes each picture's cached copy when it is replaced and when the screen closes. */
export function useDiscardPhoto(uri: string | null): void {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = uri;
    if (prev && prev !== uri) discardPhoto(prev);
  }, [uri]);
  useEffect(() => () => discardPhoto(last.current), []);
}
