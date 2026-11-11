// Thin Supabase wrapper: email+password accounts and the one-row-per-user sync table (see SUPABASE_SQL in sync.ts).
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { CloudConfig, friendlyCloudError as friendly, normalizeUrl } from './cloudConfig';
import { deleteAccountRemote } from './accountApi';
import type { CloudApi, CloudRow, Snapshot } from './sync';
import { Platform } from 'react-native';

export function makeClient(c: CloudConfig): SupabaseClient {
  return createClient(normalizeUrl(c.url), c.key.trim(), {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' } // on the web the page returns from Google with the session in its address,
  });
}

export async function signUp(sb: SupabaseClient, email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
  return { needsConfirm: !data.session };
}

export async function signIn(sb: SupabaseClient, email: string, password: string): Promise<void> {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
}

/** A guest (anonymous) session has no email: it can use AI and friends, but nothing is backed up until an account is made. */
export async function currentUser(sb: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

/** Starts a guest session (needs "Allow anonymous sign-ins" in Supabase → Authentication). Null if the project does not allow it. */
export async function startGuest(sb: SupabaseClient): Promise<{ id: string; email: string } | null> {
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) return null;
  return { id: data.user.id, email: '' };
}

/** The access token for the current session, starting a guest session first if there is none. */
export async function accessToken(sb: SupabaseClient, allowGuest: boolean): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.access_token;
  if (!allowGuest) return null;
  const r = await sb.auth.signInAnonymously();
  return r.data.session?.access_token ?? null;
}

/** Turns the current guest into a real account, keeping the same user (and so the same friends). */
export async function upgradeGuest(sb: SupabaseClient, email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await sb.auth.updateUser({ email: email.trim(), password });
  if (error) throw new Error(friendly(error));
  return { needsConfirm: !!data.user?.new_email };
}

export function cloudApi(sb: SupabaseClient, userId: string): CloudApi {
  return {
    async fetchRow(): Promise<CloudRow | null> {
      const { data, error } = await sb.from('kabe_sync').select('data, updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(friendly(error));
      return data ? { data: data.data as Snapshot, updated_at: data.updated_at as string } : null;
    },
    async fetchStamp(): Promise<string | null> {
      const { data, error } = await sb.from('kabe_sync').select('updated_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(friendly(error));
      return data ? (data.updated_at as string) : null;
    },
    async upsertRow(snapshot: Snapshot): Promise<string> {
      const { data, error } = await sb.from('kabe_sync').upsert({ user_id: userId, data: snapshot }, { onConflict: 'user_id' }).select('updated_at').single();
      if (error) throw new Error(friendly(error));
      return data.updated_at as string;
    },
    async deleteRow(): Promise<void> {
      const { error } = await sb.from('kabe_sync').delete().eq('user_id', userId);
      if (error) throw new Error(friendly(error));
    },
  };
}

/** Deletes the signed-in account in the person's own Supabase project (needs the updated setup SQL). */
export const deleteAccount = (sb: SupabaseClient): Promise<void> => deleteAccountRemote(sb);
