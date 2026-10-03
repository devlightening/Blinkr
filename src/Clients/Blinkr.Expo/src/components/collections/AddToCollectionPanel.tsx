import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, FolderPlus, Plus } from 'lucide-react-native';

import { createCollection, listCollections, putCollectionItem, removeCollectionItem } from '../../api';
import { COLLECTION_LIMITS, containing, itemCountLabel, validTitle, type CollectionSummary } from '../../collections';
import { success } from '../../haptics';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * D-041: put this place into my collections. Content only - the place sheet swaps it in (one overlay owner). A tick shows
 * the lists that already hold the place; a tap adds or removes it; a new list can be made right here and gets the place.
 */
export function AddToCollectionPanel({ auth, place, refresh = {} }: { auth: AuthResponse; place: BlinkrPlace; refresh?: Refresh }) {
  const [lists, setLists] = useState<CollectionSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCollections(auth, controller.signal, refresh)
      .then((value) => { if (!controller.signal.aborted) setLists(value); })
      .catch(() => { if (!controller.signal.aborted) { setLists([]); setError(tx('profile:collections.loadFailed', 'Koleksiyonlar yüklenemedi.')); } });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  const holding = useMemo(() => containing(lists ?? [], place.id), [lists, place.id]);

  /** Keeps the summary in step with what the server answered for one list. */
  const patch = (id: string, placeIds: string[], itemCount: number) =>
    setLists((current) => (current ?? []).map((list) => (list.id === id ? { ...list, placeIds, itemCount } : list)));

  const toggle = async (list: CollectionSummary) => {
    if (busy) return;
    setBusy(list.id);
    setError(null);
    try {
      const next = holding.has(list.id)
        ? await removeCollectionItem(auth, list.id, place.id, refresh)
        : await putCollectionItem(auth, list.id, place, null, refresh);
      patch(list.id, next.items.map((item) => item.placeId), next.items.length);
      success();
    } catch (err) {
      setError((err as { status?: number })?.status === 429
        ? tx('profile:collections.itemsLimit', 'Bir koleksiyonda en fazla 50 yer olabilir.')
        : tx('profile:collections.failed', 'Kaydedilemedi. Tekrar dene.'));
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (busy || !validTitle(newTitle)) return;
    setBusy('new');
    setError(null);
    try {
      const made = await createCollection(auth, { title: newTitle }, refresh);
      const filled = await putCollectionItem(auth, made.id, place, null, refresh);
      setLists((current) => [{ id: filled.id, title: filled.title, description: filled.description, visibility: filled.visibility, shareToken: filled.shareToken, itemCount: filled.items.length, preview: filled.items.slice(0, 3), updatedAtUtc: filled.updatedAtUtc, placeIds: filled.items.map((item) => item.placeId) }, ...(current ?? [])]);
      setNewTitle('');
      success();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 429 ? tx('profile:collections.limit', 'En fazla 20 koleksiyon oluşturabilirsin.')
        : status === 422 ? tx('profile:collections.blocked', 'Bu metin topluluk kurallarına uymuyor.')
          : tx('profile:collections.failed', 'Kaydedilemedi. Tekrar dene.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>{tx('profile:collections.addTitle', 'Koleksiyona ekle')}</Text>
      <Text numberOfLines={1} style={styles.place}>{place.name}</Text>
      {lists === null ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {lists.map((list) => {
            const inside = holding.has(list.id);
            return (
              <AnimatedPressable accessibilityRole="button" accessibilityState={{ checked: inside }} disabled={busy !== null} key={list.id} onPress={() => { void toggle(list); }} pressScale={0.98} style={styles.row}>
                <View style={[styles.check, inside && styles.checkOn]}>
                  {busy === list.id ? <ActivityIndicator color={colors.ink} size="small" /> : inside ? <Check color={colors.ink} size={14} strokeWidth={2.6} /> : null}
                </View>
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{list.title}</Text>
                  <Text style={styles.sub}>{itemCountLabel(list.itemCount)}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
          {lists.length === 0 ? <Text style={styles.sub}>{tx('profile:collections.none', 'Henüz koleksiyonun yok. İlkini şimdi oluştur.')}</Text> : null}
        </ScrollView>
      )}
      {(lists?.length ?? 0) < COLLECTION_LIMITS.perUser ? (
        <View style={styles.newRow}>
          <FolderPlus color={colors.textSecondary} size={18} />
          <TextInput
            accessibilityLabel={tx('profile:collections.newPlaceholder', 'Yeni koleksiyon adı')}
            maxLength={COLLECTION_LIMITS.title}
            onChangeText={setNewTitle}
            onSubmitEditing={() => { void create(); }}
            placeholder={tx('profile:collections.newPlaceholder', 'Yeni koleksiyon adı')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            style={styles.input}
            value={newTitle}
          />
          <AnimatedPressable accessibilityLabel={tx('profile:collections.create', 'Oluştur ve ekle')} accessibilityRole="button" disabled={!validTitle(newTitle) || busy !== null} onPress={() => { void create(); }} pressScale={0.92} style={[styles.add, (!validTitle(newTitle) || busy !== null) && styles.disabled]}>
            {busy === 'new' ? <ActivityIndicator color={colors.ink} size="small" /> : <Plus color={colors.ink} size={18} />}
          </AnimatedPressable>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexShrink: 1, gap: spacing.sm, paddingBottom: spacing.md },
  title: { ...typography.title, color: colors.text },
  place: { ...typography.caption, color: colors.textSecondary },
  loading: { marginVertical: spacing.lg },
  list: { flexShrink: 1, maxHeight: 360 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52 },
  check: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1.5, height: 26, justifyContent: 'center', width: 26 },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  copy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  newRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: 4 },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 44 },
  add: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  disabled: { opacity: 0.4 },
  error: { ...typography.caption, color: colors.danger },
});
