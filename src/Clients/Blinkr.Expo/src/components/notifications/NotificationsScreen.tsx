import { ArrowLeft, Bell, Heart, MessageCircle, ShieldAlert, UserCheck, UserPlus, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptFollowRequest, declineFollowRequest, listNotifications, markAllNotificationsRead } from '../../api';
import { groupNotifications, isAnswerable, notificationTarget, type AppNotification } from '../../notifications';
import { formatAge } from '../../presentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { Sheet } from '../Sheet';
import { UserProfileSheet } from '../friends/UserProfileSheet';
import { SignalThreadPanel } from '../signal/SignalThreadPanel';
import { BlinkrButton } from '../ui/BlinkrButton';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { SkeletonList } from '../ui/BlinkrSkeleton';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  onBack: () => void;
  onMessageUser?: (user: UserSummary) => void;
};

const iconFor = (type: string) => {
  switch (type) {
    case 'PostLiked': case 'StoryLiked': return <Heart color={colors.danger} fill={colors.danger} size={14} />;
    case 'CommentCreated': return <MessageCircle color={colors.primary} size={14} />;
    case 'FollowAccepted': return <UserCheck color={colors.primary} size={14} />;
    case 'UserFollowed': case 'FollowRequested': return <UserPlus color={colors.primary} size={14} />;
    case 'ModerationNotice': return <ShieldAlert color={colors.warning} size={14} />;
    default: return <Bell color={colors.textSecondary} size={14} />;
  }
};

/**
 * Notifications (sinyal-mvp-plan Faz 9 P9.3/P9.4): grouped Bugün / Bu hafta / Daha önce; a like or comment opens the
 * signal's likes/comments, a follow opens the person; a follow request can be answered right here. Opening the
 * screen marks everything read. No push yet (D-012): this is the in-app list.
 */
export function NotificationsScreen({ auth, onAuthChange, onLogout, onBack, onMessageUser }: Props) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [answered, setAnswered] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [postId, setPostId] = useState<string | null>(null);
  const [person, setPerson] = useState<UserSummary | null>(null);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired: onLogout };

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await listNotifications(auth, signal, refresh);
      if (signal?.aborted) return;
      setItems(result.items);
      setError(null);
      if (result.items.some((n) => !n.isRead)) void markAllNotificationsRead(auth, refresh).catch(() => {});
    } catch {
      if (!signal?.aborted) setError(t('notifications.loadFailed'));
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  const answer = async (n: AppNotification, accept: boolean) => {
    if (!n.actorUserId) return;
    setAnswered((current) => ({ ...current, [n.id]: accept ? 'accepted' : 'declined' }));
    try {
      if (accept) await acceptFollowRequest(auth, n.actorUserId, refresh);
      else await declineFollowRequest(auth, n.actorUserId, refresh);
    } catch {
      // The request may already be gone (answered elsewhere): the row simply stays answered.
    }
  };

  const open = (n: AppNotification) => {
    const target = notificationTarget(n);
    if (target?.kind === 'post') setPostId(target.postId);
    else if (target?.kind === 'user') setPerson({ id: target.userId, userName: target.userName || n.actorUserName || '' });
  };

  const groups = items ? groupNotifications(items) : [];

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel={t('notifications.close')} accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>{t('notifications.title')}</Text>
      </View>

      {items === null && !error ? <SkeletonList rows={5} style={styles.skeleton} /> : null}
      {error && !items ? (
        <View style={styles.center}>
          <BlinkrEmptyState action={{ label: t('notifications.retry'), onPress: () => { void load(); } }} icon={<WifiOff color={colors.textSecondary} size={30} />} title={error} />
        </View>
      ) : null}
      {items && items.length === 0 ? (
        <View style={styles.center}>
          <BlinkrEmptyState description={t('notifications.emptyBody')} icon={<Bell color={colors.textSecondary} size={30} />} title={t('notifications.emptyTitle')} />
        </View>
      ) : null}

      {items && items.length > 0 ? (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void load(); }} refreshing={refreshing} tintColor={colors.primary} />}
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>{t(`notifications.${group.key}`)}</Text>
              {group.items.map((n) => (
                <View key={n.id} style={styles.rowWrap}>
                  <AnimatedPressable accessibilityRole="button" onPress={() => open(n)} pressScale={0.99} style={styles.row} testID={`notification-${n.id}`}>
                    <View>
                      <Avatar seed={n.actorUserId ?? n.id} size={40} />
                      <View style={styles.badge}>{iconFor(n.type)}</View>
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.body, !n.isRead && styles.unread]}>{n.body}</Text>
                      <Text style={styles.age}>{formatAge(n.createdAtUtc)}</Text>
                    </View>
                  </AnimatedPressable>
                  {isAnswerable(n) ? (
                    answered[n.id] ? <Text style={styles.age}>{t('notifications.answered')}</Text> : (
                      <View style={styles.answer}>
                        <BlinkrButton label={t('notifications.accept')} onPress={() => { void answer(n, true); }} />
                        <BlinkrButton label={t('notifications.decline')} onPress={() => { void answer(n, false); }} variant="secondary" />
                      </View>
                    )
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {postId ? (
        <Sheet onClose={() => setPostId(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.92}>
            <SignalThreadPanel auth={auth} header={null} onClose={() => setPostId(null)} postId={postId} refresh={refresh} />
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}
      {person ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setPerson(null)}
          onMessage={(user) => { setPerson(null); onMessageUser?.(user); }}
          onSessionExpired={onLogout}
          user={person}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 40 },
  bar: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  title: { ...typography.title, color: colors.text },
  skeleton: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  list: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  group: { gap: spacing.xs },
  groupTitle: { ...typography.heading, color: colors.text },
  rowWrap: { gap: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56 },
  badge: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.pill, bottom: -2, height: 20, justifyContent: 'center', position: 'absolute', right: -4, width: 20 },
  copy: { flex: 1, gap: 2 },
  body: { ...typography.body, color: colors.text },
  unread: { fontWeight: '600' },
  age: { ...typography.caption, color: colors.textSecondary },
  answer: { flexDirection: 'row', gap: spacing.sm, marginLeft: 52 },
});
