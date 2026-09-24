import { EyeOff, Heart, MapPin, MessageCircle, Radio, Send, ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { toAbsoluteUrl } from '../../api';
import { canLikeFeedItem, feedDistanceLabel, type DiscoverItem } from '../../discoverFeed';
import { formatCount } from '../../engagement';
import { freshnessLabelKey, freshnessTier } from '../../freshness';
import { formatAge, signalLabels } from '../../presentation';
import { cardText } from '../../signalCard';
import { signalValueLabel } from '../../productPresentation';
import { colors, radii, shadowSoft, signalColors, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { SignalSymbol } from '../SignalSymbol';
import { MediaImage } from '../ui/BlinkrMediaImage';
import { tx } from '../../i18n/tx';

type Props = {
  item: DiscoverItem;
  myUserId: string;
  onLike: (item: DiscoverItem) => void;
  onOpenThread: (item: DiscoverItem) => void;
  onOpenAuthor?: (item: DiscoverItem) => void;
  onShowOnMap?: (item: DiscoverItem) => void;
  /** Send it to a friend in chat (P8.7). */
  onShare?: (item: DiscoverItem) => void;
  /** Inside the comments sheet the sheet has its own like/comment row: showing both read as a duplicate (plan-devam A7). */
  hideActions?: boolean;
};

/**
 * One signal in the Keşfet feed (sinyal-mvp-plan P7.3): who (or "Topluluk üyesi" for anonymous), what type and value,
 * how fresh, how far (coarse), the photo if any, and likes/comments. Still a place signal, not a free-form post.
 */
export function FeedCard({ item, myUserId, onLike, onOpenThread, onOpenAuthor, onShowOnMap, onShare, hideActions = false }: Props) {
  const { t, i18n } = useTranslation('feed');
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const tone = signalColors[item.signalType] ?? colors.mint;
  const value = signalValueLabel(item.signalType, item.signalValue);
  const text = cardText(item.title, item.content, item.signalType);
  const photo = item.media.find((media) => media.type !== 'Video') ?? item.media[0];
  const photoIsVideo = photo?.type === 'Video';
  // A video is only drawn from its thumbnail; its .mp4 url is not an image (plan-devam A6).
  const photoUrl = photo ? toAbsoluteUrl(photoIsVideo ? photo.thumbnailUrl : photo.thumbnailUrl ?? photo.url) : null;
  const distance = feedDistanceLabel(item.distanceMeters, lang);
  const likeable = canLikeFeedItem(item, myUserId);
  const freshness = freshnessTier(item.createdAtUtc, item.expiresAtUtc);

  return (
    <View style={[styles.card, item.expired && styles.expired]} testID={`feed-card-${item.id}`}>
      <View style={styles.head}>
        <AnimatedPressable
          accessibilityRole="button"
          disabled={item.anonymous || !onOpenAuthor}
          onPress={() => onOpenAuthor?.(item)}
          pressScale={0.98}
          style={styles.author}
        >
          {item.anonymous
            ? <View style={styles.anonAvatar}><EyeOff color={colors.textSecondary} size={16} /></View>
            : <Avatar seed={item.authorId ?? item.id} size={32} />}
          <View style={styles.authorCopy}>
            <Text numberOfLines={1} style={styles.authorName}>{item.anonymous ? t('discover.anonymous') : item.authorName}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {[formatAge(item.createdAtUtc), distance, item.locationName].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </AnimatedPressable>
        {/* One freshness rule (plan-devam A8): "Canlı" only for a server-verified signal under 15 minutes. */}
        {freshness === 'live' && item.verified
          ? <View style={styles.live}><Radio color={colors.primary} size={12} /><Text style={styles.liveText}>{t(freshnessLabelKey(freshness, true))}</Text></View>
          : <Text style={styles.meta}>{t(freshnessLabelKey(item.expired ? 'expired' : freshness, Boolean(item.verified)))}</Text>}
      </View>

      <AnimatedPressable accessibilityLabel={`${signalLabels[item.signalType] ?? ''}${value ? `, ${value}` : ''}. ${t('discover.comments')}`} accessibilityRole="button" onPress={() => onOpenThread(item)} pressScale={0.99}>
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, { backgroundColor: `${tone}24` }]}>
            <SignalSymbol color={tone} size={14} type={item.signalType} />
            <Text style={[styles.typeText, { color: tone }]}>{signalLabels[item.signalType] ?? 'Sinyal'}{value ? ` · ${value}` : ''}</Text>
          </View>
          {item.sensitive ? (
            <View style={styles.sensitive} testID="feed-sensitive">
              <ShieldAlert color={colors.textSecondary} size={12} />
              <Text style={styles.sensitiveText}>{t('discover.sensitive')}</Text>
            </View>
          ) : null}
        </View>
        {text ? <Text numberOfLines={4} style={styles.content}>{text}</Text> : null}
        {photo ? <MediaImage style={styles.photo} uri={photoUrl} video={photoIsVideo} /> : null}
      </AnimatedPressable>

      {hideActions ? null : <View style={styles.actions}>
        <AnimatedPressable
          accessibilityLabel={item.isLikedByCurrentUser ? tx('signal:engagement.unlike', 'Beğeniyi geri al') : tx('signal:engagement.like', 'Beğen')}
          accessibilityRole="button"
          aria-selected={item.isLikedByCurrentUser}
          disabled={!likeable}
          onPress={() => onLike(item)}
          pressScale={0.9}
          style={[styles.action, !likeable && styles.dim]}
          testID={`feed-like-${item.id}`}
        >
          <Heart color={item.isLikedByCurrentUser ? colors.danger : colors.text} fill={item.isLikedByCurrentUser ? colors.danger : 'none'} size={20} />
          <Text style={styles.actionCount}>{formatCount(item.likeCount, lang)}</Text>
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={t('discover.comments')} accessibilityRole="button" onPress={() => onOpenThread(item)} pressScale={0.9} style={styles.action}>
          <MessageCircle color={colors.text} size={20} />
          <Text style={styles.actionCount}>{formatCount(item.commentCount, lang)}</Text>
        </AnimatedPressable>
        {onShare ? (
          <AnimatedPressable accessibilityLabel={tx('signal:engagement.shareChat', 'Sohbette paylaş')} accessibilityRole="button" onPress={() => onShare(item)} pressScale={0.9} style={styles.action} testID={`feed-share-${item.id}`}>
            <Send color={colors.text} size={19} />
          </AnimatedPressable>
        ) : null}
        {item.placeId && onShowOnMap ? (
          <AnimatedPressable accessibilityRole="button" onPress={() => onShowOnMap(item)} pressScale={0.95} style={[styles.action, styles.mapLink]}>
            <MapPin color={colors.textSecondary} size={16} />
            <Text style={styles.meta}>{t('discover.showOnMap')}</Text>
          </AnimatedPressable>
        ) : null}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.sm, padding: spacing.lg, ...shadowSoft },
  expired: { opacity: 0.6 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  author: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  anonAvatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  authorCopy: { flex: 1 },
  authorName: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  live: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  liveText: { ...typography.label, color: colors.primary },
  typeRow: { flexDirection: 'row' },
  typeBadge: { alignItems: 'center', borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  typeText: { ...typography.label },
  sensitive: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sensitiveText: { ...typography.label, color: colors.textSecondary },
  title: { ...typography.heading, color: colors.text, marginTop: spacing.xs },
  content: { ...typography.body, color: colors.text, marginTop: 2 },
  photo: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceElevated, borderRadius: radii.md, marginTop: spacing.sm, width: '100%' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  action: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44 },
  actionCount: { ...typography.bodyStrong, color: colors.text },
  mapLink: { marginLeft: 'auto' },
  dim: { opacity: 0.4 },
});
