import * as Clipboard from 'expo-clipboard';
import { Link2, Send, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { listFriends, sendMessage, startConversation } from '../../api';
import { newClientId, type SignalShare } from '../../chatExtras';
import { postLink, shareMessage } from '../../deepLinks';
import { success } from '../../haptics';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, Friend } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { Sheet } from '../Sheet';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';

type Props = {
  auth: AuthResponse;
  share: SignalShare;
  onClose: () => void;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
};

/**
 * The share menu (V2-7; sinyal-mvp-plan P8.7): copy the signal's link, hand it to another app (the system share sheet),
 * or send it to a friend as a chat message (a link and a summary, never the poster's name; each send carries its own
 * client id, so a double tap never sends twice).
 */
export function ShareToChatSheet({ auth, share, onClose, refresh = {} }: Props) {
  const { t } = useTranslation('chat');
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sent, setSent] = useState<Record<string, 'sending' | 'sent' | 'failed'>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listFriends(auth, controller.signal, refresh)
      .then((list) => { if (!controller.signal.aborted) setFriends(list); })
      .catch(() => { if (!controller.signal.aborted) setFriends([]); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]);

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(postLink(share.postId));
      setNotice(t('extras.linkCopied'));
      success();
    } catch {
      setNotice(t('extras.linkCopyFailed'));
    }
  };

  const shareElsewhere = async () => {
    try {
      await Share.share({ message: shareMessage(share) });
    } catch {
      setNotice(t('extras.shareElsewhereFailed'));
    }
  };

  const sendTo = async (friend: Friend) => {
    if (sent[friend.id] === 'sending' || sent[friend.id] === 'sent') return;
    setSent((current) => ({ ...current, [friend.id]: 'sending' }));
    try {
      const conversation = await startConversation(auth, friend.id, refresh.onAuthRefresh, refresh.onSessionExpired);
      await sendMessage(auth, conversation.id, '', refresh.onAuthRefresh, refresh.onSessionExpired, { clientId: newClientId(), signal: share });
      setSent((current) => ({ ...current, [friend.id]: 'sent' }));
      setNotice(t('extras.shareSent', { name: friend.userName }));
      success();
    } catch {
      setSent((current) => ({ ...current, [friend.id]: 'failed' }));
      setNotice(t('extras.shareFailed'));
    }
  };

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.75}>
        <Text accessibilityRole="header" style={styles.title}>{t('extras.shareMenuTitle')}</Text>
        <View style={styles.actions}>
          <AnimatedPressable accessibilityRole="button" onPress={() => { void copyLink(); }} pressScale={0.95} style={styles.action} testID="share-copy-link">
            <View style={styles.actionIcon}><Link2 color={colors.text} size={20} /></View>
            <Text style={styles.actionText}>{t('extras.copyLink')}</Text>
          </AnimatedPressable>
          <AnimatedPressable accessibilityRole="button" onPress={() => { void shareElsewhere(); }} pressScale={0.95} style={styles.action} testID="share-elsewhere">
            <View style={styles.actionIcon}><Share2 color={colors.text} size={20} /></View>
            <Text style={styles.actionText}>{t('extras.shareElsewhere')}</Text>
          </AnimatedPressable>
        </View>
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        <Text accessibilityRole="header" style={styles.subtitle}>{t('extras.shareTitle')}</Text>
        <Text style={styles.hint}>{t('extras.shareHint')}</Text>
        {friends === null ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {friends && friends.length === 0 ? <Text style={styles.hint}>{t('extras.noFriends')}</Text> : null}
        <ScrollView style={styles.list}>
          {(friends ?? []).map((friend) => {
            const state = sent[friend.id];
            return (
              <View key={friend.id} style={styles.row}>
                <Avatar avatarKey={friend.avatarKey} seed={friend.id} size={40} />
                <Text numberOfLines={1} style={styles.name}>{friend.userName}</Text>
                <AnimatedPressable
                  accessibilityLabel={`${friend.userName}: ${t('extras.share')}`}
                  accessibilityRole="button"
                  disabled={state === 'sending' || state === 'sent'}
                  onPress={() => { void sendTo(friend); }}
                  pressScale={0.92}
                  style={[styles.send, state === 'sent' && styles.sent]}
                >
                  {state === 'sending' ? <ActivityIndicator color={colors.ink} size="small" /> : <Send color={colors.ink} size={16} />}
                </AnimatedPressable>
              </View>
            );
          })}
        </ScrollView>
      </BlinkrSheetPanel>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  subtitle: { ...typography.heading, color: colors.text, marginTop: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  action: { alignItems: 'center', gap: spacing.xs, minWidth: 72 },
  actionIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 52, justifyContent: 'center', width: 52 },
  actionText: { ...typography.caption, color: colors.text, textAlign: 'center' },
  notice: { ...typography.caption, color: colors.primary, marginTop: spacing.sm },
  loading: { marginVertical: spacing.lg },
  list: { flexShrink: 1, marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 56 },
  name: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  send: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  sent: { opacity: 0.45 },
});
