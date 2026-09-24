import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Camera, Copy, CornerUpLeft, Flag, MessageCircle, Send, Undo2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMessages, markConversationRead, reactToMessage, sendMessage, sendReport, sendTyping, unsendMessage } from '../../api';
import { CHAT_REACTIONS, applyReaction, canReact, canUnsend, newClientId, nextReaction, reactionSummary } from '../../chatExtras';
import { track } from '../../analytics';
import { buildThread, lastOwnMessageId, receiptLabel, shouldPingTyping } from '../../chatThread';
import { signalLabels } from '../../presentation';
import { friendlyError, signalValueLabel } from '../../productPresentation';
import { fromShare, type CardSignal } from '../../signalCard';
import { snapRow } from '../../snapPresentation';
import { colors, radii, signalColors, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, ChatMessage, Conversation } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { ReportPanel } from '../ReportPanel';
import { Sheet } from '../Sheet';
import { SignalSymbol } from '../SignalSymbol';
import { SignalCardModal } from '../signal/SignalCardModal';
import { SnapStatusIcon, statusColor } from '../snap/SnapStatusIcon';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { tx } from '../../i18n/tx';
import { displayLocale } from '../../i18n/locale';

const POLL_INTERVAL_MS = 4000;
const MAX_MESSAGE_LENGTH = 2000;
const BUBBLE_RADIUS = 18;
const BUBBLE_TIGHT = 6;

const formatClock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(displayLocale(), { hour: '2-digit', minute: '2-digit' });
};

/**
 * One conversation as bubbles (plan-devam Faz E): mine on the right, theirs on the left, grouped when close together
 * (one time stamp per group), a day separator between days, "Görüldü" under my newest message and "yazıyor" while the
 * other person types (both come with the ~4 s poll - no realtime, CLAUDE.md §6.5). A long press opens the message
 * actions: react, reply with a quote, copy, take back (mine) or report (theirs).
 */
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
  const { t, i18n } = useTranslation('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<ChatMessage | null>(null);
  const [reporting, setReporting] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [openCard, setOpenCard] = useState<CardSignal | null>(null);
  const pollInFlight = useRef(false);
  const lastTypingPing = useRef(0);
  // The client id of a send that failed: retrying the same text reuses it, so the server never stores it twice.
  const pendingClientId = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const refresh = useMemo(() => ({ onAuthRefresh: onAuthChange, onSessionExpired }), [onAuthChange, onSessionExpired]);
  const language = i18n.language === 'en' ? 'en' : 'tr';

  // Android back closes an open layer first, then returns to the conversation list.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actionFor) { setActionFor(null); setReporting(false); return true; }
      if (openCard) { setOpenCard(null); return true; }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, actionFor, openCard]);

  const load = useCallback(async (background = false) => {
    if (background && pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const { items, otherTyping: typing } = await getMessages(auth, conversation.id, undefined, onAuthChange, onSessionExpired);
      setMessages(items);
      setOtherTyping(Boolean(typing));
      setError(null);
      // Messages that arrive while the conversation is open are read by definition.
      if (items.some((message) => message.kind !== 'snap' && message.senderId !== auth.userId && !message.isRead)) {
        markConversationRead(auth, conversation.id, onAuthChange, onSessionExpired).catch(() => {});
      }
    } catch (err) {
      console.log('[Blinkr Chat]', { status: 'failed', errorCode: err instanceof Error ? err.name : 'Unknown' });
      if (!background) setError(friendlyError(err, t('thread.loadFailed')));
    } finally {
      pollInFlight.current = false;
      setLoading(false);
    }
  }, [auth, conversation.id, onAuthChange, onSessionExpired, t]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(true); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const onChangeDraft = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (shouldPingTyping(lastTypingPing.current, now, value)) {
      lastTypingPing.current = now;
      sendTyping(auth, conversation.id, refresh).catch(() => {});
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setSending(true);
    setDraft('');
    const quoting = replyTo;
    setReplyTo(null);
    try {
      const clientId = pendingClientId.current ?? newClientId();
      pendingClientId.current = clientId;
      const sent = await sendMessage(auth, conversation.id, text, onAuthChange, onSessionExpired, { clientId, replyToId: quoting?.id ?? null });
      pendingClientId.current = null;
      lastTypingPing.current = 0;
      track('message_sent', { type: quoting ? 'reply' : 'text' });
      // A poll may already have returned the message; never show it twice.
      setMessages((prev) => (prev.some((message) => message.id === sent.id) ? prev : [sent, ...prev]));
      setError(null);
    } catch (err) {
      setError(friendlyError(err, t('thread.sendFailed')));
      setDraft(text);
      setReplyTo(quoting);
    } finally {
      setSending(false);
    }
  };

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

  const copy = async (message: ChatMessage) => {
    setActionFor(null);
    try { await Clipboard.setStringAsync(message.text); setNotice(t('thread.copied')); } catch { /* nothing to undo */ }
  };

  const startReply = (message: ChatMessage) => {
    setActionFor(null);
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const rows = useMemo(() => buildThread(messages, auth.userId, new Date(), language), [messages, auth.userId, language]);
  const receiptFor = useMemo(() => lastOwnMessageId(messages, auth.userId), [messages, auth.userId]);
  const canSend = draft.trim().length > 0 && !isSending;
  const quoteName = (senderId: string) => (senderId === auth.userId ? t('thread.you') : otherUserName);

  const bubbleCorners = (mine: boolean, top: boolean, bottom: boolean) => (mine
    ? { borderTopRightRadius: top ? BUBBLE_RADIUS : BUBBLE_TIGHT, borderBottomRightRadius: bottom ? BUBBLE_RADIUS : BUBBLE_TIGHT }
    : { borderTopLeftRadius: top ? BUBBLE_RADIUS : BUBBLE_TIGHT, borderBottomLeftRadius: bottom ? BUBBLE_RADIUS : BUBBLE_TIGHT });

  const renderMessage = (item: ChatMessage, mine: boolean, groupTop: boolean, groupBottom: boolean) => {
    const corners = bubbleCorners(mine, groupTop, groupBottom);
    const summary = reactionSummary(item.reactions, auth.userId);
    const snap = snapRow(item, auth.userId);
    const time = groupBottom ? <Text style={[styles.time, mine && styles.timeMine]}>{formatClock(item.createdAtUtc)}</Text> : null;
    const receipt = mine && item.id === receiptFor
      ? <Text accessibilityLiveRegion="polite" style={styles.receipt} testID="chat-receipt">{receiptLabel(item, language)}</Text>
      : null;

    // E5: a snap is a bubble with its status (filled = waiting, outlined = done).
    if (snap) {
      const body = (
        <View style={[styles.bubble, styles.snapBubble, mine ? styles.mineBubble : styles.theirBubble, corners]}>
          <SnapStatusIcon filled={snap.filled} icon={snap.icon} tone={snap.tone} />
          <View>
            <Text style={[styles.snapTitle, { color: snap.tone === 'quiet' ? colors.textSecondary : statusColor(snap.tone) }]}>{snap.title}</Text>
            <Text style={styles.snapStatus}>{snap.status}</Text>
          </View>
        </View>
      );
      return (
        <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, groupTop && styles.rowGroupTop]}>
          {snap.tappable && onOpenSnap
            ? <AnimatedPressable accessibilityLabel={`${snap.title}, ${snap.status}`} accessibilityRole="button" onPress={() => onOpenSnap(item.id)} pressScale={0.98}>{body}</AnimatedPressable>
            : <View accessibilityLabel={`${snap.title}, ${snap.status}`}>{body}</View>}
          {time}
          {receipt}
        </View>
      );
    }

    const share = item.kind === 'signal' ? item.signal ?? null : null;
    const shareTone = share ? signalColors[share.signalType as keyof typeof signalColors] ?? colors.mint : colors.mint;
    const unsent = item.kind === 'unsent';
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, groupTop && styles.rowGroupTop]}>
        <AnimatedPressable
          accessibilityHint={canReact(item) ? t('extras.actions') : undefined}
          accessibilityRole={canReact(item) || share ? 'button' : undefined}
          delayLongPress={300}
          disabled={!canReact(item) && !share}
          onLongPress={() => { if (canReact(item)) setActionFor(item); }}
          onPress={() => { if (share) setOpenCard(fromShare(share)); }}
          pressScale={0.98}
          style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble, corners, unsent && styles.unsentBubble]}
          testID={`message-${item.id}`}
        >
          {item.replyTo ? (
            <View style={[styles.quote, mine && styles.quoteMine]} testID={`quote-${item.id}`}>
              <Text numberOfLines={1} style={styles.quoteName}>{quoteName(item.replyTo.senderId)}</Text>
              <Text numberOfLines={2} style={styles.quoteText}>
                {item.replyTo.kind === 'unsent' ? t('extras.unsent') : item.replyTo.kind === 'snap' ? t('thread.snap') : item.replyTo.text || t('extras.signalShared')}
              </Text>
            </View>
          ) : null}
          {unsent ? <Text style={styles.unsent}>{t('extras.unsent')}</Text> : null}
          {share ? (
            // E6: a shared signal is a small card; a tap opens the Sinyal Kartı.
            <View accessibilityLabel={t('extras.openSignal')} style={styles.shareCard} testID={`share-${item.id}`}>
              <View style={[styles.shareTile, { backgroundColor: `${shareTone}26` }]}><SignalSymbol color={shareTone} size={20} type={share.signalType as never} /></View>
              <View style={styles.shareCopy}>
                <Text numberOfLines={1} style={[styles.shareType, { color: shareTone }]}>
                  {signalLabels[share.signalType as keyof typeof signalLabels] ?? t('extras.signalShared')}{signalValueLabel(share.signalType as never, share.signalValue) ? ` · ${signalValueLabel(share.signalType as never, share.signalValue)}` : ''}
                </Text>
                {share.title ? <Text numberOfLines={2} style={styles.bubbleText}>{share.title}</Text> : null}
                {share.locationName ? <Text numberOfLines={1} style={styles.snapStatus}>{share.locationName}</Text> : null}
              </View>
            </View>
          ) : null}
          {!unsent && item.text ? <Text style={styles.bubbleText}>{item.text}</Text> : null}
        </AnimatedPressable>
        {summary.length ? (
          <View style={[styles.reactionRow, mine && styles.reactionRowMine]}>
            {summary.map((entry) => <Text key={entry.emoji} style={[styles.reactionChip, entry.mine && styles.reactionMine]}>{entry.emoji}{entry.count > 1 ? ` ${entry.count}` : ''}</Text>)}
          </View>
        ) : null}
        {time}
        {receipt}
      </View>
    );
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri dön')} accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <AnimatedPressable accessibilityLabel={tx('chat:thread.openProfile', '{{name}}, profili aç', { name: otherUserName })} accessibilityRole="button" disabled={!onOpenProfile} onPress={() => onOpenProfile?.()} pressScale={0.98} style={styles.identity}>
        <Avatar avatarKey={otherAvatarKey} seed={conversation.otherUserId} size={36} />
        <View style={styles.identityCopy}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{otherUserName}</Text>
          {otherTyping ? <Text accessibilityLiveRegion="polite" style={styles.typing} testID="chat-typing">{t('thread.typing')}</Text> : null}
        </View>
      </AnimatedPressable>
      {onSendSnap ? (
        <AnimatedPressable accessibilityLabel={tx('chat:list.snapToA11y', '{{name}} kişisine Snap gönder', { name: otherUserName })} accessibilityRole="button" onPress={onSendSnap} pressScale={0.95} style={styles.headerCamera}>
          <Camera color={colors.text} size={20} />
        </AnimatedPressable>
      ) : null}
    </View>

    {isLoading ? (
      <View style={styles.centerFill}><ActivityIndicator accessibilityLabel={tx('chat:thread.loading', 'Mesajlar yükleniyor')} color={colors.primary} /></View>
    ) : !messages.length ? (
      <View style={styles.centerFill}>
        <BlinkrEmptyState description={tx('chat:thread.emptyHint', '{{name}} ile ilk mesajı sen yaz.', { name: otherUserName })} icon={<MessageCircle color={colors.textSecondary} size={26} />} title={tx('chat:thread.empty', 'Henüz mesaj yok')} />
      </View>
    ) : (
      // Inverted: the newest message sits at the bottom without manual scrolling, and stays there as new ones arrive.
      <FlatList
        contentContainerStyle={styles.listContent}
        data={rows}
        inverted
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.key}
        ListHeaderComponent={otherTyping ? (
          <View style={[styles.row, styles.rowTheirs, styles.rowGroupTop]}>
            <View accessibilityLabel={t('thread.typing')} style={[styles.bubble, styles.theirBubble, styles.typingBubble]}><Text style={styles.typingDots}>• • •</Text></View>
          </View>
        ) : null}
        renderItem={({ item: row }) => (row.type === 'day'
          ? <View style={styles.dayRow}><Text accessibilityRole="header" style={styles.dayText} testID="chat-day">{row.label}</Text></View>
          : renderMessage(row.message, row.mine, row.groupTop, row.groupBottom))}
        showsVerticalScrollIndicator={false}
      />
    )}

    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}

    {replyTo ? (
      <View style={styles.replyBar} testID="reply-bar">
        <CornerUpLeft color={colors.primary} size={18} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.quoteName}>{t('thread.replyingTo', { name: quoteName(replyTo.senderId) })}</Text>
          <Text numberOfLines={1} style={styles.quoteText}>{replyTo.text || t('extras.signalShared')}</Text>
        </View>
        <AnimatedPressable accessibilityLabel={t('thread.cancelReply')} accessibilityRole="button" hitSlop={8} onPress={() => setReplyTo(null)} style={styles.back}>
          <X color={colors.textSecondary} size={18} />
        </AnimatedPressable>
      </View>
    ) : null}

    <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {onSendSnap ? (
        <AnimatedPressable accessibilityLabel={tx('chat:thread.sendSnap', 'Snap gönder')} accessibilityRole="button" onPress={onSendSnap} pressScale={0.95} style={styles.cameraButton}>
          <Camera color={colors.text} size={20} />
        </AnimatedPressable>
      ) : null}
      <TextInput
        accessibilityLabel={tx('chat:thread.write', 'Mesaj yaz')}
        maxLength={MAX_MESSAGE_LENGTH}
        multiline
        onChangeText={onChangeDraft}
        placeholder={tx('chat:thread.placeholder', 'Mesaj')}
        placeholderTextColor={colors.textSecondary}
        ref={inputRef}
        style={styles.input}
        value={draft}
      />
      {draft.trim().length > 0 || isSending ? (
        <AnimatedPressable accessibilityLabel={tx('chat:thread.send', 'Gönder')} accessibilityRole="button" aria-disabled={!canSend} disabled={!canSend} onPress={handleSend} pressScale={0.95} style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}>
          {isSending ? <ActivityIndicator color={colors.ink} /> : <Send color={colors.ink} size={18} strokeWidth={2.2} />}
        </AnimatedPressable>
      ) : null}
    </View>

    {actionFor ? (
      <Sheet onClose={() => { setActionFor(null); setReporting(false); }}>
        <BlinkrSheetPanel>
          {reporting ? (
            <ReportPanel
              onDone={() => { setReporting(false); setActionFor(null); }}
              onSubmit={async (reason, note) => { await sendReport(auth, { targetType: 'user', targetId: conversation.otherUserId, reason, note: note || t('thread.reportNote') }, refresh); }}
              subject={otherUserName}
              target="user"
            />
          ) : (
            <View accessibilityLabel={t('extras.actions')} style={styles.actions}>
              <View style={styles.emojiRow}>
                {CHAT_REACTIONS.map((emoji) => (
                  <AnimatedPressable accessibilityLabel={t('extras.react', { emoji })} accessibilityRole="button" key={emoji} onPress={() => { void react(actionFor, emoji); }} pressScale={0.85} style={styles.emojiButton}>
                    <Text style={styles.emoji}>{emoji}</Text>
                  </AnimatedPressable>
                ))}
              </View>
              <ActionRow icon={<CornerUpLeft color={colors.text} size={20} />} label={t('thread.reply')} onPress={() => startReply(actionFor)} />
              {actionFor.text ? <ActionRow icon={<Copy color={colors.text} size={20} />} label={t('thread.copy')} onPress={() => { void copy(actionFor); }} /> : null}
              {canUnsend(actionFor, auth.userId)
                ? <ActionRow danger icon={<Undo2 color={colors.danger} size={20} />} label={t('extras.unsend')} onPress={() => { void unsend(actionFor); }} />
                : <ActionRow danger icon={<Flag color={colors.danger} size={20} />} label={t('thread.report')} onPress={() => setReporting(true)} />}
            </View>
          )}
        </BlinkrSheetPanel>
      </Sheet>
    ) : null}

    {openCard ? (
      <SignalCardModal
        auth={auth}
        cards={[openCard]}
        deviceOrigin={null}
        onChanged={() => setOpenCard(null)}
        onClose={() => setOpenCard(null)}
        onConfirm={async () => {}}
        onDeleted={() => setOpenCard(null)}
        onOpenAuthor={() => setOpenCard(null)}
        refresh={refresh}
      />
    ) : null}
  </KeyboardAvoidingView>;
}

function ActionRow({ icon, label, onPress, danger = false }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <AnimatedPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.98} style={styles.actionRow}>
      {icon}
      <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  bar: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  identity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  identityCopy: { flex: 1 },
  heading: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  typing: { ...typography.caption, color: colors.primary },
  headerCamera: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  centerFill: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  row: { marginTop: 2, maxWidth: '82%' },
  rowMine: { alignItems: 'flex-end', alignSelf: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  rowGroupTop: { marginTop: spacing.sm },
  bubble: { borderRadius: BUBBLE_RADIUS, paddingHorizontal: 14, paddingVertical: 9 },
  // Mine: the calm brand tint with dark text; theirs: a sunken neutral (plan-devam E1).
  mineBubble: { backgroundColor: colors.primaryTint },
  theirBubble: { backgroundColor: colors.surfaceElevated },
  unsentBubble: { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1 },
  bubbleText: { ...typography.body, color: colors.text },
  time: { ...typography.micro, color: colors.textSecondary, fontWeight: '400', marginHorizontal: 6, marginTop: 3 },
  timeMine: { textAlign: 'right' },
  receipt: { ...typography.micro, color: colors.textSecondary, fontWeight: '600', marginHorizontal: 6, marginTop: 1 },
  dayRow: { alignItems: 'center', marginVertical: spacing.md },
  dayText: { ...typography.label, backgroundColor: colors.surface, borderRadius: radii.pill, color: colors.textSecondary, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 4 },
  typingBubble: { paddingVertical: 8 },
  typingDots: { ...typography.bodyStrong, color: colors.textSecondary, letterSpacing: 2 },
  snapBubble: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  snapTitle: { ...typography.bodyStrong },
  snapStatus: { ...typography.caption, color: colors.textSecondary },
  quote: { borderLeftColor: colors.textSecondary, borderLeftWidth: 3, marginBottom: 6, paddingLeft: 8 },
  quoteMine: { borderLeftColor: colors.primary },
  quoteName: { ...typography.label, color: colors.primary },
  quoteText: { ...typography.caption, color: colors.textSecondary },
  unsent: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
  shareCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minWidth: 200 },
  shareTile: { alignItems: 'center', borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 },
  shareCopy: { flexShrink: 1 },
  shareType: { ...typography.label },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, paddingHorizontal: 8 },
  reactionRowMine: { justifyContent: 'flex-end' },
  reactionChip: { ...typography.caption, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.text, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1 },
  reactionMine: { borderColor: colors.primary },
  error: { ...typography.caption, color: colors.danger, paddingBottom: 6, paddingHorizontal: spacing.md },
  notice: { ...typography.caption, color: colors.textSecondary, paddingBottom: 6, paddingHorizontal: spacing.md, textAlign: 'center' },
  replyBar: { alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs, paddingVertical: 4 },
  inputBar: { alignItems: 'flex-end', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  cameraButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: sizes.touch - 4, justifyContent: 'center', width: sizes.touch - 4 },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 120, minHeight: sizes.touch - 4, paddingHorizontal: 14, paddingVertical: 9 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: sizes.touch - 4, justifyContent: 'center', width: sizes.touch - 4 },
  sendButtonDisabled: { opacity: 0.4 },
  actions: { gap: 2, paddingBottom: spacing.md },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm, paddingHorizontal: spacing.xs },
  emojiButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 48, justifyContent: 'center', width: 48 },
  emoji: { fontSize: 24 },
  actionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm },
  actionText: { ...typography.body, color: colors.text },
  actionDanger: { color: colors.danger },
});
