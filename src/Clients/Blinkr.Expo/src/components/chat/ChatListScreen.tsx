import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MessageCirclePlus, Plus, UserRound } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUser, listConversations, startConversation } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { Sheet } from '../Sheet';
import { UserSearchSheet } from './UserSearchSheet';
import { ConversationScreen } from './ConversationScreen';
import { colors, radii, shadow, shadowSoft, typography, spacing } from '../../theme';
import type { AuthResponse, Conversation, UserSummary } from '../../types';

const POLL_INTERVAL_MS = 8000;
const NAME_BATCH_SIZE = 30;
const FALLBACK_NAME = 'Kullanıcı';

// user id -> user name. Names are public and stable, so successful lookups are kept for the
// whole app session and survive the tab being unmounted and remounted.
const userNameCache = new Map<string, string>();

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}sa`;
  return `${Math.round(diffHr / 24)}g`;
};

export function ChatListScreen({ auth, onAuthChange, onSessionExpired }: {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
}) {
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

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.title}>Sohbet</Text>
      <AnimatedPressable accessibilityLabel="Yeni mesaj" onPress={() => setSearchOpen(true)} pressScale={0.9} style={styles.newButton}>
        <MessageCirclePlus color={colors.ink} size={20} strokeWidth={2.4} />
      </AnimatedPressable>
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator color={colors.green} /></View>
    ) : error ? (
      <View style={styles.centerFill}>
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
        <AnimatedPressable accessibilityLabel="Tekrar dene" onPress={() => refresh()} pressScale={0.95} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>Tekrar dene</Text>
        </AnimatedPressable>
      </View>
    ) : !conversations.length ? (
      <View style={styles.centerFill}>
        <UserRound color={colors.mutedSoft} size={40} />
        <Text style={styles.emptyTitle}>Henüz mesajın yok</Text>
        <Text style={styles.emptyText}>Bir kullanıcı bul ve konuşmaya başla.</Text>
        <AnimatedPressable onPress={() => setSearchOpen(true)} pressScale={0.95} style={styles.emptyAction}>
          <Plus color={colors.ink} size={16} strokeWidth={2.6} />
          <Text style={styles.emptyActionText}>Yeni mesaj</Text>
        </AnimatedPressable>
      </View>
    ) : (
      <ScrollView
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); refresh(); }} refreshing={isRefreshing} tintColor={colors.green} />}
      >
        {conversations.map((conversation, index) => {
          const name = names[conversation.otherUserId] ?? FALLBACK_NAME;
          return (
            <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 10) * 30)} key={conversation.id}>
              <AnimatedPressable accessibilityLabel={`${name} ile konuşmayı aç`} onPress={() => setActiveConversation(conversation)} pressScale={0.97} style={styles.row}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowName}>{name}</Text>
                  <Text numberOfLines={1} style={styles.rowPreview}>{conversation.lastMessagePreview || 'Yeni konuşma'}</Text>
                </View>
                <Text style={styles.rowWhen}>{formatWhen(conversation.lastMessageAtUtc)}</Text>
              </AnimatedPressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    )}

    {isSearchOpen && <Sheet onClose={() => setSearchOpen(false)}>
      <View style={[styles.searchPanel, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.handle} />
        <UserSearchSheet auth={auth} onBack={() => setSearchOpen(false)} onSelect={openConversationWith} />
      </View>
    </Sheet>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  newButton: { alignItems: 'center', backgroundColor: colors.lime, borderRadius: radii.control, height: 42, justifyContent: 'center', width: 42, ...shadowSoft },
  centerFill: { alignItems: 'center', flex: 1, gap: 8, justifyContent: 'center', paddingHorizontal: 36 },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center' },
  emptyTitle: { ...typography.heading, color: colors.textPrimary, marginTop: 8 },
  emptyText: { ...typography.body, color: colors.muted, textAlign: 'center' },
  emptyAction: { alignItems: 'center', backgroundColor: colors.lime, borderRadius: radii.pill, flexDirection: 'row', gap: 6, marginTop: 14, paddingHorizontal: 18, paddingVertical: 12 },
  emptyActionText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.control, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  rowBody: { flex: 1 },
  rowName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  rowPreview: { ...typography.caption, color: colors.muted, marginTop: 2 },
  rowWhen: { ...typography.caption, color: colors.muted },
  searchPanel: { backgroundColor: colors.surface, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, maxHeight: '88%', minHeight: '60%', paddingHorizontal: 20, paddingTop: 9, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 2, height: 4, marginBottom: 8, width: 38 },
});
