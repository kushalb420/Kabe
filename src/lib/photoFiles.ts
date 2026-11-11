// Copies a progress photo into the app's private storage on the phone, and removes it again. Never uploads anything.
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { photoFileName } from './progressPhotos';

/** Saves a private copy and returns its address. (A web preview just keeps the temporary address.) */
export async function savePhotoCopy(sourceUri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  const dest = new File(Paths.document, photoFileName(id));
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

export function deletePhotoFiles(uris: string[]): void {
  if (Platform.OS === 'web') return;
  for (const uri of uris) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      /* already gone */
    }
  }
}
