import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Send } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMessages, markConversationRead, sendMessage } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { colors, radii, shadowSoft, typography, spacing } from '../../theme';
import type { AuthResponse, ChatMessage, Conversation } from '../../types';

const POLL_INTERVAL_MS = 4000;

export function ConversationScreen({ auth, conversation, onAuthChange, onSessionExpired, onBack }: {
  auth: AuthResponse;
  conversation: Conversation;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (background = false) => {
    try {
      const { items } = await getMessages(auth, conversation.id, undefined, onAuthChange, onSessionExpired);
      setMessages([...items].reverse());
      setError(null);
      console.log('[Blinkr Chat]', { status: 'ready', resultCount: items.length });
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      if (!background) setError(friendlyError(err, 'Mesajlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [auth, conversation.id, onAuthChange, onSessionExpired]);

  useEffect(() => {
    load();
    markConversationRead(auth, conversation.id, onAuthChange, onSessionExpired).catch(() => {});
    pollTimer.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [load, auth, conversation.id, onAuthChange, onSessionExpired]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setSending(true);
    setDraft('');
    try {
      const sent = await sendMessage(auth, conversation.id, text, onAuthChange, onSessionExpired);
      setMessages((prev) => [...prev, sent]);
    } catch (err) {
      setError(friendlyError(err, 'Mesaj gönderilemedi. Tekrar dene.'));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <View style={styles.bar}>
      <AnimatedPressable accessibilityLabel="Geri dön" onPress={onBack} pressScale={0.88} style={styles.icon}><ArrowLeft color={colors.textPrimary} /></AnimatedPressable>
      <Text style={styles.heading}>Sohbet</Text>
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator color={colors.green} /></View>
    ) : (
      <FlatList
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === auth.userId;
          return <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
            </View>
          </View>;
        }}
      />
    )}

    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          accessibilityLabel="Mesaj yaz"
          maxLength={2000}
          multiline
          onChangeText={setDraft}
          placeholder="Mesaj yaz..."
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={draft}
        />
        <AnimatedPressable
          accessibilityLabel="Gönder"
          disabled={!draft.trim() || isSending}
          onPress={handleSend}
          pressScale={0.88}
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
        >
          <Send color={colors.ink} size={18} strokeWidth={2.4} />
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface, flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginVertical: spacing.sm },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { ...typography.heading, color: colors.textPrimary },
  centerFill: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { borderRadius: radii.card, maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.lime, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surfaceSoft, borderBottomLeftRadius: 6 },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.ink },
  error: { ...typography.caption, color: colors.error, paddingHorizontal: spacing.md, paddingBottom: 6 },
  inputBar: { alignItems: 'flex-end', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingTop: 10 },
  input: { ...typography.body, backgroundColor: colors.surfaceSoft, borderRadius: radii.control, color: colors.textPrimary, flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10 },
  sendButton: { alignItems: 'center', backgroundColor: colors.lime, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 44, ...shadowSoft },
  sendButtonDisabled: { opacity: 0.45 },
});
