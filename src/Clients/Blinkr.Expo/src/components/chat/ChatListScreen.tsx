import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ban, Bell, BellOff, Camera, CheckCheck, Flag, MessageCircle, Pin, PinOff, Search, SquarePen, UserPlus, UserRound, WifiOff, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blockUser, getUsersBatch, listBlocks, listConversations, listFriends, markConversationRead, searchUsers, sendReport, startConversation, updateConversationPreferences } from '../../api';
import { MAX_PINNED, PEOPLE_QUERY_MIN, canMarkRead, filterConversations, hasAttentionUnread, orderConversations, otherPeople, pinnedCount, unreadBadge } from '../../chatList';
import { success } from '../../haptics';
import { formatAge } from '../../presentation';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { ReportPanel } from '../ReportPanel';
import { Sheet } from '../Sheet';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SkeletonList } from '../ui/BlinkrSkeleton';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { bottomBarClearance } from '../ui/BlinkrBottomBar';
import { FriendsScreen } from '../friends/FriendsScreen';
import { UserProfileSheet } from '../friends/UserProfileSheet';
import { UserSearchSheet } from './UserSearchSheet';
import { ConversationScreen } from './ConversationScreen';
import { colors, motion, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace, Conversation, Friend, UserSummary } from '../../types';
import { Avatar } from '../Avatar';
import { conversationLabel, conversationStatus } from '../../snapPresentation';
import { SnapFlow, type SnapFlowRequest } from '../snap/SnapFlow';
import type { SnapRecipient } from '../snap/SnapSendStep';
import { SnapStatusIcon, statusColor } from '../snap/SnapStatusIcon';
import { SnapViewer } from '../snap/SnapViewer';
import { tx } from '../../i18n/tx';
import { pollIntervalMs } from '../../realtimePolicy';
import { useRealtimeEvent, useRealtimeLive } from '../../useRealtime';
import { PushScreen, type PushScreenHandle } from '../ui/PushScreen';

const POLL_INTERVAL_MS = 8000;
const BLOCKS_MAX_AGE_MS = 5 * 60_000;
const AVATAR_SIZE = 48;
const HEADER_AVATAR = 34;
const ROW_GAP = spacing.md;
const NAME_BATCH_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;
const FALLBACK_NAME = tx('chat:list.fallbackName', 'Kullanıcı');

// user id -> user name. Names are public and stable, so successful lookups are kept for the
// whole app session and survive the tab being unmounted and remounted.
const userNameCache = new Map<string, string>();
// Display names (D-032), for searching the list by the name people actually see.
const userDisplayCache = new Map<string, string | null>();
// Chosen avatar per user id (null = none chosen, the client draws the default from the id).
const userAvatarCache = new Map<string, string | null>();

type Props = {
  /** False while the tab is only mounted next to the active one (swipe pager): no polling then. */
  visible?: boolean;
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
  /** Doc B1: a place shared in a conversation opens on the map. */
  onOpenPlace?: (place: BlinkrPlace) => void;
  /** Doc S1: my own avatar in the top-left corner goes to my profile. */
  onOpenProfile?: () => void;
};

/** The row's long-press menu (doc S4) walks through these views inside one sheet. */
type MenuView = 'actions' | 'confirmBlock' | 'report';

/**
 * The chat list, laid out like Snapchat's (doc §3.2): my avatar, search, add friend and new chat on the top row with
 * "Sohbet" in the middle (S1); a search field that narrows the conversations by name and offers other people under
 * them (S2); a long press on a row opens its menu - open, snap, pin, mute, mark read, profile, block, report (S4); up
 * to three pinned conversations sit on top (S3) and muted ones never light the tab-bar dot (S5), both stored per person
 * by the chat service; unread rows carry a count badge and a bold name (S6); with no conversations yet, friends are
 * offered with message and snap (S11). Row swipe actions (S5) are left out on purpose: the chat tab lives in the
 * horizontal tab pager, where a sideways row drag would fight the page swipe.
 */
export function ChatListScreen({ visible = true, auth, onAuthChange, onSessionExpired, onUnreadChange, onConversationOpenChange, snapRequested = false, onSnapHandled, openWith = null, onOpenWithHandled, onOpenProfile, onOpenPlace }: Props) {
  const insets = useSafeAreaInsets();
  const [allConversations, setConversations] = useState<Conversation[]>([]);
  // People I blocked stay out of my list; the server refuses their messages anyway.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [profileUser, setProfileUser] = useState<UserSummary | null>(null);
  const conversations = useMemo(() => orderConversations(allConversations.filter((item) => !blockedIds.has(item.otherUserId))), [allConversations, blockedIds]);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewMessageOpen, setNewMessageOpen] = useState(false);
  const [isFriendsOpen, setFriendsOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [flow, setFlow] = useState<SnapFlowRequest | null>(null);
  const [viewing, setViewing] = useState<{ conversation: Conversation; messageId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(userNameCache));
  // S2: search mode.
  const [isSearching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  // S4: the row whose menu is open, and where in the menu we are.
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  const [menuView, setMenuView] = useState<MenuView>('actions');
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  // S11: friends offered while the list is empty (null = not loaded yet).
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const pollInFlight = useRef(false);
  const blocksReadAt = useRef(0);
  const hasSettled = useRef(false);
  const searchInput = useRef<TextInput>(null);
  // Ids already looked up by this screen instance. A failed lookup (e.g. a deleted user) is not
  // retried on every poll; it is tried again the next time the screen is opened.
  const requestedNames = useRef(new Set<string>());
  const refreshHandlers = useMemo(() => ({ onAuthRefresh: onAuthChange, onSessionExpired }), [onAuthChange, onSessionExpired]);

  const rememberUser = useCallback((user: UserSummary) => {
    userNameCache.set(user.id, user.userName);
    userAvatarCache.set(user.id, user.avatarKey ?? null);
    if (user.displayName !== undefined) userDisplayCache.set(user.id, user.displayName ?? null);
  }, []);

  const resolveNames = useCallback(async (items: Conversation[]) => {
    const missing = [...new Set(items.map((item) => item.otherUserId))]
      .filter((id) => !userNameCache.has(id) && !requestedNames.current.has(id))
      .slice(0, NAME_BATCH_SIZE);
    if (!missing.length) return;
    missing.forEach((id) => requestedNames.current.add(id));

    // One batch call for every row (doc §2.4: one request per row showed "Kullanıcı" first).
    let found: Awaited<ReturnType<typeof getUsersBatch>> = [];
    try { found = await getUsersBatch(auth, missing, undefined, refreshHandlers); } catch { return; }
    found.forEach((person) => rememberUser(person));
    if (found.length > 0) setNames(Object.fromEntries(userNameCache));
  }, [auth, refreshHandlers, rememberUser]);

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
      // Blocks rarely change: read them on a real refresh and at most every 5 minutes, not on every poll.
      if (!background || Date.now() - blocksReadAt.current > BLOCKS_MAX_AGE_MS) {
        blocksReadAt.current = Date.now();
        listBlocks(auth, undefined, refreshHandlers)
          .then((rows) => setBlockedIds(new Set(rows.map((row) => row.id))))
          .catch(() => { blocksReadAt.current = 0; /* the list still works; sending is refused by the server anyway */ });
      }
      console.log('[Blinkr Chat]', { status: 'ready', resultCount: items.length });
      void resolveNames(items);
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      if (!background) setError(friendlyError(err, tx('chat:list.loadFailed', 'Sohbetler yüklenemedi. Tekrar dene.')));
    } finally {
      pollInFlight.current = false;
      hasSettled.current = true;
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  }, [auth, onAuthChange, onSessionExpired, refreshHandlers, resolveNames]);

  // `refresh` changes identity when the session token is refreshed; reload quietly in that
  // case instead of flashing the full-screen spinner again.
  useEffect(() => {
    refresh(hasSettled.current);
  }, [refresh]);

  // The conversation screen owns its own faster poll, so the list poll pauses while one is
  // open, and ticks are skipped while the app is not in the foreground.
  // V2-5 (D-028): with the realtime hub connected, the list follows its events and polls only as a safety net.
  const live = useRealtimeLive();
  // Back on screen: catch up once, then poll while visible.
  useEffect(() => { if (visible && hasSettled.current) refresh(true); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeConversation || !visible) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh(true);
    }, pollIntervalMs(live, POLL_INTERVAL_MS));
    return () => clearInterval(timer);
  }, [refresh, activeConversation, live, visible]);
  const refreshOnEvent = () => { if (!activeConversation) refresh(true); };
  useRealtimeEvent('message.created', refreshOnEvent);
  useRealtimeEvent('message.updated', refreshOnEvent);
  useRealtimeEvent('message.read', refreshOnEvent);

  useEffect(() => {
    onUnreadChange?.(hasAttentionUnread(conversations));
  }, [conversations, onUnreadChange]);

  useEffect(() => {
    // The camera, the snap sender, the snap viewer and the friends page each own the whole screen, like an open conversation.
    onConversationOpenChange?.(Boolean(activeConversation) || Boolean(flow) || Boolean(viewing) || Boolean(profileUser) || isFriendsOpen);
    return () => onConversationOpenChange?.(false);
  }, [activeConversation, flow, viewing, profileUser, isFriendsOpen, onConversationOpenChange]);

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

  // S2: other people for the query, debounced; a newer query cancels the older request.
  useEffect(() => {
    const q = query.trim();
    if (!isSearching || q.length < PEOPLE_QUERY_MIN) { setPeople([]); setPeopleLoading(false); return undefined; }
    const controller = new AbortController();
    setPeopleLoading(true);
    const timer = setTimeout(() => {
      searchUsers(auth, q, controller.signal)
        .then((found) => { if (!controller.signal.aborted) setPeople(found); })
        .catch(() => { if (!controller.signal.aborted) setPeople([]); /* the conversations above still filter */ })
        .finally(() => { if (!controller.signal.aborted) setPeopleLoading(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [auth, isSearching, query]);

  const closeSearch = useCallback(() => { setSearching(false); setQuery(''); searchInput.current?.blur(); }, []);

  // Android back leaves the search before the app shell takes the tab back to the map.
  useEffect(() => {
    if (!isSearching || !visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeSearch(); return true; });
    return () => subscription.remove();
  }, [closeSearch, isSearching, visible]);

  // S11: with nothing to list, offer friends to start with.
  const total = conversations.length;
  useEffect(() => {
    if (isLoading || error || total > 0 || friends !== null) return undefined;
    const controller = new AbortController();
    listFriends(auth, controller.signal, refreshHandlers)
      .then((list) => { if (!controller.signal.aborted) setFriends(list.filter((friend) => !blockedIds.has(friend.id))); })
      .catch(() => { if (!controller.signal.aborted) setFriends([]); });
    return () => controller.abort();
  }, [auth, blockedIds, error, friends, isLoading, refreshHandlers, total]);

  const openConversationWith = async (user: UserSummary) => {
    setNewMessageOpen(false);
    closeSearch();
    // The search result already carries the name; no extra lookup is needed.
    rememberUser(user);
    setNames(Object.fromEntries(userNameCache));
    try {
      const conversation = await startConversation(auth, user.id, onAuthChange, onSessionExpired);
      setActiveConversation(conversation);
    } catch (err) {
      setError(friendlyError(err, tx('chat:list.startFailed', 'Konuşma başlatılamadı. Tekrar dene.')));
    }
  };

  /** S11: a snap to someone without a conversation yet starts one first, then opens the camera. */
  const snapTo = async (user: UserSummary) => {
    rememberUser(user);
    setNames(Object.fromEntries(userNameCache));
    try {
      const conversation = await startConversation(auth, user.id, onAuthChange, onSessionExpired);
      setFlow({ mode: 'reply', conversationId: conversation.id });
    } catch (err) {
      setNotice(friendlyError(err, tx('chat:list.startFailed', 'Konuşma başlatılamadı. Tekrar dene.')));
    }
  };

  useEffect(() => {
    if (!openWith) return;
    onOpenWithHandled?.();
    void openConversationWith(openWith);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWith]);

  const nameOf = (userId: string) => names[userId] ?? FALLBACK_NAME;

  // ---- S4: row menu -------------------------------------------------------------------------------------------------
  const openMenu = (conversation: Conversation) => { setMenuView('actions'); setMenuError(null); setMenuFor(conversation); };
  const closeMenu = () => { setMenuFor(null); setMenuView('actions'); setMenuBusy(false); setMenuError(null); };

  const markRead = async (conversation: Conversation) => {
    closeMenu();
    // Optimistic: the badge goes at once; the next poll brings the server's truth either way.
    setConversations((current) => current.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item)));
    try { await markConversationRead(auth, conversation.id, onAuthChange, onSessionExpired); } catch { /* the poll restores the real count */ }
    refresh(true);
  };

  /** S3/S5: optimistic, then the server's answer; a refused pin (limit) or a failure puts the row back as it was. */
  const changePreferences = async (conversation: Conversation, change: { pinned?: boolean; muted?: boolean }) => {
    closeMenu();
    if (change.pinned && !conversation.isPinned && pinnedCount(conversations) >= MAX_PINNED) {
      setNotice(tx('chat:list.pinLimit', 'En fazla {{count}} sohbet sabitlenebilir', { count: MAX_PINNED }));
      return;
    }
    const before = { isPinned: conversation.isPinned, pinnedAtUtc: conversation.pinnedAtUtc, isMuted: conversation.isMuted };
    const patch = (values: Partial<Conversation>) =>
      setConversations((current) => current.map((item) => (item.id === conversation.id ? { ...item, ...values } : item)));
    patch({
      ...(change.pinned !== undefined ? { isPinned: change.pinned, pinnedAtUtc: change.pinned ? new Date().toISOString() : null } : {}),
      ...(change.muted !== undefined ? { isMuted: change.muted } : {}),
    });
    try {
      const saved = await updateConversationPreferences(auth, conversation.id, change, refreshHandlers);
      patch({ isPinned: saved.isPinned, pinnedAtUtc: saved.pinnedAtUtc ?? null, isMuted: saved.isMuted });
      if (change.muted !== undefined) setNotice(saved.isMuted ? tx('chat:list.mutedNotice', 'Sessize alındı') : tx('chat:list.unmutedNotice', 'Sesi açıldı'));
    } catch (err) {
      patch(before);
      const limit = (err as { status?: number })?.status === 409;
      setNotice(limit
        ? tx('chat:list.pinLimit', 'En fazla {{count}} sohbet sabitlenebilir', { count: MAX_PINNED })
        : friendlyError(err, tx('chat:list.preferenceFailed', 'Ayar kaydedilemedi. Tekrar dene.')));
    }
  };

  const block = async (conversation: Conversation) => {
    if (menuBusy) return;
    setMenuBusy(true);
    setMenuError(null);
    try {
      await blockUser(auth, conversation.otherUserId, refreshHandlers);
      setBlockedIds((current) => new Set(current).add(conversation.otherUserId));
      success();
      setNotice(tx('chat:list.blocked', '{{name}} engellendi', { name: nameOf(conversation.otherUserId) }));
      closeMenu();
    } catch (err) {
      setMenuError(friendlyError(err, tx('chat:list.blockFailed', 'Engellenemedi. Tekrar dene.')));
      setMenuBusy(false);
    }
  };

  const recipients: SnapRecipient[] = conversations.map((item) => ({ id: item.id, name: nameOf(item.otherUserId), userId: item.otherUserId, avatarKey: userAvatarCache.get(item.otherUserId) }));
  const overlays = (
    <>
      {isFriendsOpen ? (
        <FriendsScreen
          auth={auth}
          initialTab="add"
          onAuthChange={onAuthChange}
          onBack={() => setFriendsOpen(false)}
          onMessage={(user) => { setFriendsOpen(false); void openConversationWith(user); }}
          onSessionExpired={onSessionExpired}
        />
      ) : null}
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
          senderName={nameOf(viewing.conversation.otherUserId)}
        />
      ) : null}
      {flow ? (
        <SnapFlow
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setFlow(null)}
          onSent={(count) => { setFlow(null); setNotice(count > 1 ? tx('chat:list.snapSentMany', 'Snap {{count}} kişiye gönderildi', { count }) : tx('chat:list.snapSent', 'Snap gönderildi')); refresh(true); }}
          onSessionExpired={onSessionExpired}
          recipients={recipients}
          request={flow}
        />
      ) : null}
    </>
  );

  const conversationPage = useRef<PushScreenHandle>(null);
  const shown = useMemo(
    () => (isSearching ? filterConversations(conversations, (id) => (userNameCache.has(id) ? { userName: userNameCache.get(id), displayName: userDisplayCache.get(id) } : undefined), query) : conversations),
    // `names` changes whenever the caches learn someone new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, isSearching, query, names],
  );
  const others = useMemo(() => otherPeople(people, conversations, auth.userId), [people, conversations, auth.userId]);
  const searchActive = isSearching && query.trim().length > 0;

  const renderRow = ({ item }: { item: Conversation }) => {
    const name = nameOf(item.otherUserId);
    const status = conversationStatus(item, auth.userId);
    const when = formatAge(item.lastMessageAtUtc);
    const badge = unreadBadge(item.unreadCount);
    const openRow = () => {
      closeSearch();
      // Like Snapchat: a waiting snap opens straight into the viewer; everything else opens the conversation.
      if (status.opensSnap && item.lastMessageId) setViewing({ conversation: item, messageId: item.lastMessageId });
      else setActiveConversation(item);
    };
    return (
      <Animated.View entering={FadeIn.duration(motion.base)}>
        <View style={styles.row}>
          <AnimatedPressable
            accessibilityHint={tx('chat:list.menuHint', 'Seçenekler için basılı tut')}
            accessibilityLabel={badge ? `${conversationLabel(name, status, when)}. ${tx('chat:list.unreadA11y', '{{count}} okunmamış', { count: item.unreadCount ?? 0 })}` : conversationLabel(name, status, when)}
            accessibilityRole="button"
            delayLongPress={350}
            onLongPress={() => openMenu(item)}
            onPress={openRow}
            pressScale={0.99}
            style={styles.rowMain}
          >
            <Avatar avatarKey={userAvatarCache.get(item.otherUserId)} seed={item.otherUserId} userId={item.otherUserId} size={AVATAR_SIZE} />
            <View style={styles.rowBody}>
              <View style={styles.nameLine}>
                <Text numberOfLines={1} style={[styles.name, badge && styles.nameUnread]}>{name}</Text>
                {item.isMuted ? <BellOff accessibilityLabel={tx('chat:list.mutedA11y', 'Sessizde')} color={colors.textSecondary} size={14} /> : null}
              </View>
              <View style={styles.statusLine}>
                <SnapStatusIcon filled={status.filled} icon={status.icon} tone={status.tone} />
                <Text numberOfLines={1} style={[styles.status, { color: status.tone === 'quiet' ? colors.textSecondary : statusColor(status.tone) }, status.filled && styles.statusNew]}>{status.label}</Text>
                <Text style={styles.when}>· {when}</Text>
              </View>
            </View>
            {item.isPinned ? <Pin accessibilityLabel={tx('chat:list.pinnedA11y', 'Sabitlendi')} color={colors.textSecondary} size={15} testID={`pinned-${item.id}`} /> : null}
            {badge ? <View style={[styles.badge, item.isMuted && styles.badgeMuted]} testID={`unread-${item.id}`}><Text style={[styles.badgeText, item.isMuted && styles.badgeTextMuted]}>{badge}</Text></View> : null}
          </AnimatedPressable>
          <AnimatedPressable accessibilityLabel={tx('chat:list.snapToA11y', '{{name}} kişisine Snap gönder', { name })} accessibilityRole="button" hitSlop={6} onPress={() => setFlow({ mode: 'reply', conversationId: item.id })} pressScale={0.95} style={styles.cameraButton}>
            <Camera color={colors.textSecondary} size={18} />
          </AnimatedPressable>
        </View>
      </Animated.View>
    );
  };

  const searchFooter = searchActive ? (
    <View style={styles.othersSection}>
      {query.trim().length >= PEOPLE_QUERY_MIN ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{tx('chat:list.otherPeople', 'Diğer kişiler')}</Text>
          {peopleLoading && !others.length ? <ActivityIndicator color={colors.primary} style={styles.sectionSpinner} /> : null}
          {others.map((person) => (
            <PersonRow
              key={person.id}
              onMessage={() => { void openConversationWith(person); }}
              onSnap={() => { closeSearch(); void snapTo(person); }}
              person={person}
            />
          ))}
          {!peopleLoading && !others.length && !shown.length ? <Text style={styles.noResults}>{tx('chat:list.noResults', '"{{query}}" için kimse bulunamadı', { query: query.trim() })}</Text> : null}
        </>
      ) : !shown.length ? <Text style={styles.noResults}>{tx('chat:list.keepTyping', 'Kişi aramak için biraz daha yaz')}</Text> : null}
    </View>
  ) : null;

  const emptyFriends = friends && friends.length > 0 ? (
    <View style={styles.emptyFriends}>
      <Text accessibilityRole="header" style={styles.emptyTitle}>{tx('chat:list.empty', 'Henüz mesajın yok')}</Text>
      <Text style={styles.emptyHint}>{tx('chat:list.emptyFriendsHint', 'Arkadaşlarından birine yaz ya da Snap gönder.')}</Text>
      {friends.map((friend) => {
        const person: UserSummary = { id: friend.id, userName: friend.userName, avatarKey: friend.avatarKey, relation: 'friends' };
        return <PersonRow key={friend.id} onMessage={() => { void openConversationWith(person); }} onSnap={() => { void snapTo(person); }} person={person} />;
      })}
    </View>
  ) : null;

  const menuName = menuFor ? nameOf(menuFor.otherUserId) : '';

  return <View style={styles.screen}>
    {/* S1: my avatar and search on the left, "Sohbet" in the middle, add friend and new chat on the right. */}
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerSide}>
        <AnimatedPressable accessibilityLabel={tx('chat:list.myProfile', 'Profilim')} accessibilityRole="button" disabled={!onOpenProfile} onPress={() => onOpenProfile?.()} pressScale={0.95} style={styles.headerAvatar}>
          <Avatar avatarKey={auth.avatarKey} photoVersion={auth.photoVersion} seed={auth.userId} size={HEADER_AVATAR} userId={auth.userId} />
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={tx('chat:list.search', 'Sohbetlerde ara')} accessibilityRole="button" onPress={() => { setSearching(true); setTimeout(() => searchInput.current?.focus(), 0); }} pressScale={0.95} style={styles.headerButton} testID="chat-search-button">
          <Search color={colors.text} size={20} />
        </AnimatedPressable>
      </View>
      <Text accessibilityRole="header" style={styles.title}>{tx('chat:list.title', 'Sohbet')}</Text>
      <View style={[styles.headerSide, styles.headerRight]}>
        <AnimatedPressable accessibilityLabel={tx('chat:list.addFriend', 'Arkadaş ekle')} accessibilityRole="button" onPress={() => { closeSearch(); setFriendsOpen(true); }} pressScale={0.95} style={styles.headerButton}>
          <UserPlus color={colors.text} size={20} />
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={tx('chat:list.newMessage', 'Yeni mesaj')} accessibilityRole="button" onPress={() => setNewMessageOpen(true)} pressScale={0.95} style={[styles.headerButton, styles.newButton]}>
          <SquarePen color={colors.primary} size={19} strokeWidth={2} />
        </AnimatedPressable>
      </View>
    </View>

    {isSearching ? (
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Search color={colors.textSecondary} size={17} />
          <TextInput
            accessibilityLabel={tx('chat:list.search', 'Sohbetlerde ara')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={tx('chat:list.searchPlaceholder', 'Ad ile ara')}
            placeholderTextColor={colors.textSecondary}
            ref={searchInput}
            returnKeyType="search"
            style={styles.searchInput}
            testID="chat-search-input"
            value={query}
          />
          {query ? (
            <AnimatedPressable accessibilityLabel={tx('chat:list.clearSearch', 'Aramayı temizle')} accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')} pressScale={0.9}>
              <X color={colors.textSecondary} size={16} />
            </AnimatedPressable>
          ) : null}
        </View>
        <AnimatedPressable accessibilityRole="button" hitSlop={6} onPress={closeSearch} pressScale={0.97}>
          <Text style={styles.cancel}>{tx('common:actions.cancel', 'Vazgeç')}</Text>
        </AnimatedPressable>
      </View>
    ) : null}

    {isLoading ? (
      <SkeletonList rows={6} style={styles.skeleton} />
    ) : error ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          action={{ label: tx('common:actions.retry', 'Tekrar dene'), onPress: () => refresh() }}
          description={error}
          icon={<WifiOff color={colors.textSecondary} size={26} />}
          title={tx('chat:list.openFailed', 'Sohbetler açılamadı')}
        />
      </View>
    ) : !total && !searchActive ? (
      emptyFriends ? (
        <ScrollView contentContainerStyle={{ paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }} showsVerticalScrollIndicator={false}>
          {emptyFriends}
        </ScrollView>
      ) : friends === null ? (
        <SkeletonList rows={4} style={styles.skeleton} />
      ) : (
        <View style={styles.centerFill}>
          <BlinkrEmptyState
            action={{ label: tx('chat:list.addFriend', 'Arkadaş ekle'), onPress: () => setFriendsOpen(true), icon: <UserPlus color={colors.ink} size={18} /> }}
            description={tx('chat:list.emptyHint', 'Bir kullanıcı bul ve konuşmaya başla.')}
            icon={<MessageCircle color={colors.textSecondary} size={26} />}
            title={tx('chat:list.empty', 'Henüz mesajın yok')}
          />
        </View>
      )
    ) : (
      <FlatList
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={searchFooter}
        contentContainerStyle={[styles.list, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        data={shown}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={searchActive ? undefined : <RefreshControl onRefresh={() => { setRefreshing(true); refresh(); }} refreshing={isRefreshing} tintColor={colors.primary} />}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
      />
    )}

    {/* The conversation is pushed over the list (Instagram): the list stays mounted, so swiping back or the back
        arrow returns to the same scroll position. */}
    {activeConversation ? (
      <PushScreen handleHardwareBack={false} onBack={() => { setActiveConversation(null); refresh(true); }} ref={conversationPage} testID="conversation-page">
        <ConversationScreen
          auth={auth}
          conversation={activeConversation}
          otherUserName={nameOf(activeConversation.otherUserId)}
          otherAvatarKey={userAvatarCache.get(activeConversation.otherUserId)}
          onAuthChange={onAuthChange}
          onBack={() => conversationPage.current?.back()}
          onOpenProfile={() => setProfileUser({ id: activeConversation.otherUserId, userName: nameOf(activeConversation.otherUserId), avatarKey: userAvatarCache.get(activeConversation.otherUserId) })}
          onOpenPlace={onOpenPlace}
          onOpenSnap={(messageId) => setViewing({ conversation: activeConversation, messageId })}
          onSendSnap={() => setFlow({ mode: 'reply', conversationId: activeConversation.id })}
          onSessionExpired={onSessionExpired}
        />
      </PushScreen>
    ) : null}
    {overlays}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    {isNewMessageOpen && <Sheet onClose={() => setNewMessageOpen(false)}>
      <BlinkrSheetPanel maxHeightRatio={0.88}>
        <UserSearchSheet auth={auth} onBack={() => setNewMessageOpen(false)} onSelect={openConversationWith} />
      </BlinkrSheetPanel>
    </Sheet>}

    {menuFor ? (
      <Sheet onClose={closeMenu}>
        <BlinkrSheetPanel>
          {menuView === 'report' ? (
            <ReportPanel
              onDone={closeMenu}
              onSubmit={async (reason, note) => { await sendReport(auth, { targetType: 'user', targetId: menuFor.otherUserId, reason, note: note || tx('chat:thread.reportNote', 'Sohbet mesajı') }, refreshHandlers); }}
              subject={menuName}
              target="user"
            />
          ) : menuView === 'confirmBlock' ? (
            <View style={styles.menu}>
              <Text accessibilityRole="header" style={styles.menuTitle}>{tx('chat:list.blockConfirmTitle', '{{name}} engellensin mi?', { name: menuName })}</Text>
              <Text style={styles.menuCopy}>{tx('chat:list.blockConfirmBody', 'Birbirinize mesaj ya da Snap gönderemezsiniz, aramada ve profilde birbirinizi görmezsiniz. {{name}} bunu öğrenmez.', { name: menuName })}</Text>
              {menuError ? <Text accessibilityRole="alert" style={styles.menuError}>{menuError}</Text> : null}
              <AnimatedPressable accessibilityRole="button" aria-disabled={menuBusy} disabled={menuBusy} onPress={() => { void block(menuFor); }} pressScale={0.98} style={[styles.confirmButton, styles.confirmDanger]}>
                {menuBusy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.confirmDangerText}>{tx('chat:list.block', 'Engelle')}</Text>}
              </AnimatedPressable>
              <AnimatedPressable accessibilityRole="button" onPress={() => setMenuView('actions')} pressScale={0.98} style={styles.confirmButton}>
                <Text style={styles.confirmText}>{tx('common:actions.cancel', 'Vazgeç')}</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View accessibilityLabel={tx('chat:list.menuA11y', '{{name}} sohbeti seçenekleri', { name: menuName })} style={styles.menu}>
              <View style={styles.menuHead}>
                <Avatar avatarKey={userAvatarCache.get(menuFor.otherUserId)} seed={menuFor.otherUserId} size={40} userId={menuFor.otherUserId} />
                <Text numberOfLines={1} style={styles.menuName}>{menuName}</Text>
              </View>
              <MenuRow icon={<MessageCircle color={colors.text} size={20} />} label={tx('chat:list.openChat', 'Sohbeti aç')} onPress={() => { const target = menuFor; closeMenu(); setActiveConversation(target); }} />
              <MenuRow icon={<Camera color={colors.text} size={20} />} label={tx('chat:thread.sendSnap', 'Snap gönder')} onPress={() => { const target = menuFor; closeMenu(); setFlow({ mode: 'reply', conversationId: target.id }); }} />
              {menuFor.isPinned
                ? <MenuRow icon={<PinOff color={colors.text} size={20} />} label={tx('chat:list.unpin', 'Sabitlemeyi kaldır')} onPress={() => { void changePreferences(menuFor, { pinned: false }); }} />
                : <MenuRow icon={<Pin color={colors.text} size={20} />} label={tx('chat:list.pin', 'Sabitle')} onPress={() => { void changePreferences(menuFor, { pinned: true }); }} />}
              {menuFor.isMuted
                ? <MenuRow icon={<Bell color={colors.text} size={20} />} label={tx('chat:list.unmute', 'Sesi aç')} onPress={() => { void changePreferences(menuFor, { muted: false }); }} />
                : <MenuRow icon={<BellOff color={colors.text} size={20} />} label={tx('chat:list.mute', 'Sessize al')} onPress={() => { void changePreferences(menuFor, { muted: true }); }} />}
              {canMarkRead(menuFor, auth.userId) ? <MenuRow icon={<CheckCheck color={colors.text} size={20} />} label={tx('chat:list.markRead', 'Okundu işaretle')} onPress={() => { void markRead(menuFor); }} /> : null}
              <MenuRow icon={<UserRound color={colors.text} size={20} />} label={tx('chat:list.viewProfile', 'Profili gör')} onPress={() => { const target = menuFor; closeMenu(); setProfileUser({ id: target.otherUserId, userName: nameOf(target.otherUserId), avatarKey: userAvatarCache.get(target.otherUserId) }); }} />
              <MenuRow danger icon={<Ban color={colors.danger} size={20} />} label={tx('chat:list.block', 'Engelle')} onPress={() => setMenuView('confirmBlock')} />
              <MenuRow danger icon={<Flag color={colors.danger} size={20} />} label={tx('chat:thread.report', 'Bildir')} onPress={() => setMenuView('report')} />
            </View>
          )}
        </BlinkrSheetPanel>
      </Sheet>
    ) : null}
  </View>;
}

/** A person who is not in the list yet (search results, friends on the empty list): message or snap them. */
function PersonRow({ person, onMessage, onSnap }: { person: UserSummary; onMessage: () => void; onSnap: () => void }) {
  const shownName = person.displayName || person.userName;
  return (
    <View style={styles.row}>
      <AnimatedPressable accessibilityLabel={tx('chat:list.messageA11y', '{{name}} ile mesajlaş', { name: person.userName })} accessibilityRole="button" onPress={onMessage} pressScale={0.99} style={styles.rowMain}>
        <Avatar avatarKey={person.avatarKey} photoVersion={person.photoVersion} seed={person.id} size={AVATAR_SIZE} userId={person.id} />
        <View style={styles.rowBody}>
          <Text numberOfLines={1} style={styles.name}>{shownName}</Text>
          {shownName !== person.userName ? <Text numberOfLines={1} style={styles.when}>@{person.userName}</Text> : null}
        </View>
      </AnimatedPressable>
      <AnimatedPressable accessibilityLabel={tx('chat:list.snapToA11y', '{{name}} kişisine Snap gönder', { name: person.userName })} accessibilityRole="button" hitSlop={6} onPress={onSnap} pressScale={0.95} style={styles.cameraButton}>
        <Camera color={colors.textSecondary} size={18} />
      </AnimatedPressable>
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger = false }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <AnimatedPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.98} style={styles.menuRow}>
      {icon}
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', paddingBottom: spacing.sm, paddingHorizontal: spacing.md },
  headerSide: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.xs },
  headerRight: { justifyContent: 'flex-end' },
  headerAvatar: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  headerButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  newButton: { backgroundColor: colors.primaryTint },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  searchField: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flex: 1, flexDirection: 'row', gap: spacing.sm, height: 40, paddingHorizontal: spacing.md },
  searchInput: { ...typography.body, color: colors.text, flex: 1, paddingVertical: 0 },
  cancel: { ...typography.callout, color: colors.primary, fontWeight: '600' },
  centerFill: { flex: 1, justifyContent: 'center' },
  skeleton: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  list: { paddingTop: spacing.xs },
  separator: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: spacing.lg + AVATAR_SIZE + ROW_GAP },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 68, paddingRight: spacing.md },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: ROW_GAP, minHeight: 68, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingVertical: spacing.sm },
  rowBody: { flex: 1, gap: 2 },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...typography.heading, flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '500', lineHeight: 21 },
  nameUnread: { fontWeight: '700' },
  statusLine: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  status: { ...typography.caption, flexShrink: 1 },
  statusNew: { fontWeight: '700' },
  when: { ...typography.caption, color: colors.textSecondary },
  badge: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 22, justifyContent: 'center', minWidth: 22, paddingHorizontal: 6 },
  badgeText: { ...typography.micro, color: colors.ink, fontWeight: '700' },
  // Muted: the count stays readable but quiet, so it does not call for attention.
  badgeMuted: { backgroundColor: colors.surfaceElevated },
  badgeTextMuted: { color: colors.textSecondary },
  cameraButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  othersSection: { paddingTop: spacing.md },
  sectionTitle: { ...typography.callout, color: colors.textSecondary, fontWeight: '600', paddingBottom: spacing.xs, paddingHorizontal: spacing.lg },
  sectionSpinner: { paddingVertical: spacing.md },
  noResults: { ...typography.callout, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, textAlign: 'center' },
  emptyFriends: { paddingTop: spacing.lg },
  emptyTitle: { ...typography.title, color: colors.text, paddingHorizontal: spacing.lg },
  emptyHint: { ...typography.callout, color: colors.textSecondary, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  notice: { ...typography.bodyStrong, alignSelf: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, bottom: 96, color: colors.text, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, position: 'absolute' },
  menu: { gap: 2, paddingBottom: spacing.md },
  menuHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  menuName: { ...typography.heading, color: colors.text, flex: 1 },
  menuRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm },
  menuText: { ...typography.body, color: colors.text },
  menuDanger: { color: colors.danger },
  menuTitle: { ...typography.title, color: colors.text, paddingHorizontal: spacing.sm },
  menuCopy: { ...typography.callout, color: colors.textSecondary, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  menuError: { ...typography.caption, color: colors.danger, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  confirmButton: { alignItems: 'center', borderRadius: radii.pill, height: sizes.buttonMd, justifyContent: 'center', marginTop: spacing.sm },
  confirmDanger: { backgroundColor: colors.danger },
  confirmDangerText: { ...typography.bodyStrong, color: colors.ink },
  confirmText: { ...typography.bodyStrong, color: colors.text },
});
