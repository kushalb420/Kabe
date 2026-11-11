import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { BUILTIN_BACKEND, setTokenProvider } from '../lib/backend';
import { CloudConfig, validateConfig } from '../lib/cloudConfig';
import { SyncMeta, buildSnapshot, hashSnapshot, runSync } from '../lib/sync';
import { accessToken, cloudApi, currentUser, deleteAccount as sbDeleteAccount, makeClient, signIn as sbSignIn, signUp as sbSignUp, startGuest, upgradeGuest } from '../lib/supabaseApi';
import { useKabe } from './kabe';
import { useKitchen } from './kitchen';
import { useTracker } from './tracker';
import { signInWithGoogle as googleSignIn } from '../lib/googleAuth';

type Status = 'off' | 'signedout' | 'idle' | 'syncing' | 'conflict' | 'error';
type Saved = { config: CloudConfig | null; meta: Record<string, SyncMeta> };

const KEY = 'kabe:cloud:v1'; // Supabase URL/key + per-account sync bookkeeping. Device-only, never synced.
const EMPTY_META: SyncMeta = { lastHash: null, lastCloudUpdatedAt: null };

type Ctx = {
  config: CloudConfig | null;
  /** true when this build ships with its own backend (no URL/key to enter) */
  builtin: boolean;
  client: SupabaseClient | null;
  user: { id: string; email: string } | null;
  status: Status;
  error: string;
  lastSyncedAt: Date | null;
  saveConfig: (c: CloudConfig) => string | null;
  clearConfig: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Sign in or sign up with Google. false = the window was closed (or the web page left for Google). */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: (resolve?: 'cloud' | 'local') => Promise<void>;
  deleteCloudData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const CloudContext = createContext<Ctx | null>(null);

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const kabe = useKabe();
  const tracker = useTracker();
  const kitchen = useKitchen();
  const [saved, setSaved] = useState<Saved>({ config: null, meta: {} });
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<Ctx['user']>(null);
  const [status, setStatus] = useState<Status>('off');
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const syncing = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSaved({ config: null, meta: {}, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved, loaded]);

  const config = BUILTIN_BACKEND ?? saved.config;
  const client: SupabaseClient | null = useMemo(() => (config && !validateConfig(config) ? makeClient(config) : null), [config]);

  // AI requests carry this session; with a built-in backend a guest session is started on first use
  useEffect(() => {
    if (!client) return;
    setTokenProvider(() => accessToken(client, !!BUILTIN_BACKEND));
    return () => setTokenProvider(async () => null);
  }, [client]);

  // what is synced = explicit allow-lists of both stores
  const snapshot = useMemo(() => buildSnapshot(kabe as any, tracker as any, kitchen as any), [kabe, tracker, kitchen]);
  const hash = useMemo(() => hashSnapshot(snapshot), [snapshot]);
  // the newest data for sync callbacks (they run later from timers and events, never while drawing)
  const latest = useRef({ snapshot, user, saved });
  useEffect(() => {
    latest.current = { snapshot, user, saved };
  });
  const ready = kabe.ready && tracker.ready && kitchen.ready;

  // restore the signed-in user when the app starts / the connection settings change
  useEffect(() => {
    let cancelled = false;
    // state is set from the promise callbacks (not directly in the effect body) so a settings change never causes a render loop
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setUser(null);
        if (!client) {
          setStatus(config ? 'error' : 'off');
          return null;
        }
        return currentUser(client).then((u) => u ?? (BUILTIN_BACKEND ? startGuest(client) : null));
      })
      .then((u) => {
        if (cancelled || !client) return;
        setUser(u);
        setStatus(u ? 'idle' : 'signedout');
      })
      .catch(() => !cancelled && setStatus('signedout'));
    return () => {
      cancelled = true;
    };
  }, [client, config]);

  // keep the auth token fresh only while the app is open (Supabase's recommended pattern for React Native)
  useEffect(() => {
    if (!client) return;
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()));
    client.auth.startAutoRefresh();
    return () => {
      sub.remove();
      client.auth.stopAutoRefresh();
    };
  }, [client]);

  const syncNow = useCallback(
    async (resolve?: 'cloud' | 'local') => {
      const { snapshot: snap, user: u, saved: s } = latest.current;
      if (!client || !u?.email || syncing.current || !ready) return; // guests are never backed up
      syncing.current = true;
      setStatus('syncing');
      setError('');
      try {
        const meta = s.meta[u.id] ?? EMPTY_META;
        const result = await runSync(cloudApi(client, u.id), snap, meta, resolve);
        if (result.outcome === 'conflict') {
          setStatus('conflict');
          return;
        }
        if (result.outcome === 'downloaded') {
          kabe.importSnapshot(result.snapshot.kabe);
          tracker.importSnapshot(result.snapshot.tracker);
          if (result.snapshot.kitchen) kitchen.importSnapshot(result.snapshot.kitchen); // older cloud copies have none: keep local pantry/plan
        }
        setSaved((p) => ({ ...p, meta: { ...p.meta, [u.id]: result.meta } }));
        setLastSyncedAt(new Date());
        setStatus('idle');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sync failed.');
        setStatus('error');
      } finally {
        syncing.current = false;
      }
    },
    [client, ready, kabe.importSnapshot, tracker.importSnapshot, kitchen.importSnapshot], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // sync: after sign-in / on start, when the app comes to the foreground, and a few seconds after you change something
  const canAuto = !!client && !!user?.email && ready && status !== 'conflict' && status !== 'syncing';
  const first = useRef<string | null>(null);
  const attempted = useRef<string | null>(null); // "account:data-hash" we already scheduled a sync for → no repeat loops
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!canAuto) return;
    const id = `${user?.id}:${hash}`;
    if (attempted.current === id) return; // nothing changed since the last attempt (success or not)
    attempted.current = id;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncNow(), first.current === null ? 300 : 4000); // first pass right away, later edits debounced
    first.current = hash;
  }, [canAuto, hash, user?.id, syncNow]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    return () => sub.remove();
  }, [syncNow]);

  // changes made on another device arrive while this one is open: once a minute, a tiny request asks whether the backup changed
  useEffect(() => {
    if (!canAuto || !client || !user) return;
    const api = cloudApi(client, user.id);
    const id = setInterval(async () => {
      if (AppState.currentState !== 'active' || syncing.current) return;
      try {
        const stamp = await api.fetchStamp?.();
        const known = (latest.current.saved.meta[user.id] ?? EMPTY_META).lastCloudUpdatedAt;
        if (stamp && stamp !== known) void syncNow();
      } catch {
        /* offline: the next check tries again */
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [canAuto, client, user, syncNow]);

  const saveConfig = useCallback((c: CloudConfig) => {
    const problem = validateConfig(c);
    if (problem) return problem;
    setSaved((p) => ({ ...p, config: { url: c.url.trim(), key: c.key.trim() } }));
    return null;
  }, []);

  const clearConfig = useCallback(async () => {
    try {
      await client?.auth.signOut();
    } catch {
      /* ignore */
    }
    first.current = null;
    attempted.current = null;
    setSaved({ config: null, meta: {} });
    setUser(null);
    setStatus('off');
  }, [client]);

  const signUp: Ctx['signUp'] = async (email, password) => {
    if (!client) throw new Error('Add your Supabase details first.');
    const guest = (await currentUser(client)) && !(await currentUser(client))?.email;
    const r = guest ? await upgradeGuest(client, email, password) : await sbSignUp(client, email, password);
    if (!r.needsConfirm) {
      setUser(await currentUser(client));
      setStatus('idle');
    }
    return r;
  };
  const signIn: Ctx['signIn'] = async (email, password) => {
    if (!client) throw new Error('Add your Supabase details first.');
    await sbSignIn(client, email, password);
    first.current = null;
    attempted.current = null;
    setUser(await currentUser(client));
    setStatus('idle');
  };
  const signInWithGoogle: Ctx['signInWithGoogle'] = async () => {
    if (!client) throw new Error('Add your Supabase details first.');
    if (!(await googleSignIn(client))) return false;
    first.current = null;
    attempted.current = null;
    setUser(await currentUser(client));
    setStatus('idle');
    return true;
  };
  const signOut = useCallback(async () => {
    await client?.auth.signOut();
    first.current = null;
    attempted.current = null;
    setUser(BUILTIN_BACKEND && client ? await startGuest(client) : null); // back to a guest, so AI and friends keep working
    setStatus('signedout');
  }, [client]);

  const deleteCloudData = useCallback(async () => {
    if (!client || !user) return;
    await cloudApi(client, user.id).deleteRow();
    setSaved((p) => ({ ...p, meta: { ...p.meta, [user.id]: EMPTY_META } }));
    setLastSyncedAt(null);
  }, [client, user]);

  /** Erases the cloud copy AND the account itself; the data on this phone stays. */
  const deleteAccount = useCallback(async () => {
    if (!client || !user) return;
    await sbDeleteAccount(client);
    const id = user.id;
    setSaved((p) => {
      const meta = { ...p.meta };
      delete meta[id];
      return { ...p, meta };
    });
    setLastSyncedAt(null);
    await client.auth.signOut().catch(() => {});
    first.current = null;
    attempted.current = null;
    setUser(BUILTIN_BACKEND ? await startGuest(client) : null);
    setStatus('signedout');
  }, [client, user]);

  const value = useMemo<Ctx>(
    () => ({ config, builtin: !!BUILTIN_BACKEND, client, user, status, error, lastSyncedAt, saveConfig, clearConfig, signUp, signIn, signInWithGoogle, signOut, syncNow, deleteCloudData, deleteAccount }),
    [config, client, user, status, error, lastSyncedAt, saveConfig, clearConfig, signOut, syncNow, deleteCloudData, deleteAccount], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud() {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error('useCloud must be used inside CloudProvider');
  return ctx;
}
