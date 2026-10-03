import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, FolderPlus, Layers, Link2, Plus } from 'lucide-react-native';

import { createCollection, listCollections } from '../../api';
import { COLLECTION_LIMITS, itemCountLabel, validTitle, type CollectionSummary } from '../../collections';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/**
 * D-041 on my profile's "Yerler" tab: my collections (title, how many places, shared or not) above the saved places,
 * and a quick "new collection". A row opens the collection; `reloadKey` changes when one was edited there.
 */
export function CollectionsSection({ auth, refresh = {}, reloadKey = 0, onOpen }: { auth: AuthResponse; refresh?: Refresh; reloadKey?: number; onOpen: (id: string) => void }) {
  const [lists, setLists] = useState<CollectionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    listCollections(auth, signal, refresh)
      .then((value) => { if (!signal?.aborted) setLists(value); })
      .catch(() => { if (!signal?.aborted) setLists((current) => current ?? []); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  const create = async () => {
    if (busy || !validTitle(title)) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createCollection(auth, { title }, refresh);
      setTitle('');
      setCreating(false);
      load();
      onOpen(made.id);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(status === 429 ? tx('profile:collections.limit', 'En fazla 20 koleksiyon oluşturabilirsin.')
        : status === 422 ? tx('profile:collections.blocked', 'Bu metin topluluk kurallarına uymuyor.')
          : tx('profile:collections.failed', 'Kaydedilemedi. Tekrar dene.'));
    } finally {
      setBusy(false);
    }
  };

  if (lists === null) return <ActivityIndicator color={colors.primary} style={styles.loading} />;

  return (
    <View style={styles.card} testID="collections-section">
      <View style={styles.head}>
        <Layers color={colors.primary} size={16} />
        <Text accessibilityRole="header" style={styles.title}>{tx('profile:collections.title', 'Koleksiyonlar')}</Text>
        {lists.length < COLLECTION_LIMITS.perUser ? (
          <AnimatedPressable accessibilityLabel={tx('profile:collections.new', 'Yeni koleksiyon')} accessibilityRole="button" onPress={() => setCreating((v) => !v)} pressScale={0.92} style={styles.newButton}>
            <Plus color={colors.primary} size={18} />
          </AnimatedPressable>
        ) : null}
      </View>
      {creating ? (
        <View style={styles.newRow}>
          <FolderPlus color={colors.textSecondary} size={18} />
          <TextInput
            accessibilityLabel={tx('profile:collections.newPlaceholder', 'Yeni koleksiyon adı')}
            autoFocus
            maxLength={COLLECTION_LIMITS.title}
            onChangeText={setTitle}
            onSubmitEditing={() => { void create(); }}
            placeholder={tx('profile:collections.examplePlaceholder', 'Örn. Ders çalışmalık kafeler')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            style={styles.input}
            value={title}
          />
          {busy ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        </View>
      ) : null}
      {lists.length === 0 && !creating ? <Text style={styles.empty}>{tx('profile:collections.emptyHint', 'Yerleri listelerde topla ("Hafta sonu kahvaltı"); istersen bağlantıyla paylaş. Her yer açıldığında şu anki durumunu gösterir.')}</Text> : null}
      {lists.map((list) => (
        <AnimatedPressable accessibilityRole="button" key={list.id} onPress={() => onOpen(list.id)} pressScale={0.99} style={styles.row}>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.name}>{list.title}</Text>
            <Text numberOfLines={1} style={styles.sub}>{itemCountLabel(list.itemCount)}{list.preview.length ? ` · ${list.preview.map((p) => p.name).join(', ')}` : ''}</Text>
          </View>
          {list.visibility === 'link' ? <Link2 accessibilityLabel={tx('profile:collections.link', 'Bağlantıyla paylaşıldı')} color={colors.textSecondary} size={15} /> : null}
          <ChevronRight color={colors.textSecondary} size={18} />
        </AnimatedPressable>
      ))}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.xs, marginBottom: spacing.md, padding: spacing.md, ...shadowSoft },
  head: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  newButton: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  newRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, paddingHorizontal: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 44 },
  empty: { ...typography.caption, color: colors.textSecondary },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 52 },
  copy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger },
});
