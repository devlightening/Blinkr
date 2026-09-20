import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMessages, markConversationRead, sendMessage } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, ChatMessage, Conversation } from '../../types';

const POLL_INTERVAL_MS = 4000;
const MAX_MESSAGE_LENGTH = 2000;

const formatClock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

export function ConversationScreen({ auth, conversation, otherUserName, onAuthChange, onSessionExpired, onBack }: {
  auth: AuthResponse;
  conversation: Conversation;
  otherUserName: string;
  onAuthChange: (auth: AuthResponse) => void;
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollInFlight = useRef(false);

  // Android back returns to the conversation list, not out of the app or to the map.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]);

  // The server returns messages newest-first; the list is inverted so the newest message
  // sits at the bottom and no manual scrolling is needed.
  const load = useCallback(async (background = false) => {
    if (background && pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const { items } = await getMessages(auth, conversation.id, undefined, onAuthChange, onSessionExpired);
      setMessages(items);
      setError(null);
      console.log('[Blinkr Chat]', { status: 'ready', resultCount: items.length });
      // Messages that arrive while the conversation is open are read by definition.
      if (items.some((message) => message.senderId !== auth.userId && !message.isRead)) {
        markConversationRead(auth, conversation.id, onAuthChange, onSessionExpired).catch(() => {});
      }
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      if (!background) setError(friendlyError(err, 'Mesajlar yüklenemedi.'));
    } finally {
      pollInFlight.current = false;
      setLoading(false);
    }
  }, [auth, conversation.id, onAuthChange, onSessionExpired]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') load(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setSending(true);
    setDraft('');
    try {
      const sent = await sendMessage(auth, conversation.id, text, onAuthChange, onSessionExpired);
      // A poll may already have returned the message; never show it twice.
      setMessages((prev) => (prev.some((message) => message.id === sent.id) ? prev : [sent, ...prev]));
      setError(null);
    } catch (err) {
      setError(friendlyError(err, 'Mesaj gönderilemedi. Tekrar dene.'));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const initial = otherUserName.slice(0, 1).toLocaleUpperCase('tr-TR');
  const canSend = draft.trim().length > 0 && !isSending;

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.88} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{otherUserName}</Text>
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator accessibilityLabel="Mesajlar yükleniyor" color={colors.mint} /></View>
    ) : !messages.length ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          description={`${otherUserName} ile ilk mesajı sen yaz.`}
          icon={<MessageCircle color={colors.textSecondary} size={32} />}
          title="Henüz mesaj yok"
        />
      </View>
    ) : (
      <FlatList
        contentContainerStyle={styles.listContent}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === auth.userId;
          return <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
              <Text style={[styles.time, isMine && styles.timeMine]}>{formatClock(item.createdAtUtc)}</Text>
            </View>
          </View>;
        }}
        showsVerticalScrollIndicator={false}
      />
    )}

    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <TextInput
        accessibilityLabel="Mesaj yaz"
        maxLength={MAX_MESSAGE_LENGTH}
        multiline
        onChangeText={setDraft}
        placeholder="Mesaj yaz..."
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={draft}
      />
      <AnimatedPressable
        accessibilityLabel="Gönder"
        accessibilityRole="button"
        aria-disabled={!canSend}
        disabled={!canSend}
        onPress={handleSend}
        pressScale={0.88}
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
      >
        {isSending ? <ActivityIndicator color={colors.ink} /> : <Send color={colors.ink} size={22} strokeWidth={2.4} />}
      </AnimatedPressable>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  bar: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.md },
  back: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 2, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { ...typography.bodyStrong, color: colors.text },
  heading: { ...typography.heading, color: colors.text, flex: 1 },
  centerFill: { flex: 1, justifyContent: 'center' },
  listContent: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { borderRadius: radii.card, maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surfaceElevated, borderBottomLeftRadius: 6 },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.ink },
  time: { ...typography.caption, color: colors.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'right' },
  timeMine: { color: colors.ink, opacity: 0.7 },
  error: { ...typography.caption, color: colors.danger, paddingBottom: 6, paddingHorizontal: spacing.md },
  inputBar: { alignItems: 'flex-end', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 120, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 48, justifyContent: 'center', width: 48 },
  sendButtonDisabled: { opacity: 0.4 },
});
