import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Loading } from '../src/components/Loading';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodPicker } from '../src/components/FoodPicker';
import { NumBox } from '../src/components/NumBox';
import { Button, Card } from '../src/components/ui';
import type { Food } from '../src/data/foods';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { DietFilter, MenuDish, MenuItem, allowedByDiet, dishToItem, dishesFromText, mealBudget, orderName, orderTotals, rankByCalories, toSavedItems } from '../src/lib/menu';
import { r0, r1, sumMacros, toDateKey } from '../src/lib/nutrition';
import { MacroKey, SearchFn, effectiveMacros, resolveOnline, setItemMacro, withGrams } from '../src/lib/photo';
import { estimateDishKcal, readMenu } from '../src/lib/vision';
import { lookupFood } from '../src/lib/mealAi';
import { MealType, MEALS, useKabe } from '../src/store/kabe';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack, goHome } from '../src/lib/nav';
import { ensurePermission, explainPermission } from '../src/lib/permissions';
import { useDiscardPhoto } from '../src/lib/photoCache';

type Stage = 'idle' | 'reading' | 'review';
const DIETS: DietFilter[] = ['any', 'egg', 'veg'];
const tagColors = (c: Colors) => ({ highProtein: c.good, light: c.info, fits: c.inkSoft, heavy: c.danger, noData: c.inkSoft }) as const;

export default function Restaurant() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const k = useKabe();
  const today = toDateKey(new Date());
  const hour = new Date().getHours();
  const [meal, setMeal] = useState<MealType>(hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner');
  const [stage, setStage] = useState<Stage>('idle');
  const [uri, setUri] = useState<string | null>(null);
  useDiscardPhoto(uri); // the cached copy of the picture is removed when it is replaced or the screen closes
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [diet, setDiet] = useState<DietFilter>('any');
  const [byFit, setByFit] = useState(true); // true: lightest first, false: menu order
  const [ranking, setRanking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const runId = useRef(0);
  useEffect(() => () => void runId.current++, []);

  const withDetail = (key: Key, e: unknown) => (e instanceof Error && e.message ? `${t(key)} (${e.message})` : t(key));

  // what is left of today, to rank dishes for a meal that fits
  const eaten = useMemo(() => sumMacros(k.entries.filter((e) => e.date === today)), [k.entries, today]);
  const kcalLeft = k.goals.kcal - eaten.kcal;
  const proteinLeft = k.goals.protein - eaten.protein;
  const budget = mealBudget(Math.max(0, kcalLeft), hour < 11 ? 3 : hour < 16 ? 2 : 1);

  const patch = (id: string, p: Partial<MenuItem>) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

  /** Gemini works out the nutrition of a dish; only for the dishes the person picks (to save the free AI quota). */
  const fullChain = (): SearchFn[] => {
    const soft = (fn: SearchFn): SearchFn => async (q) => {
      try {
        return await fn(q);
      } catch (e) {
        if (e instanceof Error && /limit reached/i.test(e.message)) throw e;
        return [];
      }
    };
    const chain: SearchFn[] = [];
    if (k.geminiKey && k.aiConsent) chain.push(soft(async (q) => { const f = await lookupFood(k.geminiKey, q); return f ? [f] : []; }));
    return chain;
  };

  const lookUp = (it: MenuItem) => {
    patch(it.id, { lookup: 'pending' });
    const my = runId.current;
    resolveOnline([{ ...it, lookup: 'pending' }], fullChain(), (id, p) => patch(id, p as Partial<MenuItem>), () => runId.current !== my).then(({ error: e }) => {
      if (e && runId.current === my) setError(e);
    });
  };

  const startReview = (dishes: MenuDish[], name: string) => {
    const list = dishes.map((d, i) => dishToItem(d, `${Date.now()}-${i}`));
    setItems(list);
    setRestaurant(name);
    setStage('review');
    setEditing(null);
    setChanging(null);
    runId.current++; // any earlier lookups stop; each dish is looked up when you pick it
  };

  /** A typed list: show it at once, then fill in the calories of every dish with ONE call. */
  const startTyped = async (dishes: MenuDish[]) => {
    startReview(dishes, '');
    if (!k.geminiKey || !k.aiConsent || dishes.length === 0) return;
    const my = runId.current;
    setRanking(true);
    try {
      const kc = await estimateDishKcal(k.geminiKey, dishes.map((d) => d.name));
      if (runId.current === my) setItems((l) => l.map((x, i) => ({ ...x, quickKcal: kc[i] ?? x.quickKcal ?? null })));
    } catch (e) {
      if (runId.current === my) setError(withDetail('photo.errAnalyze', e));
    } finally {
      if (runId.current === my) setRanking(false);
    }
  };

  const scan = async (source: 'camera' | 'library') => {
    setError('');
    if (!k.geminiKey) return setError(t('rest.needKey'));
    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      if (source === 'camera') {
        const perm = await ensurePermission(ImagePicker.getCameraPermissionsAsync, ImagePicker.requestCameraPermissionsAsync);
        if (perm !== 'granted') {
          explainPermission(perm, t('perm.camera'), t);
          return setError(t('photo.errCamera'));
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      asset = res.assets?.[0];
    } catch (e) {
      return setError(withDetail('photo.errOpen', e));
    }
    if (!asset?.base64) return setError(t('photo.errRead'));
    setUri(asset.uri);
    setStage('reading');
    try {
      const out = await readMenu(k.geminiKey, asset.base64, asset.mimeType ?? 'image/jpeg');
      startReview(out.dishes, out.restaurant);
    } catch (e) {
      setError(withDetail('photo.errAnalyze', e));
      setStage('idle');
    }
  };

  const togglePick = (it: MenuItem) => {
    const picked = !it.picked;
    patch(it.id, { picked });
    if (picked && !it.food && it.lookup !== 'pending') lookUp(it);
  };

  const view = useMemo(() => {
    if (byFit) return rankByCalories(items, budget, diet);
    return items.filter((i) => allowedByDiet(i.veg, diet)).map((item) => ({ item, kcal: effectiveMacros(item)?.kcal ?? item.quickKcal ?? null, tag: rankByCalories([item], budget, 'any')[0].tag }));
  }, [items, budget, diet, byFit]);

  const tot = orderTotals(items);
  const pending = items.some((i) => i.picked && i.lookup === 'pending');
  const showVegWarn = items.some((i) => i.veg === 'unknown') && diet !== 'any';

  const manualFood = (it: MenuItem, m: { kcal: number; protein: number; carbs: number; fat: number }): Food => ({
    id: `manual-${it.id}`,
    name: it.name,
    category: 'Restaurant',
    kcal: (m.kcal * 100) / it.grams,
    protein: (m.protein * 100) / it.grams,
    carbs: (m.carbs * 100) / it.grams,
    fat: (m.fat * 100) / it.grams,
    servingG: it.grams,
    servingLabel: `${it.grams} g`,
  });

  const addToDiary = () => {
    for (const it of items.filter((i) => i.picked)) {
      const m = effectiveMacros(it);
      if (!m) continue;
      k.addEntry(it.food ?? manualFood(it, m), it.grams, meal, today, { restaurant: true, macros: m });
    }
    goHome();
  };

  const saveOrder = () => {
    const saved = toSavedItems(items);
    if (!saved.length) return Alert.alert(t('rest.none'));
    k.saveOrder(orderName(restaurant, items, t('rest.yourOrder')), restaurant, saved);
    Alert.alert(t('rest.savedTitle'), t('rest.savedBody'));
  };

  const orders = k.savedMeals.filter((m) => m.items.some((i) => i.source === 'restaurant'));
  const mealName = (m: MealType) => t(`meal.${m}` as Key);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('rest.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {stage === 'idle' && (
          <>
            <Card style={{ gap: 10 }}>
              <Text style={styles.body}>{t('rest.intro')}</Text>
              {k.geminiKey && !k.aiConsent ? (
                <>
                  <Text style={styles.h2}>{t('photo.googleTitle')}</Text>
                  <Text style={styles.sub}>{t('photo.consentBody')}</Text>
                  <Button title={t('photo.continue')} onPress={() => k.setAiConsent(true)} />
                </>
              ) : (
                <>
                  <Button title={t('rest.scan')} icon="camera" disabled={!k.geminiKey} onPress={() => scan('camera')} />
                  <Button title={t('rest.gallery')} icon="images" variant="ghost" disabled={!k.geminiKey} onPress={() => scan('library')} />
                  {!k.geminiKey && <Text style={styles.sub}>{t('rest.needKey')}</Text>}
                </>
              )}
              {error ? <Text style={styles.err}>{error}</Text> : null}
            </Card>

            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('rest.typeTitle')}</Text>
              <Text style={styles.sub}>{t('rest.typeHint')}</Text>
              <TextInput value={typed} onChangeText={setTyped} multiline placeholder={t('rest.typePh')} placeholderTextColor={colors.inkSoft} style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} />
              <Button title={t('rest.lookUp')} icon="search" disabled={!dishesFromText(typed).length} onPress={() => { setUri(null); void startTyped(dishesFromText(typed)); }} />
            </Card>

            <Card style={{ gap: 6 }}>
              <Text style={styles.h2}>{t('rest.orders')}</Text>
              {orders.length === 0 && <Text style={styles.sub}>{t('rest.ordersNone')}</Text>}
              {orders.map((o) => (
                <View key={o.id} style={styles.orderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={2}>{o.name}</Text>
                    <Text style={styles.sub}>{r0(o.items.reduce((a, i) => a + i.kcal, 0))} kcal · {tn('rest.dishes', o.items.length)}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      k.addSavedMeal(o.id, meal, today);
                      Alert.alert(t('rest.logged'), t('rest.loggedBody', { name: o.name, meal: mealName(meal) }));
                    }}
                  >
                    <Text style={styles.link}>{t('rest.logOrder')}</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => Alert.alert(t('rest.deleteOrderQ'), o.name, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => k.deleteSavedMeal(o.id) }])}>
                    <Ionicons name="trash-outline" size={18} color={colors.inkSoft} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        )}

        {stage === 'reading' && (
          <Card style={{ alignItems: 'center', gap: 12 }}>
            {uri && <Image source={{ uri }} style={styles.photo} />}
            <Loading />
            <Text style={styles.body}>{t('rest.reading')}</Text>
          </Card>
        )}

        {stage === 'review' && (
          <>
            {uri && <Image source={{ uri }} style={styles.photoSmall} />}
            {items.length === 0 && (
              <Card>
                <Text style={styles.body}>{t('rest.noDishes')}</Text>
              </Card>
            )}
            {items.length > 0 && (
              <>
                <TextInput value={restaurant} onChangeText={setRestaurant} placeholder={t('rest.restaurantName')} placeholderTextColor={colors.inkSoft} style={styles.input} />
                <Text style={styles.sub}>{t('rest.left', { kcal: r0(Math.max(0, kcalLeft)), p: r0(Math.max(0, proteinLeft)), meal: budget })}</Text>
                <View style={styles.chips}>
                  {DIETS.map((d) => (
                    <Pressable key={d} onPress={() => setDiet(d)} style={[styles.chip, diet === d && styles.chipOn]}>
                      <Text style={[styles.chipText, diet === d && { color: colors.onPrimary }]}>{t(`diet.${d}` as Key)}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setByFit(!byFit)} style={[styles.chip, { borderColor: colors.primary }]}>
                    <Text style={[styles.chipText, { color: colors.primary }]}>{byFit ? t('rest.sort.fit') : t('rest.sort.menu')}</Text>
                  </Pressable>
                </View>
                {showVegWarn && <Text style={styles.warn}>{t('rest.vegWarn')}</Text>}
                <Text style={styles.sub}>{t('rest.pickHint')}</Text>
              </>
            )}

            {ranking && <Loading label={t('rest.ranking')} />}
            {view.map(({ item: it, tag, kcal }) => {
              const m = effectiveMacros(it);
              return (
                <Card key={it.id} style={{ gap: 6, ...(it.picked ? { borderWidth: 2, borderColor: colors.primary } : {}) }}>
                  <Pressable style={styles.rowBetween} onPress={() => togglePick(it)}>
                    <Ionicons name={it.picked ? 'checkbox' : 'square-outline'} size={26} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{it.name}</Text>
                      <Text style={[styles.sub, { color: tagColors(colors)[tag], fontWeight: '700' }]}>{t(`rest.tag.${tag}` as Key)}{it.price ? `  ·  ${t('rest.price', { n: it.price })}` : ''}</Text>
                    </View>
                    {kcal !== null ? <Text style={styles.kcal}>{r0(kcal)} kcal</Text> : it.lookup === 'pending' ? <Loading /> : null}
                  </Pressable>
                  {m && <Text style={styles.sub}>{t('photo.macroLine', { p: r1(m.protein), c: r1(m.carbs), f: r1(m.fat), g: it.grams })}</Text>}
                  {!m && it.picked && it.lookup !== 'pending' && (
                    <Pressable onPress={() => lookUp(it)}>
                      <Text style={styles.link}>{t('rest.getNutrition')}</Text>
                    </Pressable>
                  )}
                  {it.lookup === 'pending' && <Text style={styles.sub}>{t('rest.searching')}</Text>}
                  {it.picked && (
                    <>
                      <View style={styles.rowBetween}>
                        <Pressable style={styles.step} onPress={() => patch(it.id, withGrams(it, it.grams - 25))}><Text style={styles.stepText}>−</Text></Pressable>
                        <TextInput value={String(it.grams)} onChangeText={(v) => patch(it.id, withGrams(it, parseFloat(v) || 0))} keyboardType="number-pad" selectTextOnFocus style={styles.grams} />
                        <Text style={styles.sub}>g</Text>
                        <Pressable style={styles.step} onPress={() => patch(it.id, withGrams(it, it.grams + 25))}><Text style={styles.stepText}>+</Text></Pressable>
                        <Text style={[styles.chipSmall]}>{t('photo.confidence', { c: t(`coach.conf.${it.confidence}` as Key) })}</Text>
                      </View>
                      {editing === it.id && (
                        <View style={{ gap: 4 }}>
                          <Text style={styles.sub}>{t('photo.editPrompt', { g: it.grams })}</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <NumBox live label="kcal" value={m?.kcal ?? 0} onCommit={(v) => patch(it.id, setItemMacro(it, 'kcal' as MacroKey, v))} />
                            <NumBox live label={t('edit.proteinG')} value={m?.protein ?? 0} onCommit={(v) => patch(it.id, setItemMacro(it, 'protein', v))} />
                            <NumBox live label={t('edit.carbsG')} value={m?.carbs ?? 0} onCommit={(v) => patch(it.id, setItemMacro(it, 'carbs', v))} />
                            <NumBox live label={t('edit.fatG')} value={m?.fat ?? 0} onCommit={(v) => patch(it.id, setItemMacro(it, 'fat', v))} />
                          </View>
                          {it.manual && (
                            <Pressable onPress={() => patch(it.id, { manual: undefined })}>
                              <Text style={styles.link}>{t('photo.reset')}</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                        <Pressable onPress={() => setEditing(editing === it.id ? null : it.id)}>
                          <Text style={styles.link}>{editing === it.id ? t('photo.doneEditing') : t('photo.editNutrition')}</Text>
                        </Pressable>
                        <Pressable onPress={() => setChanging(changing === it.id ? null : it.id)}>
                          <Text style={styles.link}>{it.food ? t('photo.changeFood') : t('photo.chooseFood')}</Text>
                        </Pressable>
                      </View>
                      {changing === it.id && (
                        <FoodPicker
                          initialQuery={it.searchTerm}
                          onPick={(f: Food) => {
                            patch(it.id, { food: f, manual: undefined, lookup: undefined });
                            setChanging(null);
                          }}
                        />
                      )}
                    </>
                  )}
                </Card>
              );
            })}

            {tot.dishes > 0 && (
              <Card style={{ gap: 6 }}>
                <Text style={styles.h2}>{t('rest.yourOrder')}</Text>
                <Text style={styles.big}>{r0(tot.kcalLow)}–{r0(tot.kcalHigh)} kcal</Text>
                <Text style={styles.sub}>{t('rest.orderMacros', { p: r0(tot.protein), c: r0(tot.carbs), f: r0(tot.fat) })}</Text>
                {tot.price > 0 && <Text style={styles.sub}>{t('rest.orderPrice', { n: tot.price, extra: tot.unpriced ? t('rest.unpriced', { n: tot.unpriced }) : '' })}</Text>}
                {tot.missing > 0 && !pending && <Text style={styles.err}>{tn('rest.missing', tot.missing)}</Text>}
                <View style={styles.chips}>
                  {MEALS.map((m) => (
                    <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.chip, meal === m.key && styles.chipOn]}>
                      <Text style={[styles.chipText, meal === m.key && { color: colors.onPrimary }]}>{mealName(m.key)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Button title={pending ? t('photo.lookingBtn') : tn('rest.addN', tot.dishes - tot.missing)} icon="checkmark" disabled={pending || tot.dishes - tot.missing === 0} onPress={addToDiary} />
                <Button title={t('rest.saveOrder')} icon="bookmark-outline" variant="ghost" disabled={pending || tot.dishes - tot.missing === 0} onPress={saveOrder} />
              </Card>
            )}
            <Button
              title={t('rest.startOver')}
              variant="ghost"
              onPress={() => {
                runId.current++;
                setStage('idle');
                setItems([]);
                setUri(null);
                setError('');
              }}
            />
            {error ? <Text style={styles.err}>{error}</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  big: { fontSize: 26, fontWeight: '800', color: colors.primaryDark },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  note: { fontSize: 11, color: colors.inkSoft, lineHeight: 16 },
  warn: { fontSize: 12, color: colors.warn, fontWeight: '700' },
  err: { fontSize: 13, color: colors.danger },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  kcal: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  photo: { width: '100%', height: 220, borderRadius: radius.md },
  photoSmall: { width: '100%', height: 120, borderRadius: radius.md },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipSmall: { fontSize: 11, color: colors.inkSoft, flexShrink: 1 },
  step: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  grams: { width: 64, textAlign: 'center', fontSize: 18, fontWeight: '700', borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, color: colors.ink, backgroundColor: colors.card },
});
