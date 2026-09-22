import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Camera, MessageCircle, SquarePen, WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUser, listBlocks, listConversations, startConversation } from '../../api';
import { formatAge } from '../../presentation';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { Sheet } from '../Sheet';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SkeletonList } from '../ui/BlinkrSkeleton';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { bottomBarClearance } from '../ui/BlinkrBottomBar';
import { UserProfileSheet } from '../friends/UserProfileSheet';
import { UserSearchSheet } from './UserSearchSheet';
import { ConversationScreen } from './ConversationScreen';
import { colors, motion, radii, spacing, typography } from '../../theme';
import type { AuthResponse, Conversation, UserSummary } from '../../types';
import { Avatar } from '../Avatar';
import { conversationLabel, conversationStatus } from '../../snapPresentation';
import { SnapFlow, type SnapFlowRequest } from '../snap/SnapFlow';
import type { SnapRecipient } from '../snap/SnapSendStep';
import { SnapStatusIcon, statusColor } from '../snap/SnapStatusIcon';
import { SnapViewer } from '../snap/SnapViewer';

const POLL_INTERVAL_MS = 8000;
const AVATAR_SIZE = 48;
const ROW_GAP = spacing.md;
const NAME_BATCH_SIZE = 30;
const FALLBACK_NAME = 'Kullanıcı';

// user id -> user name. Names are public and stable, so successful lookups are kept for the
// whole app session and survive the tab being unmounted and remounted.
const userNameCache = new Map<string, string>();
// Chosen avatar per user id (null = none chosen, the client draws the default from the id).
const userAvatarCache = new Map<string, string | null>();

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  /** True while any conversation has messages this user has not read (drives the tab-bar dot). */
  onUnreadChange?: (hasUnread: boolean) => void;
  /** A conversation screen owns the whole tab, so the app shell hides its bar and shows the composer. */
  onConversationOpenChange?: (open: boolean) => void;
  /** One-shot request from the share hub: start a new snap (camera, then recipients). */
  snapRequested?: boolean;
  onSnapHandled?: () => void;
  /** One-shot request from a profile: open (or start) the conversation with this person. */
  openWith?: UserSummary | null;
  onOpenWithHandled?: () => void;
};

export function ChatListScreen({ auth, onAuthChange, onSessionExpired, onUnreadChange, onConversationOpenChange, snapRequested = false, onSnapHandled, openWith = null, onOpenWithHandled }: Props) {
  const insets = useSafeAreaInsets();
  const [allConversations, setConversations] = useState<Conversation[]>([]);
  // People I blocked stay out of my list; the server refuses their messages anyway.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [profileUser, setProfileUser] = useState<UserSummary | null>(null);
  const conversations = useMemo(() => allConversations.filter((item) => !blockedIds.has(item.otherUserId)), [allConversations, blockedIds]);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [flow, setFlow] = useState<SnapFlowRequest | null>(null);
  const [viewing, setViewing] = useState<{ conversation: Conversation; messageId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(userNameCache));
  const pollInFlight = useRef(false);
  const hasSettled = useRef(false);
  // Ids already looked up by this screen instance. A failed lookup (e.g. a deleted user) is not
  // retried on every poll; it is tried again the next time the screen is opened.
  const requestedNames = useRef(new Set<string>());

  const resolveNames = useCallback(async (items: Conversation[]) => {
    const missing = [...new Set(items.map((item) => item.otherUserId))]
      .filter((id) => !userNameCache.has(id) && !requestedNames.current.has(id))
      .slice(0, NAME_BATCH_SIZE);
    if (!missing.length) return;
    missing.forEach((id) => requestedNames.current.add(id));

    const results = await Promise.allSettled(missing.map((id) => getUser(auth, id, onAuthChange, onSessionExpired)));
    let resolved = false;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.userName) {
        userNameCache.set(missing[index], result.value.userName);
        userAvatarCache.set(missing[index], result.value.avatarKey ?? null);
        resolved = true;
      }
    });
    if (resolved) setNames(Object.fromEntries(userNameCache));
  }, [auth, onAuthChange, onSessionExpired]);

  // Only background polls are skipped while another request is in flight; a user-initiated
  // refresh always runs so the pull-to-refresh indicator can never be left spinning.
  const refresh = useCallback(async (background = false) => {
    if (background && pollInFlight.current) return;
    pollInFlight.current = true;
    if (!background) setLoading(true);
    try {
      const items = await listConversations(auth, onAuthChange, onSessionExpired);
      setConversations(items);
      setError(null);
      listBlocks(auth, undefined, { onAuthRefresh: onAuthChange, onSessionExpired })
        .then((rows) => setBlockedIds(new Set(rows.map((row) => row.id))))
        .catch(() => { /* the list still works; sending is refused by the server anyway */ });
      console.log('[Blinkr Chat]', { status: 'ready', resultCount: items.length });
      void resolveNames(items);
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      if (!background) setError(friendlyError(err, 'Sohbetler yüklenemedi. Tekrar dene.'));
    } finally {
      pollInFlight.current = false;
      hasSettled.current = true;
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  }, [auth, onAuthChange, onSessionExpired, resolveNames]);

  // `refresh` changes identity when the session token is refreshed; reload quietly in that
  // case instead of flashing the full-screen spinner again.
  useEffect(() => {
    refresh(hasSettled.current);
  }, [refresh]);

  // The conversation screen owns its own faster poll, so the list poll pauses while one is
  // open, and ticks are skipped while the app is not in the foreground.
  useEffect(() => {
    if (activeConversation) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh, activeConversation]);

  useEffect(() => {
    onUnreadChange?.(conversations.some((conversation) => (conversation.unreadCount ?? 0) > 0));
  }, [conversations, onUnreadChange]);

  useEffect(() => {
    // The camera, the snap sender and the snap viewer each own the whole screen, like an open conversation.
    onConversationOpenChange?.(Boolean(activeConversation) || Boolean(flow) || Boolean(viewing) || Boolean(profileUser));
    return () => onConversationOpenChange?.(false);
  }, [activeConversation, flow, viewing, profileUser, onConversationOpenChange]);

  useEffect(() => {
    if (!snapRequested) return;
    onSnapHandled?.();
    setFlow({ mode: 'compose' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapRequested]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const openConversationWith = async (user: UserSummary) => {
    setSearchOpen(false);
    // The search result already carries the name; no extra lookup is needed.
    userNameCache.set(user.id, user.userName);
    userAvatarCache.set(user.id, user.avatarKey ?? null);
    setNames(Object.fromEntries(userNameCache));
    try {
      const conversation = await startConversation(auth, user.id, onAuthChange, onSessionExpired);
      setActiveConversation(conversation);
    } catch (err) {
      setError(friendlyError(err, 'Konuşma başlatılamadı. Tekrar dene.'));
    }
  };

  useEffect(() => {
    if (!openWith) return;
    onOpenWithHandled?.();
    void openConversationWith(openWith);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWith]);

  const recipients: SnapRecipient[] = conversations.map((item) => ({ id: item.id, name: names[item.otherUserId] ?? FALLBACK_NAME, userId: item.otherUserId, avatarKey: userAvatarCache.get(item.otherUserId) }));
  const overlays = (
    <>
      {profileUser ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setProfileUser(null)}
          onMessage={(user) => { setProfileUser(null); if (!activeConversation) void openConversationWith(user); }}
          onRelationChange={(userId, relation) => {
            if (relation !== 'blocked') return;
            // Blocked from inside the conversation: leave it, and keep them out of the list from now on.
            setBlockedIds((current) => new Set(current).add(userId));
            setProfileUser(null);
            setActiveConversation(null);
          }}
          onSessionExpired={onSessionExpired}
          user={profileUser}
        />
      ) : null}
      {viewing ? (
        <SnapViewer
          auth={auth}
          conversationId={viewing.conversation.id}
          messageId={viewing.messageId}
          onAuthChange={onAuthChange}
          onClose={() => { setViewing(null); refresh(true); }}
          onReply={() => setFlow({ mode: 'reply', conversationId: viewing.conversation.id })}
          onSessionExpired={onSessionExpired}
          senderAvatarKey={userAvatarCache.get(viewing.conversation.otherUserId)}
          senderId={viewing.conversation.otherUserId}
          senderName={names[viewing.conversation.otherUserId] ?? FALLBACK_NAME}
        />
      ) : null}
      {flow ? (
        <SnapFlow
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setFlow(null)}
          onSent={(count) => { setFlow(null); setNotice(count > 1 ? `Snap ${count} kişiye gönderildi` : 'Snap gönderildi'); refresh(true); }}
          onSessionExpired={onSessionExpired}
          recipients={recipients}
          request={flow}
        />
      ) : null}
    </>
  );

  if (activeConversation) {
    return <View style={styles.screen}><ConversationScreen
      auth={auth}
      conversation={activeConversation}
      otherUserName={names[activeConversation.otherUserId] ?? FALLBACK_NAME}
      otherAvatarKey={userAvatarCache.get(activeConversation.otherUserId)}
      onAuthChange={onAuthChange}
      onBack={() => { setActiveConversation(null); refresh(true); }}
      onOpenProfile={() => setProfileUser({ id: activeConversation.otherUserId, userName: names[activeConversation.otherUserId] ?? FALLBACK_NAME, avatarKey: userAvatarCache.get(activeConversation.otherUserId) })}
      onOpenSnap={(messageId) => setViewing({ conversation: activeConversation, messageId })}
      onSendSnap={() => setFlow({ mode: 'reply', conversationId: activeConversation.id })}
      onSessionExpired={onSessionExpired}
    />{overlays}</View>;
  }

  const total = conversations.length;

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text accessibilityRole="header" style={styles.title}>Sohbetler</Text>
      <AnimatedPressable accessibilityLabel="Yeni mesaj" accessibilityRole="button" onPress={() => setSearchOpen(true)} pressScale={0.95} style={styles.newButton}>
        <SquarePen color={colors.primary} size={20} strokeWidth={2} />
      </AnimatedPressable>
    </View>

    {isLoading ? (
      <SkeletonList rows={6} style={styles.skeleton} />
    ) : error ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          action={{ label: 'Tekrar dene', onPress: () => refresh() }}
          description={error}
          icon={<WifiOff color={colors.textSecondary} size={26} />}
          title="Sohbetler açılamadı"
        />
      </View>
    ) : !total ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          action={{ label: 'Yeni mesaj', onPress: () => setSearchOpen(true), icon: <SquarePen color={colors.ink} size={18} /> }}
          description="Bir kullanıcı bul ve konuşmaya başla."
          icon={<MessageCircle color={colors.textSecondary} size={26} />}
          title="Henüz mesajın yok"
        />
      </View>
    ) : (
      <FlatList
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.list, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); refresh(); }} refreshing={isRefreshing} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const name = names[item.otherUserId] ?? FALLBACK_NAME;
          const status = conversationStatus(item, auth.userId);
          const when = formatAge(item.lastMessageAtUtc);
          const openRow = () => {
            // Like Snapchat: a waiting snap opens straight into the viewer; everything else opens the conversation.
            if (status.opensSnap && item.lastMessageId) setViewing({ conversation: item, messageId: item.lastMessageId });
            else setActiveConversation(item);
          };
          return (
            <Animated.View entering={FadeIn.duration(motion.base)}>
              <View style={styles.row}>
                <AnimatedPressable
                  accessibilityLabel={conversationLabel(name, status, when)}
                  accessibilityRole="button"
                  onLongPress={() => setActiveConversation(item)}
                  onPress={openRow}
                  pressScale={0.99}
                  style={styles.rowMain}
                >
                  <Avatar avatarKey={userAvatarCache.get(item.otherUserId)} seed={item.otherUserId} size={AVATAR_SIZE} />
                  <View style={styles.rowBody}>
                    <Text numberOfLines={1} style={styles.name}>{name}</Text>
                    <View style={styles.statusLine}>
                      <SnapStatusIcon filled={status.filled} icon={status.icon} tone={status.tone} />
                      <Text numberOfLines={1} style={[styles.status, { color: status.tone === 'quiet' ? colors.textSecondary : statusColor(status.tone) }, status.filled && styles.statusNew]}>{status.label}</Text>
                      <Text style={styles.when}>· {when}</Text>
                    </View>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable accessibilityLabel={`${name} kişisine Snap gönder`} accessibilityRole="button" hitSlop={6} onPress={() => setFlow({ mode: 'reply', conversationId: item.id })} pressScale={0.95} style={styles.cameraButton}>
                  <Camera color={colors.textSecondary} size={18} />
                </AnimatedPressable>
              </View>
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    )}

    {overlays}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    {isSearchOpen && <Sheet onClose={() => setSearchOpen(false)}>
      <BlinkrSheetPanel maxHeightRatio={0.88}>
        <UserSearchSheet auth={auth} onBack={() => setSearchOpen(false)} onSelect={openConversationWith} />
      </BlinkrSheetPanel>
    </Sheet>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  title: { ...typography.headline, color: colors.text },
  newButton: { alignItems: 'center', backgroundColor: 'rgba(95, 211, 160, 0.14)', borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  centerFill: { flex: 1, justifyContent: 'center' },
  skeleton: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { paddingTop: spacing.xs },
  separator: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: spacing.lg + AVATAR_SIZE + ROW_GAP },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 68, paddingRight: spacing.md },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: ROW_GAP, minHeight: 68, paddingLeft: spacing.lg, paddingVertical: spacing.sm },
  rowBody: { flex: 1, gap: 2 },
  name: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  statusLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  status: { ...typography.caption, flexShrink: 1 },
  statusNew: { fontWeight: '700' },
  when: { ...typography.caption, color: colors.textSecondary },
  cameraButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  notice: { ...typography.bodyStrong, alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, bottom: 96, color: colors.text, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, position: 'absolute' },
});
