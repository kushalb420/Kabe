import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type Svg from 'react-native-svg';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { nowMs } from '../src/lib/clock';
import { EMPTY_TRACK, Fix, Track, TrackKind, addFix, formatClock, formatPaceMin, routeOf, summarize } from '../src/lib/gps';
import { RouteCard } from '../src/components/RouteCard';
import { RouteStory } from '../src/components/RouteStory';
import { shareStory } from '../src/lib/routeStory';
import { foldSession } from '../src/lib/gpsSession';
import { clearSession, isBackgroundRunning, loadSession, startBackground, stopBackground } from '../src/lib/gpsTask';
import { toDateKey } from '../src/lib/nutrition';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';
import { ensurePermission, explainPermission, webLocationRequest } from '../src/lib/permissions';

type Phase = 'ready' | 'tracking' | 'done';
const KINDS: TrackKind[] = ['walk', 'run', 'cycle'];

export default function TrackScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const tk = useTracker();
  const [kind, setKind] = useState<TrackKind>('walk');
  const [phase, setPhase] = useState<Phase>('ready');
  const [track, setTrack] = useState<Track>(EMPTY_TRACK);
  const [tick, setTick] = useState(0); // the clock, advanced once a second while tracking
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [error, setError] = useState('');
  const [bg, setBg] = useState(false); // true while the background task is recording
  const sub = useRef<Location.LocationSubscription | null>(null);
  const kindRef = useRef(kind);
  const fixesRef = useRef<Fix[]>([]); // every raw fix of this route, for drawing it
  const [route, setRoute] = useState<Fix[]>([]);
  const storyRef = useRef<Svg>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await isBackgroundRunning())) return;
      const s = await loadSession();
      if (!alive || !s) return;
      setKind(s.kind);
      setStartMs(s.startedAt);
      setTrack(foldSession(s));
      setRoute(routeOf(s.fixes, s.kind));
      setTick(nowMs());
      setBg(true);
      setPhase('tracking');
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'tracking') return;
    let n = 0;
    const id = setInterval(async () => {
      setTick(nowMs());
      n++;
      if (bg) {
        const s = await loadSession();
        if (s) {
          setTrack(foldSession(s));
          if (n % 5 === 0) setRoute(routeOf(s.fixes, s.kind));
        }
      } else if (n % 5 === 0) setRoute(routeOf(fixesRef.current, kindRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, bg]);

  useEffect(
    () => () => {
      sub.current?.remove();
    },
    [],
  );

  const start = async () => {
    setError('');
    try {
      const perm =
        Platform.OS === 'web'
          ? await ensurePermission(async () => ({ granted: false, canAskAgain: true }), webLocationRequest) // the browser asks
          : await ensurePermission(Location.getForegroundPermissionsAsync, Location.requestForegroundPermissionsAsync);
      if (perm !== 'granted') {
        explainPermission(perm, t('perm.location'), t);
        return setError(t('track.noPermission'));
      }
      setTrack(EMPTY_TRACK);
      setRoute([]);
      fixesRef.current = [];
      const now = nowMs();
      setStartMs(now);
      setTick(now);
      setPhase('tracking');
      if (await startBackground(kindRef.current, now, t('track.notifTitle'), t('track.notifBody'))) {
        setBg(true);
        return;
      }
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
        (loc) => {
          const fix = { lat: loc.coords.latitude, lon: loc.coords.longitude, t: loc.timestamp, acc: loc.coords.accuracy };
          fixesRef.current.push(fix);
          if (fixesRef.current.length > 20000) fixesRef.current.shift();
          setTrack((tr) => addFix(tr, fix, kindRef.current));
        },
      );
    } catch {
      setPhase('ready');
      setError(t('track.noPermission'));
    }
  };

  const stop = async () => {
    sub.current?.remove();
    sub.current = null;
    if (bg) {
      await stopBackground();
      const s = await loadSession();
      if (s) {
        setTrack(foldSession(s));
        setRoute(routeOf(s.fixes, s.kind));
      }
      await clearSession();
      setBg(false);
    } else setRoute(routeOf(fixesRef.current, kindRef.current));
    setEndMs(nowMs());
    setPhase('done');
  };

  const done = phase === 'done';
  const sum = summarize(track, startMs, done ? endMs : tick || startMs);
  const elapsed = (done ? endMs : tick || startMs) - startMs;

  const save = () => {
    tk.addActivity({ date: toDateKey(new Date()), type: kind, minutes: sum.minutes, ...(sum.km > 0 ? { km: sum.km } : {}) });
    goBack();
  };

  const paceText = kind === 'cycle' ? (sum.avgKmh === null ? '–' : t('track.speedVal', { v: sum.avgKmh })) : sum.paceMinPerKm === null ? '–' : t('track.paceVal', { p: formatPaceMin(sum.paceMinPerKm) });
  const share = async () => {
    if (!storyRef.current || sharing) return;
    setSharing(true);
    setShareNote('');
    const text = t('route.shareMsg', { kind: t(`act.type.${kind}` as Key), km: sum.km.toFixed(2), time: formatClock(elapsed), pace: paceText });
    const r = await shareStory(storyRef.current as never, text);
    setSharing(false);
    if (r === 'downloaded') setShareNote(t('route.saved'));
    else if (r === 'failed') setShareNote(t('route.failed'));
  };
  const poster = (
    <RouteCard
      route={route}
      kindLabel={t(`act.type.${kind}` as Key)}
      distance={t('track.km', { km: sum.km.toFixed(2) })}
      pace={paceText}
      paceLabel={kind === 'cycle' ? t('track.speed') : t('track.pace')}
      time={formatClock(elapsed)}
    />
  );

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('track.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        {phase === 'ready' && (
          <>
            <Text style={styles.sub}>{t('track.intro')}</Text>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Pressable key={k} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipOn]}>
                  <Text style={[styles.chipText, kind === k && { color: colors.onPrimary }]}>{t(`act.type.${k}` as Key)}</Text>
                </Pressable>
              ))}
            </View>
            <Button title={t('track.start')} icon="play" onPress={start} />
            {error ? <Text style={styles.err}>{error}</Text> : null}
          </>
        )}

        {done && (
          <>
            <View style={{ alignItems: 'center' }}>
              <RouteStory
                ref={storyRef}
                width={250}
                route={route}
                kind={t(`act.type.${kind}` as Key).toUpperCase()}
                date={new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                km={sum.km.toFixed(2)}
                distanceLabel={`${t('track.distance').toUpperCase()} · KM`}
                paceLabel={kind === 'cycle' ? t('track.speed') : t('track.pace')}
                pace={paceText}
                timeLabel={t('route.time')}
                time={formatClock(elapsed)}
                footer={t('route.footer')}
              />
            </View>
            <Text style={styles.sub}>{t('route.posterNote')}</Text>
            <Button title={t('route.share')} icon="share-social" disabled={sharing} onPress={() => void share()} />
            {shareNote ? <Text style={styles.sub}>{shareNote}</Text> : null}
          </>
        )}

        {phase === 'tracking' && route.length > 1 && poster}

        {phase === 'tracking' && (
          <Card style={{ gap: 14 }}>
            <Text style={styles.kind}>{t(`act.type.${kind}` as Key)}</Text>
            <Text style={styles.clock}>{formatClock(elapsed)}</Text>
            <View style={{ flexDirection: 'row' }}>
              {stat(t('track.distance'), t('track.km', { km: sum.km.toFixed(2) }))}
              {kind === 'cycle'
                ? stat(t('track.speed'), sum.avgKmh === null ? '–' : t('track.speedVal', { v: sum.avgKmh }))
                : stat(t('track.pace'), sum.paceMinPerKm === null ? '–' : t('track.paceVal', { p: formatPaceMin(sum.paceMinPerKm) }))}
            </View>
            {phase === 'tracking' && <Text style={styles.sub}>{bg ? t('track.bgOn') : t('track.keepOpen')}</Text>}
          </Card>
        )}

        {phase === 'tracking' && <Button title={t('track.stop')} icon="stop" onPress={stop} />}
        {done && (
          <>
            <Button title={t('track.save')} icon="checkmark" onPress={save} />
            <Button title={t('track.discard')} variant="ghost" onPress={() => setPhase('ready')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  err: { fontSize: 13, color: colors.danger },
  kind: { fontSize: 14, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  clock: { fontSize: 54, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
