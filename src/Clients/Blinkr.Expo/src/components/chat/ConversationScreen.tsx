import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Camera, MessageCircle, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMessages, markConversationRead, reactToMessage, sendMessage, unsendMessage } from '../../api';
import { CHAT_REACTIONS, applyReaction, canReact, canUnsend, newClientId, nextReaction, reactionSummary, type SignalShare } from '../../chatExtras';
import { signalLabels } from '../../presentation';
import { signalValueLabel } from '../../productPresentation';

import { Sheet } from '../Sheet';
import { SignalSymbol } from '../SignalSymbol';
import { SignalThreadPanel } from '../signal/SignalThreadPanel';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { colors, radii, signalColors, sizes, spacing, typography } from '../../theme';
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
  const { t } = useTranslation('chat');
  // The client id of a send that failed: retrying the same text reuses it, so the server never stores it twice.
  const pendingClientId = useRef<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [openSignal, setOpenSignal] = useState<SignalShare | null>(null);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };

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
      const clientId = pendingClientId.current ?? newClientId();
      pendingClientId.current = clientId;
      const sent = await sendMessage(auth, conversation.id, text, onAuthChange, onSessionExpired, { clientId });
      pendingClientId.current = null;
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

  const replace = (next: ChatMessage) => setMessages((prev) => prev.map((m) => (m.id === next.id ? next : m)));

  const react = async (message: ChatMessage, pressed: string) => {
    setActionFor(null);
    const emoji = nextReaction(message.reactions, auth.userId, pressed);
    const before = message.reactions ?? [];
    replace({ ...message, reactions: applyReaction(before, auth.userId, emoji) });
    try {
      replace(await reactToMessage(auth, conversation.id, message.id, emoji, refresh));
    } catch {
      replace({ ...message, reactions: before });
      setError(t('extras.reactFailed'));
    }
  };

  const unsend = async (message: ChatMessage) => {
    setActionFor(null);
    try {
      replace(await unsendMessage(auth, conversation.id, message.id, refresh));
    } catch {
      setError(t('extras.unsendFailed'));
    }
  };

  const reactionRow = (item: ChatMessage) => {
    const summary = reactionSummary(item.reactions, auth.userId);
    const open = actionFor === item.id;
    if (!summary.length && !open) return null;
    return (
      <View style={styles.reactionBlock}>
        {summary.length ? (
          <View style={styles.reactionRow}>
            {summary.map((entry) => (
              <Text key={entry.emoji} style={[styles.reactionChip, entry.mine && styles.reactionMine]}>{entry.emoji}{entry.count > 1 ? ` ${entry.count}` : ''}</Text>
            ))}
          </View>
        ) : null}
        {open ? (
          <View accessibilityLabel={t('extras.actions')} style={styles.actionRow}>
            {CHAT_REACTIONS.map((emoji) => (
              <AnimatedPressable accessibilityLabel={t('extras.react', { emoji })} accessibilityRole="button" key={emoji} onPress={() => { void react(item, emoji); }} pressScale={0.85} style={styles.emojiButton}>
                <Text style={styles.emoji}>{emoji}</Text>
              </AnimatedPressable>
            ))}
            {canUnsend(item, auth.userId) ? (
              <AnimatedPressable accessibilityRole="button" onPress={() => { void unsend(item); }} pressScale={0.95} style={styles.unsendButton}>
                <Text style={styles.unsendText}>{t('extras.unsend')}</Text>
              </AnimatedPressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

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
          const share = item.kind === 'signal' ? item.signal ?? null : null;
          const shareTone = share ? signalColors[share.signalType as keyof typeof signalColors] ?? colors.mint : colors.mint;
          return (
            <View>
              <AnimatedPressable
                accessibilityHint={canReact(item) ? t('extras.actions') : undefined}
                accessibilityRole={canReact(item) ? 'button' : undefined}
                delayLongPress={300}
                disabled={!canReact(item)}
                onLongPress={() => setActionFor(actionFor === item.id ? null : item.id)}
                onPress={() => { if (share) setOpenSignal(share); else if (actionFor) setActionFor(null); }}
                pressScale={0.99}
                style={styles.line}
                testID={`message-${item.id}`}
              >
                <View style={[styles.lineBar, { backgroundColor: tone }]} />
                <View style={styles.lineBody}>
                  {startsRun ? <Text style={[styles.label, { color: tone }]}>{isMine ? 'Ben' : otherUserName}</Text> : null}
                  {item.kind === 'unsent' ? <Text style={styles.unsent}>{t('extras.unsent')}</Text> : null}
                  {share ? (
                    <View accessibilityLabel={t('extras.openSignal')} style={[styles.shareCard, { borderColor: shareTone }]}>
                      <SignalSymbol color={shareTone} size={18} type={share.signalType as never} />
                      <View style={styles.shareCopy}>
                        <Text numberOfLines={1} style={[styles.shareType, { color: shareTone }]}>
                          {signalLabels[share.signalType as keyof typeof signalLabels] ?? t('extras.signalShared')}{signalValueLabel(share.signalType as never, share.signalValue) ? ` · ${signalValueLabel(share.signalType as never, share.signalValue)}` : ''}
                        </Text>
                        {share.title ? <Text numberOfLines={1} style={styles.lineText}>{share.title}</Text> : null}
                        {share.locationName ? <Text numberOfLines={1} style={styles.snapStatus}>{share.locationName}</Text> : null}
                      </View>
                    </View>
                  ) : null}
                  {item.kind !== 'unsent' && item.text ? <Text style={styles.lineText}>{item.text}</Text> : null}
                </View>
                <Text style={styles.lineTime}>{formatClock(item.createdAtUtc)}</Text>
              </AnimatedPressable>
              {reactionRow(item)}
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    )}

    {openSignal ? (
      <Sheet onClose={() => setOpenSignal(null)}>
        <BlinkrSheetPanel maxHeightRatio={0.92}>
          <SignalThreadPanel
            auth={auth}
            header={<Text style={styles.lineText}>{openSignal.title || signalLabels[openSignal.signalType as keyof typeof signalLabels] || t('extras.signalShared')}</Text>}
            onClose={() => setOpenSignal(null)}
            postId={openSignal.postId}
            refresh={refresh}
          />
        </BlinkrSheetPanel>
      </Sheet>
    ) : null}

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
  unsent: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
  shareCard: { alignItems: 'center', borderLeftWidth: 3, borderRadius: radii.sm, flexDirection: 'row', gap: spacing.sm, marginTop: 2, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  shareCopy: { flex: 1 },
  shareType: { ...typography.label },
  reactionBlock: { gap: 4, marginLeft: spacing.md + 3, marginTop: 2 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reactionChip: { ...typography.caption, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, color: colors.text, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  reactionMine: { borderColor: colors.primary, borderWidth: 1 },
  actionRow: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 6, paddingVertical: 2 },
  emojiButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  emoji: { fontSize: 22 },
  unsendButton: { justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.sm },
  unsendText: { ...typography.label, color: colors.danger },
  inputBar: { alignItems: 'flex-end', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 120, minHeight: sizes.touch - 4, paddingHorizontal: 14, paddingVertical: 9 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: sizes.touch - 4, justifyContent: 'center', width: sizes.touch - 4 },
  sendButtonDisabled: { opacity: 0.4 },
});
