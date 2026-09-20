import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, MessageCircle, SquarePen, WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUser, listConversations, startConversation } from '../../api';
import { formatAge } from '../../presentation';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { Sheet } from '../Sheet';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { bottomBarClearance } from '../ui/BlinkrBottomBar';
import { UserSearchSheet } from './UserSearchSheet';
import { ConversationScreen } from './ConversationScreen';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import type { AuthResponse, Conversation, UserSummary } from '../../types';

const POLL_INTERVAL_MS = 8000;
const NAME_BATCH_SIZE = 30;
const FALLBACK_NAME = 'Kullanıcı';

// user id -> user name. Names are public and stable, so successful lookups are kept for the
// whole app session and survive the tab being unmounted and remounted.
const userNameCache = new Map<string, string>();

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  /** True while any conversation has messages this user has not read (drives the tab-bar dot). */
  onUnreadChange?: (hasUnread: boolean) => void;
  /** A conversation screen owns the whole tab, so the app shell hides its bar and shows the composer. */
  onConversationOpenChange?: (open: boolean) => void;
};

export function ChatListScreen({ auth, onAuthChange, onSessionExpired, onUnreadChange, onConversationOpenChange }: Props) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
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
    onConversationOpenChange?.(Boolean(activeConversation));
    return () => onConversationOpenChange?.(false);
  }, [activeConversation, onConversationOpenChange]);

  const openConversationWith = async (user: UserSummary) => {
    setSearchOpen(false);
    // The search result already carries the name; no extra lookup is needed.
    userNameCache.set(user.id, user.userName);
    setNames(Object.fromEntries(userNameCache));
    try {
      const conversation = await startConversation(auth, user.id, onAuthChange, onSessionExpired);
      setActiveConversation(conversation);
    } catch (err) {
      setError(friendlyError(err, 'Konuşma başlatılamadı. Tekrar dene.'));
    }
  };

  if (activeConversation) {
    return <ConversationScreen
      auth={auth}
      conversation={activeConversation}
      otherUserName={names[activeConversation.otherUserId] ?? FALLBACK_NAME}
      onAuthChange={onAuthChange}
      onBack={() => { setActiveConversation(null); refresh(true); }}
      onSessionExpired={onSessionExpired}
    />;
  }

  const total = conversations.length;

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>Sohbet</Text>
        {total > 0 && <Text style={styles.subtitle}>{total} konuşma</Text>}
      </View>
      <AnimatedPressable accessibilityLabel="Yeni mesaj" accessibilityRole="button" onPress={() => setSearchOpen(true)} pressScale={0.9} style={styles.newButton}>
        <SquarePen color={colors.ink} size={26} strokeWidth={2.3} />
      </AnimatedPressable>
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator accessibilityLabel="Yükleniyor" color={colors.mint} /></View>
    ) : error ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          action={{ label: 'Tekrar dene', onPress: () => refresh() }}
          description={error}
          icon={<WifiOff color={colors.textSecondary} size={32} />}
          title="Sohbetler açılamadı"
        />
      </View>
    ) : !total ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          action={{ label: 'Yeni mesaj', onPress: () => setSearchOpen(true), icon: <SquarePen color={colors.ink} size={20} /> }}
          description="Bir kullanıcı bul ve konuşmaya başla."
          icon={<MessageCircle color={colors.textSecondary} size={34} />}
          title="Henüz mesajın yok"
        />
      </View>
    ) : (
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); refresh(); }} refreshing={isRefreshing} tintColor={colors.mint} />}
        renderItem={({ item, index }) => {
          const name = names[item.otherUserId] ?? FALLBACK_NAME;
          const unread = item.unreadCount ?? 0;
          const mine = item.lastMessageSenderId === auth.userId;
          return (
            <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 10) * 30)}>
              <AnimatedPressable
                accessibilityLabel={unread > 0 ? `${name} ile konuşma, ${unread} okunmamış mesaj` : `${name} ile konuşmayı aç`}
                accessibilityRole="button"
                onPress={() => setActiveConversation(item)}
                pressScale={0.98}
                style={[styles.card, unread > 0 && styles.cardUnread]}
              >
                <View style={[styles.avatar, unread > 0 && styles.avatarUnread]}>
                  <Text style={styles.avatarText}>{name.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text numberOfLines={1} style={styles.name}>{name}</Text>
                    <Text style={styles.when}>{formatAge(item.lastMessageAtUtc)}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>
                    {item.lastMessagePreview ? `${mine ? 'Sen: ' : ''}${item.lastMessagePreview}` : 'Yeni konuşma'}
                  </Text>
                </View>
                <View style={styles.cardEnd}>
                  {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
                  <ChevronRight color={colors.textSecondary} size={22} />
                </View>
              </AnimatedPressable>
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    )}

    {isSearchOpen && <Sheet onClose={() => setSearchOpen(false)}>
      <BlinkrSheetPanel maxHeightRatio={0.88}>
        <UserSearchSheet auth={auth} onBack={() => setSearchOpen(false)} onSelect={openConversationWith} />
      </BlinkrSheetPanel>
    </Sheet>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  headerCopy: { flex: 1 },
  title: { ...typography.headline, color: colors.text, fontSize: 34, lineHeight: 40 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  newButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.lg, height: 60, justifyContent: 'center', width: 60, ...shadowSoft },
  centerFill: { flex: 1, justifyContent: 'center' },
  list: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 88, padding: spacing.md },
  cardUnread: { borderColor: colors.primary },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 2, height: 60, justifyContent: 'center', width: 60 },
  avatarUnread: { borderColor: colors.primary },
  avatarText: { ...typography.title, color: colors.text },
  cardBody: { flex: 1, gap: 2 },
  cardTop: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  name: { ...typography.heading, color: colors.text, flexShrink: 1 },
  when: { ...typography.caption, color: colors.textSecondary },
  preview: { ...typography.body, color: colors.textSecondary },
  previewUnread: { color: colors.text, fontWeight: '600' },
  cardEnd: { alignItems: 'center', gap: spacing.xs },
  badge: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 26, justifyContent: 'center', minWidth: 26, paddingHorizontal: 7 },
  badgeText: { ...typography.label, color: colors.ink, letterSpacing: 0 },
});
