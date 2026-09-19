import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MapPin, MessageCirclePlus, Plus, UserRound } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { listConversations, startConversation } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { Sheet } from '../Sheet';
import { UserSearchSheet } from './UserSearchSheet';
import { ConversationScreen } from './ConversationScreen';
import { colors, radii, shadow, shadowSoft, typography, spacing } from '../../theme';
import type { AuthResponse, Conversation, UserSummary } from '../../types';

const POLL_INTERVAL_MS = 8000;

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}sa`;
  return `${Math.round(diffHr / 24)}g`;
};

export function ChatListScreen({ auth, onAuthChange, onSessionExpired, onOpenMap }: {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onOpenMap: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const items = await listConversations(auth, onAuthChange, onSessionExpired);
      setConversations(items);
      setError(null);
      console.log('[Blinkr Chat]', { status: 'ready', resultCount: items.length });
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      if (!background) setError(friendlyError(err, 'Sohbetler yüklenemedi. Tekrar dene.'));
    } finally {
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  }, [auth, onAuthChange, onSessionExpired]);

  useEffect(() => {
    refresh();
    pollTimer.current = setInterval(() => refresh(true), POLL_INTERVAL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [refresh]);

  const openConversationWith = async (user: UserSummary) => {
    setSearchOpen(false);
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
      <View style={styles.centerFill}><Text style={styles.errorText}>{error}</Text></View>
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
        {conversations.map((conversation, index) => (
          <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 10) * 30)} key={conversation.id}>
            <AnimatedPressable accessibilityLabel="Konuşmayı aç" onPress={() => setActiveConversation(conversation)} pressScale={0.97} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>?</Text></View>
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={styles.rowPreview}>{conversation.lastMessagePreview || 'Yeni konuşma'}</Text>
              </View>
              <Text style={styles.rowWhen}>{formatWhen(conversation.lastMessageAtUtc)}</Text>
            </AnimatedPressable>
          </Animated.View>
        ))}
      </ScrollView>
    )}

    <View pointerEvents="box-none" style={[styles.bottomNavWrap, { bottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bottomNav}>
        <AnimatedPressable accessibilityLabel="Harita" onPress={onOpenMap} pressScale={0.92} style={styles.navItem}>
          <MapPin color={colors.muted} size={21} strokeWidth={2.3} />
          <Text style={styles.navLabel}>Harita</Text>
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel="Yeni mesaj" onPress={() => setSearchOpen(true)} pressScale={0.88} style={styles.createButton}>
          <Plus color={colors.ink} size={25} strokeWidth={3} />
        </AnimatedPressable>
      </View>
    </View>

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
  rowPreview: { ...typography.body, color: colors.textPrimary },
  rowWhen: { ...typography.caption, color: colors.muted },
  bottomNavWrap: { alignItems: 'center', left: 12, position: 'absolute', right: 12 },
  bottomNav: { alignItems: 'center', backgroundColor: 'rgba(15,20,16,0.94)', borderColor: 'rgba(244,247,241,0.08)', borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', height: 68, justifyContent: 'space-around', maxWidth: 420, paddingHorizontal: 12, width: '100%', ...shadow },
  navItem: { alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 72 },
  navLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  createButton: { alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.ink, borderRadius: radii.control, borderWidth: 2, height: 52, justifyContent: 'center', width: 58, ...shadowSoft },
  searchPanel: { backgroundColor: colors.surface, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, maxHeight: '88%', minHeight: '60%', paddingHorizontal: 20, paddingTop: 9, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 2, height: 4, marginBottom: 8, width: 38 },
});
