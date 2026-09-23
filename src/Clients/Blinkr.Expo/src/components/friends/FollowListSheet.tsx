import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { acceptFollowRequest, declineFollowRequest, listFollowers, listFollowing, listFollowRequests, removeFollower } from '../../api';
import { mergeFollowPage, type FollowState } from '../../follows';
import { colors, spacing, typography } from '../../theme';
import type { AuthResponse, FollowRequestItem, FollowUser, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { Sheet } from '../Sheet';
import { BlinkrButton } from '../ui/BlinkrButton';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { SegmentedControl } from '../ui/BlinkrSegmentedControl';
import { FollowButton } from './FollowButton';

export type FollowListTab = 'followers' | 'following' | 'requests';

type Props = {
  auth: AuthResponse;
  /** Whose lists. When it is me, followers can be removed and requests answered. */
  ownerId: string;
  ownerName: string;
  initialTab: FollowListTab;
  /** Offer the requests tab (my own private account). */
  showRequests?: boolean;
  onClose: () => void;
  onOpenUser?: (user: UserSummary) => void;
  /** Tells the profile behind the sheet that counts changed (accept/remove). */
  onCountsChange?: () => void;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
};

/**
 * Followers / Following / Requests (sinyal-mvp-plan P6.5, P6.6). Paged ("Daha fazla"), every row has a follow button;
 * on my own followers list a row can be removed (they are not told). Blocked people never appear (server-filtered).
 */
/** The list as a full sheet (own profile screen). */
export function FollowListSheet(props: Props) {
  return (
    <Sheet onClose={props.onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.9}>
        <FollowListPanel {...props} />
      </BlinkrSheetPanel>
    </Sheet>
  );
}

/** The list content alone, to swap into an already open sheet (someone else's profile) instead of stacking a second one. */
export function FollowListPanel({ auth, ownerId, ownerName, initialTab, showRequests = false, onClose, onOpenUser, onCountsChange, refresh = {} }: Props) {
  const { t } = useTranslation('profile');
  const [tab, setTab] = useState<FollowListTab>(initialTab);
  const [items, setItems] = useState<FollowUser[]>([]);
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const isMine = ownerId === auth.userId;

  const load = useCallback(async (which: FollowListTab, nextPage: number, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      if (which === 'requests') {
        const list = await listFollowRequests(auth, signal, refreshRef.current);
        if (!signal?.aborted) { setRequests(list); setHasMore(false); }
      } else {
        const result = which === 'followers'
          ? await listFollowers(auth, ownerId, nextPage, signal, refreshRef.current)
          : await listFollowing(auth, ownerId, nextPage, signal, refreshRef.current);
        if (signal?.aborted) return;
        setItems((current) => mergeFollowPage(current, result.items, nextPage));
        setHasMore(result.hasMore);
        setPage(nextPage);
      }
    } catch {
      if (!signal?.aborted) setError(t('lists.loadFailed'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [auth, ownerId, t]);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    void load(tab, 1, controller.signal);
    return () => controller.abort();
  }, [tab, load]);

  const setRowState = (id: string, follow: FollowState) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, follow: follow === 'self' ? item.follow : follow } : item)));

  const remove = async (id: string) => {
    setConfirmRemove(null);
    const before = items;
    setItems((current) => current.filter((item) => item.id !== id));
    try {
      await removeFollower(auth, id, refreshRef.current);
      onCountsChange?.();
    } catch {
      setItems(before);
      setError(t('follow.failed'));
    }
  };

  const answer = async (id: string, accept: boolean) => {
    const before = requests;
    setRequests((current) => current.filter((item) => item.id !== id));
    try {
      if (accept) await acceptFollowRequest(auth, id, refreshRef.current);
      else await declineFollowRequest(auth, id, refreshRef.current);
      onCountsChange?.();
    } catch {
      setRequests(before);
      setError(t('follow.failed'));
    }
  };

  const tabs: Array<{ value: FollowListTab; label: string }> = [
    { value: 'followers', label: t('lists.followers') },
    { value: 'following', label: t('lists.following') },
    ...(isMine && showRequests ? [{ value: 'requests' as const, label: t('lists.requests') }] : []),
  ];

  const empty = tab === 'followers' ? t('lists.emptyFollowers') : tab === 'following' ? t('lists.emptyFollowing') : t('lists.emptyRequests');
  const nothing = !loading && !error && (tab === 'requests' ? requests.length === 0 : items.length === 0);

  return (
    <View style={styles.root}>
        <View style={styles.head}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{ownerName}</Text>
          <AnimatedPressable accessibilityLabel={t('lists.close')} accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
            <X color={colors.text} size={20} />
          </AnimatedPressable>
        </View>
        <SegmentedControl accessibilityLabel={ownerName} onChange={setTab} options={tabs} value={tab} />
        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {nothing ? <Text style={styles.empty}>{empty}</Text> : null}

          {tab === 'requests'
            ? requests.map((item) => (
              <View key={item.id} style={styles.row}>
                <AnimatedPressable accessibilityRole="button" onPress={() => onOpenUser?.({ id: item.id, userName: item.userName, avatarKey: item.avatarKey })} pressScale={0.98} style={styles.person}>
                  <Avatar avatarKey={item.avatarKey} seed={item.id} size={40} />
                  <Text numberOfLines={1} style={styles.name}>{item.userName}</Text>
                </AnimatedPressable>
                <BlinkrButton label={t('lists.accept')} onPress={() => { void answer(item.id, true); }} />
                <BlinkrButton label={t('lists.decline')} onPress={() => { void answer(item.id, false); }} variant="secondary" />
              </View>
            ))
            : items.map((item) => (
              <View key={item.id} style={styles.rowBlock}>
                <View style={styles.row}>
                  <AnimatedPressable accessibilityRole="button" onPress={() => onOpenUser?.({ id: item.id, userName: item.userName, avatarKey: item.avatarKey })} pressScale={0.98} style={styles.person}>
                    <Avatar avatarKey={item.avatarKey} seed={item.id} size={40} />
                    <View style={styles.personCopy}>
                      <Text numberOfLines={1} style={styles.name}>{item.userName}</Text>
                      {item.followsYou && item.follow !== 'self' ? <Text style={styles.sub}>{t('follow.followsYou')}</Text> : null}
                    </View>
                  </AnimatedPressable>
                  {item.follow === 'self' ? null : (
                    <FollowButton auth={auth} followsYou={item.followsYou} onChange={(next) => setRowState(item.id, next)} refresh={refresh} state={item.follow} userId={item.id} />
                  )}
                  {isMine && tab === 'followers' ? (
                    <AnimatedPressable accessibilityLabel={`${item.userName}: ${t('lists.remove')}`} accessibilityRole="button" onPress={() => setConfirmRemove(item.id)} pressScale={0.95} style={styles.removeLink}>
                      <Text style={styles.sub}>{t('lists.remove')}</Text>
                    </AnimatedPressable>
                  ) : null}
                </View>
                {confirmRemove === item.id ? (
                  <View style={styles.confirm}>
                    <Text style={styles.sub}>{t('lists.removeConfirm')}</Text>
                    <View style={styles.confirmRow}>
                      <BlinkrButton label={t('lists.remove')} onPress={() => { void remove(item.id); }} variant="danger" />
                      <BlinkrButton label={t('lists.cancel')} onPress={() => setConfirmRemove(null)} variant="ghost" />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

          {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
          {hasMore && !loading ? (
            <BlinkrButton label={t('lists.loadMore')} onPress={() => { void load(tab, page + 1); }} variant="ghost" />
          ) : null}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  title: { ...typography.title, color: colors.text, flex: 1 },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  list: { flexShrink: 1, marginTop: spacing.md },
  rowBlock: { gap: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 56 },
  person: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  personCopy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  sub: { ...typography.caption, color: colors.textSecondary },
  removeLink: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.xs },
  confirm: { gap: spacing.xs, paddingBottom: spacing.sm },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  error: { ...typography.caption, color: colors.danger, marginVertical: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
  loading: { marginVertical: spacing.md },
});
