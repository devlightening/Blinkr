import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Camera, MessageCircle, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMessages, markConversationRead, sendMessage } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, ChatMessage, Conversation } from '../../types';
import { Avatar } from '../Avatar';
import { snapRow } from '../../snapPresentation';
import { SnapStatusIcon, statusColor } from '../snap/SnapStatusIcon';

const POLL_INTERVAL_MS = 4000;
const MAX_MESSAGE_LENGTH = 2000;

const formatClock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

export function ConversationScreen({ auth, conversation, otherUserName, otherAvatarKey, onAuthChange, onSessionExpired, onBack, onOpenSnap, onSendSnap, onOpenProfile }: {
  auth: AuthResponse;
  conversation: Conversation;
  otherUserName: string;
  /** Chosen avatar of the other person (null/absent = default drawn from their id). */
  otherAvatarKey?: string | null;
  onAuthChange: (auth: AuthResponse) => void;
  onBack: () => void;
  /** Opens the other person's profile (block, report, friend actions live there). */
  onOpenProfile?: () => void;
  /** Opens a waiting snap in the full-screen viewer. */
  onOpenSnap?: (messageId: string) => void;
  /** Opens the camera to send a snap to this person. */
  onSendSnap?: () => void;
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
      if (items.some((message) => message.kind !== 'snap' && message.senderId !== auth.userId && !message.isRead)) {
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

  const canSend = draft.trim().length > 0 && !isSending;

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <AnimatedPressable accessibilityLabel={`${otherUserName}, profili aç`} accessibilityRole="button" disabled={!onOpenProfile} onPress={() => onOpenProfile?.()} pressScale={0.98} style={styles.identity}>
        <Avatar avatarKey={otherAvatarKey} seed={conversation.otherUserId} size={36} />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{otherUserName}</Text>
      </AnimatedPressable>
      {onSendSnap ? (
        <AnimatedPressable accessibilityLabel={`${otherUserName} kişisine Snap gönder`} accessibilityRole="button" onPress={onSendSnap} pressScale={0.95} style={styles.headerCamera}>
          <Camera color={colors.text} size={20} />
        </AnimatedPressable>
      ) : null}
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator accessibilityLabel="Mesajlar yükleniyor" color={colors.primary} /></View>
    ) : !messages.length ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState
          description={`${otherUserName} ile ilk mesajı sen yaz.`}
          icon={<MessageCircle color={colors.textSecondary} size={26} />}
          title="Henüz mesaj yok"
        />
      </View>
    ) : (
      <FlatList
        contentContainerStyle={styles.listContent}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isMine = item.senderId === auth.userId;
          const older = messages[index + 1];
          const tone = isMine ? colors.blue : colors.pink;
          const snap = snapRow(item, auth.userId);
          // The list is inverted, so the next item in the array is the OLDER message: a label starts each run.
          const startsRun = !older || older.senderId !== item.senderId || (older.kind === 'snap') !== (item.kind === 'snap');
          if (snap) {
            const content = (
              <>
                <SnapStatusIcon filled={snap.filled} icon={snap.icon} tone={snap.tone} />
                <Text style={[styles.snapTitle, { color: snap.tone === 'quiet' ? colors.textSecondary : statusColor(snap.tone) }]}>{snap.title}</Text>
                <Text style={styles.snapStatus}>{snap.status}</Text>
                <Text style={styles.snapTime}>{formatClock(item.createdAtUtc)}</Text>
              </>
            );
            return snap.tappable && onOpenSnap ? (
              <AnimatedPressable accessibilityLabel={`${snap.title}, ${snap.status}`} accessibilityRole="button" onPress={() => onOpenSnap(item.id)} pressScale={0.99} style={styles.snapLine}>{content}</AnimatedPressable>
            ) : <View accessibilityLabel={`${snap.title}, ${snap.status}`} style={styles.snapLine}>{content}</View>;
          }
          return (
            <View style={styles.line}>
              <View style={[styles.lineBar, { backgroundColor: tone }]} />
              <View style={styles.lineBody}>
                {startsRun ? <Text style={[styles.label, { color: tone }]}>{isMine ? 'Ben' : otherUserName}</Text> : null}
                <Text style={styles.lineText}>{item.text}</Text>
              </View>
              <Text style={styles.lineTime}>{formatClock(item.createdAtUtc)}</Text>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    )}

    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {onSendSnap ? (
        <AnimatedPressable accessibilityLabel="Snap gönder" accessibilityRole="button" onPress={onSendSnap} pressScale={0.95} style={styles.cameraButton}>
          <Camera color={colors.text} size={20} />
        </AnimatedPressable>
      ) : null}
      <TextInput
        accessibilityLabel="Mesaj yaz"
        maxLength={MAX_MESSAGE_LENGTH}
        multiline
        onChangeText={setDraft}
        placeholder="Mesaj"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={draft}
      />
      {draft.trim().length > 0 || isSending ? (
        <AnimatedPressable
          accessibilityLabel="Gönder"
          accessibilityRole="button"
          aria-disabled={!canSend}
          disabled={!canSend}
          onPress={handleSend}
          pressScale={0.95}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        >
          {isSending ? <ActivityIndicator color={colors.ink} /> : <Send color={colors.ink} size={18} strokeWidth={2.2} />}
        </AnimatedPressable>
      ) : null}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  bar: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  heading: { ...typography.heading, color: colors.text, flex: 1, fontSize: 16, lineHeight: 21 },
  centerFill: { flex: 1, justifyContent: 'center' },
  listContent: { gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  headerCamera: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  cameraButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: sizes.touch - 4, justifyContent: 'center', width: sizes.touch - 4 },
  line: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.md, paddingVertical: 3 },
  lineBar: { borderRadius: 2, width: 3 },
  lineBody: { flex: 1, gap: 1 },
  label: { ...typography.label, letterSpacing: 0.3 },
  lineText: { ...typography.body, color: colors.text },
  lineTime: { ...typography.micro, alignSelf: 'flex-end', color: colors.textSecondary, fontWeight: '400' },
  snapLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 36, paddingVertical: 4 },
  snapTitle: { ...typography.bodyStrong },
  snapStatus: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  snapTime: { ...typography.micro, color: colors.textSecondary, fontWeight: '400' },
  error: { ...typography.caption, color: colors.danger, paddingBottom: 6, paddingHorizontal: spacing.md },
  inputBar: { alignItems: 'flex-end', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 120, minHeight: sizes.touch - 4, paddingHorizontal: 14, paddingVertical: 9 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: sizes.touch - 4, justifyContent: 'center', width: sizes.touch - 4 },
  sendButtonDisabled: { opacity: 0.4 },
});
