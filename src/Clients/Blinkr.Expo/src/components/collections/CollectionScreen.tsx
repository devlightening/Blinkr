import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Link2, Lock, RefreshCw, Share2, Trash2, X } from 'lucide-react-native';

import { deleteCollection, getCollection, getSharedCollection, removeCollectionItem, updateCollection } from '../../api';
import { collectionLink, collectionShareText, itemCountLabel, validTitle, type CollectionDetail, type CollectionItem } from '../../collections';
import { success } from '../../haptics';
import { formatCategory } from '../../presentation';
import { liveStateFromPlace } from '../../live/liveState';
import { usePlacesLive } from '../../usePlacesLive';
import { categoryTone, colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { PlaceSymbol } from '../PlaceSymbol';
import { LiveStateLine } from '../live/LiveStateLine';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { PushScreen, type PushScreenHandle } from '../ui/PushScreen';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
export type CollectionTarget = { kind: 'mine'; id: string } | { kind: 'shared'; token: string };

/**
 * One collection (D-041), pushed over the screen it was opened from. Every place shows its live state when it has
 * verified, fresh activity (same rule as saved places); a tap opens it on the map. The owner can rename, share by link
 * (copy / other apps / new link to cut old ones off), make it private again, remove places and delete the list. A list
 * opened from someone's link is read-only and says whose it is.
 */
export function CollectionScreen({ auth, target, refresh = {}, onBack, onOpenPlace, onChanged }: {
  auth: AuthResponse;
  target: CollectionTarget;
  refresh?: Refresh;
  onBack: () => void;
  onOpenPlace: (place: BlinkrPlace) => void;
  /** The owner changed something (title, items, visibility, deleted): the list behind refreshes. */
  onChanged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const page = useRef<PushScreenHandle>(null);
  const [data, setData] = useState<CollectionDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = target.kind === 'mine'
      ? getCollection(auth, target.id, controller.signal, refresh)
      : getSharedCollection(auth, target.token, controller.signal, refresh);
    load.then((value) => { if (!controller.signal.aborted) { setData(value); setTitle(value.title); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, target.kind === 'mine' ? target.id : target.token]);

  const live = usePlacesLive(useMemo(() => (data?.items ?? []).map((item) => item.placeId), [data]));
  const mine = data?.isMine === true && target.kind === 'mine';

  const apply = async (run: () => Promise<CollectionDetail>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await run();
      setData(next);
      setTitle(next.title);
      onChanged?.();
      if (done) { setNotice(done); success(); }
    } catch (err) {
      setNotice((err as { status?: number })?.status === 422
        ? tx('profile:collections.blocked', 'Bu metin topluluk kurallarına uymuyor.')
        : tx('profile:collections.failed', 'Kaydedilemedi. Tekrar dene.'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!data?.shareToken) return;
    try { await Clipboard.setStringAsync(collectionLink(data.shareToken)); setNotice(tx('profile:collections.copied', 'Bağlantı kopyalandı')); success(); } catch { /* nothing to undo */ }
  };

  const remove = async () => {
    if (!data || busy) return;
    setBusy(true);
    try { await deleteCollection(auth, data.id, refresh); onChanged?.(); page.current?.back(); } catch { setNotice(tx('profile:collections.failed', 'Kaydedilemedi. Tekrar dene.')); setBusy(false); }
  };

  const openItem = (item: CollectionItem) => {
    const known = live[item.placeId];
    onOpenPlace(known ?? { id: item.placeId, name: item.name, category: item.category ?? null, latitude: item.latitude, longitude: item.longitude });
  };

  return (
    <PushScreen onBack={onBack} ref={page} testID="collection-screen">
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri dön')} accessibilityRole="button" onPress={() => page.current?.back()} pressScale={0.92} style={styles.iconButton}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.barTitle}>{data?.title ?? ''}</Text>
        {mine ? (
          <AnimatedPressable accessibilityLabel={tx('profile:collections.delete', 'Koleksiyonu sil')} accessibilityRole="button" onPress={() => setConfirmDelete(true)} pressScale={0.92} style={styles.iconButton}>
            <Trash2 color={colors.textSecondary} size={20} />
          </AnimatedPressable>
        ) : <View style={styles.iconButton} />}
      </View>

      {failed ? (
        <View style={styles.center}>
          <BlinkrEmptyState
            description={tx('profile:collections.notFoundHint', 'Liste silinmiş, gizlenmiş ya da bağlantı değişmiş olabilir.')}
            icon={<Lock color={colors.textSecondary} size={24} />}
            title={tx('profile:collections.notFound', 'Bu koleksiyon açılamıyor')}
          />
        </View>
      ) : !data ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          {data.owner && !data.isMine ? (
            <View style={styles.owner}>
              <Avatar avatarKey={data.owner.avatarKey} photoVersion={data.owner.photoVersion} seed={data.owner.id} size={28} userId={data.owner.id} />
              <Text style={styles.ownerText}>{tx('profile:collections.by', '@{{name}} listesi', { name: data.owner.userName })}</Text>
            </View>
          ) : null}

          {mine && renaming ? (
            <View style={styles.renameRow}>
              <TextInput
                accessibilityLabel={tx('profile:collections.titleLabel', 'Koleksiyon adı')}
                autoFocus
                maxLength={60}
                onChangeText={setTitle}
                onSubmitEditing={() => { if (validTitle(title)) { setRenaming(false); void apply(() => updateCollection(auth, data.id, { title }, refresh)); } }}
                style={styles.input}
                value={title}
              />
              <AnimatedPressable accessibilityRole="button" disabled={!validTitle(title)} onPress={() => { setRenaming(false); void apply(() => updateCollection(auth, data.id, { title }, refresh)); }} pressScale={0.95} style={[styles.smallButton, !validTitle(title) && styles.disabled]}>
                <Text style={styles.smallButtonText}>{tx('common:actions.save', 'Kaydet')}</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable accessibilityHint={mine ? tx('profile:collections.renameHint', 'Adı değiştirmek için dokun') : undefined} disabled={!mine} onPress={() => setRenaming(true)} pressScale={0.99}>
              <Text style={styles.title}>{data.title}</Text>
            </AnimatedPressable>
          )}
          {data.description ? <Text style={styles.description}>{data.description}</Text> : null}
          <Text style={styles.meta}>{itemCountLabel(data.items.length)}</Text>

          {mine ? (
            <View style={styles.shareCard}>
              <View style={styles.segment}>
                {(['private', 'link'] as const).map((value) => {
                  const selected = data.visibility === value;
                  return (
                    <AnimatedPressable accessibilityRole="button" accessibilityState={{ selected }} disabled={busy} key={value} onPress={() => { if (!selected) void apply(() => updateCollection(auth, data.id, { visibility: value }, refresh)); }} pressScale={0.97} style={[styles.segmentItem, selected && styles.segmentOn]}>
                      {value === 'private' ? <Lock color={selected ? colors.ink : colors.text} size={14} /> : <Link2 color={selected ? colors.ink : colors.text} size={14} />}
                      <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{value === 'private' ? tx('profile:collections.private', 'Yalnız sen') : tx('profile:collections.linkShort', 'Bağlantıyla')}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              {data.visibility === 'link' && data.shareToken ? (
                <View style={styles.shareActions}>
                  <ShareAction icon={<Link2 color={colors.text} size={18} />} label={tx('profile:collections.copy', 'Kopyala')} onPress={() => { void copyLink(); }} />
                  <ShareAction icon={<Share2 color={colors.text} size={18} />} label={tx('profile:collections.share', 'Paylaş')} onPress={() => { Share.share({ message: collectionShareText(data.title, data.shareToken!) }).catch(() => {}); }} />
                  <ShareAction icon={<RefreshCw color={colors.text} size={18} />} label={tx('profile:collections.newLink', 'Yeni bağlantı')} onPress={() => { void apply(() => updateCollection(auth, data.id, { newLink: true }, refresh), tx('profile:collections.newLinkDone', 'Eski bağlantı artık açılmaz')); }} />
                </View>
              ) : (
                <Text style={styles.hint}>{tx('profile:collections.privateHint', 'Yalnız sen görüyorsun. "Bağlantıyla" seçince bağlantıya sahip olan herkes görebilir.')}</Text>
              )}
            </View>
          ) : null}

          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

          {confirmDelete ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>{tx('profile:collections.deleteConfirm', 'Bu koleksiyon silinsin mi? Paylaştığın bağlantı da açılmaz olur.')}</Text>
              <View style={styles.confirmRow}>
                <AnimatedPressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} pressScale={0.97} style={styles.smallButton}><Text style={styles.smallButtonText}>{tx('common:actions.cancel', 'Vazgeç')}</Text></AnimatedPressable>
                <AnimatedPressable accessibilityRole="button" disabled={busy} onPress={() => { void remove(); }} pressScale={0.97} style={[styles.smallButton, styles.dangerButton]}><Text style={styles.dangerText}>{tx('profile:collections.deleteYes', 'Sil')}</Text></AnimatedPressable>
              </View>
            </View>
          ) : null}

          {data.items.length === 0 ? (
            <Text style={styles.hint}>{mine ? tx('profile:collections.emptyMine', 'Bir yerin sayfasında "Koleksiyona ekle" ile buraya yer ekle.') : tx('profile:collections.empty', 'Bu listede henüz yer yok.')}</Text>
          ) : data.items.map((item) => {
            const state = liveStateFromPlace(live[item.placeId], Date.now());
            const tone = categoryTone(item.category);
            return (
              <View key={item.placeId} style={styles.row}>
                <AnimatedPressable accessibilityLabel={tx('profile:collections.openA11y', '{{name}}, haritada aç', { name: item.name })} accessibilityRole="button" onPress={() => openItem(item)} pressScale={0.99} style={styles.rowMain}>
                  <View style={[styles.tile, { backgroundColor: `${tone}26` }]}><PlaceSymbol category={item.category} color={tone} size={18} /></View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.rowSub}>{formatCategory(item.category)}</Text>
                    <LiveStateLine state={state} />
                    {item.note ? <Text numberOfLines={2} style={styles.note}>{item.note}</Text> : null}
                  </View>
                </AnimatedPressable>
                {mine ? (
                  <AnimatedPressable accessibilityLabel={tx('profile:collections.removeA11y', '{{name}} listeden çıkar', { name: item.name })} accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => { void apply(() => removeCollectionItem(auth, data.id, item.placeId, refresh)); }} pressScale={0.9} style={styles.iconButton}>
                    <X color={colors.textSecondary} size={18} />
                  </AnimatedPressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </PushScreen>
  );
}

function ShareAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <AnimatedPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.95} style={styles.shareAction}>
      <View style={styles.shareIcon}>{icon}</View>
      <Text style={styles.shareLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  barTitle: { ...typography.heading, color: colors.text, flex: 1, textAlign: 'center' },
  iconButton: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  center: { flex: 1, justifyContent: 'center' },
  loading: { marginTop: spacing.xl },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg },
  owner: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  ownerText: { ...typography.callout, color: colors.textSecondary },
  title: { ...typography.headline, color: colors.text },
  description: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  renameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  input: { ...typography.title, backgroundColor: colors.surfaceElevated, borderRadius: radii.md, color: colors.text, flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, justifyContent: 'center', minHeight: 38, paddingHorizontal: spacing.md },
  smallButtonText: { ...typography.label, color: colors.text },
  disabled: { opacity: 0.4 },
  shareCard: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.md, padding: spacing.md },
  segment: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', padding: 3 },
  segmentItem: { alignItems: 'center', borderRadius: radii.pill, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: spacing.sm },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { ...typography.label, color: colors.text },
  segmentTextOn: { color: colors.ink },
  shareActions: { flexDirection: 'row', justifyContent: 'space-around' },
  shareAction: { alignItems: 'center', gap: spacing.xs, minWidth: 80 },
  shareIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  shareLabel: { ...typography.caption, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary },
  notice: { ...typography.caption, color: colors.primary },
  confirm: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  confirmText: { ...typography.body, color: colors.text },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  dangerButton: { backgroundColor: colors.danger },
  dangerText: { ...typography.label, color: colors.ink },
  row: { alignItems: 'center', flexDirection: 'row' },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingVertical: spacing.xs },
  tile: { alignItems: 'center', borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 },
  rowCopy: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  note: { ...typography.caption, color: colors.text, fontStyle: 'italic', marginTop: 2 },
});
