import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bell, BellRing, X } from 'lucide-react-native';

import { listPlaceWatches, unwatchPlace, watchPlace } from '../../api';
import { success } from '../../haptics';
import { conditionLabel, conditionsFor, watchRemaining, type PlaceWatchInfo, type WatchCondition } from '../../placeWatch';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * "Haber ver" (D-038) on a place page: tell me once when it gets quiet / opens / has news, then stop. Ends on its own
 * after 12 hours. Only the watcher ever sees it; nobody learns who waits for which place.
 */
export function PlaceWatchControl({ auth, place, refresh = {} }: { auth: AuthResponse; place: BlinkrPlace; refresh?: Refresh }) {
  const [watch, setWatch] = useState<PlaceWatchInfo | null | undefined>(undefined);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setWatch(undefined);
    setChoosing(false);
    listPlaceWatches(auth, controller.signal, refresh)
      .then((list) => { if (!controller.signal.aborted) setWatch(list.find((w) => w.placeId === place.id) ?? null); })
      .catch(() => { if (!controller.signal.aborted) setWatch(null); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, place.id]);

  const start = async (condition: WatchCondition) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setWatch(await watchPlace(auth, place.id, { condition, placeName: place.name }, refresh));
      setChoosing(false);
      success();
    } catch (err) {
      setError((err as { status?: number })?.status === 409
        ? tx('map:watch.limit', 'Aynı anda en fazla 5 yeri izleyebilirsin.')
        : tx('map:watch.failed', 'Şu an ayarlanamadı. Tekrar dene.'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy(true);
    const before = watch;
    setWatch(null);
    try { await unwatchPlace(auth, place.id, refresh); } catch { setWatch(before); setError(tx('map:watch.failed', 'Şu an ayarlanamadı. Tekrar dene.')); } finally { setBusy(false); }
  };

  if (watch === undefined) return null;

  if (watch) {
    return (
      <View style={[styles.card, styles.cardOn]} testID="place-watch-on">
        <BellRing color={colors.primary} size={18} />
        <View style={styles.copy}>
          <Text style={styles.title}>{tx('map:watch.on', '{{condition}} haber vereceğiz', { condition: conditionLabel(watch.condition) })}</Text>
          <Text style={styles.sub}>{tx('map:watch.onHint', 'Bir kez bildirir ve kapanır · {{left}}', { left: watchRemaining(watch.expiresAtUtc) })}</Text>
        </View>
        <AnimatedPressable accessibilityLabel={tx('map:watch.stop', 'Haber vermeyi kapat')} accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => { void stop(); }} pressScale={0.9} style={styles.close}>
          {busy ? <ActivityIndicator color={colors.text} size="small" /> : <X color={colors.textSecondary} size={18} />}
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="place-watch">
      <AnimatedPressable accessibilityRole="button" accessibilityState={{ expanded: choosing }} onPress={() => setChoosing((v) => !v)} pressScale={0.98} style={styles.row}>
        <Bell color={colors.text} size={18} />
        <View style={styles.copy}>
          <Text style={styles.title}>{tx('map:watch.title', 'Haber ver')}</Text>
          <Text style={styles.sub}>{tx('map:watch.hint', 'Durum değişince bir kez bildirelim')}</Text>
        </View>
      </AnimatedPressable>
      {choosing ? (
        <View style={styles.chips}>
          {conditionsFor(place.currentState).map((condition) => (
            <AnimatedPressable accessibilityRole="button" disabled={busy} key={condition} onPress={() => { void start(condition); }} pressScale={0.95} style={styles.chip}>
              <Text style={styles.chipText}>{conditionLabel(condition)}</Text>
            </AnimatedPressable>
          ))}
          {busy ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  cardOn: { alignItems: 'center', backgroundColor: colors.primaryTint, flexDirection: 'row', gap: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  copy: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  close: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  chips: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { ...typography.label, color: colors.text },
  error: { ...typography.caption, color: colors.danger },
});
