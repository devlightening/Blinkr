import { MapPin, MessageCircle, Radio, Send, ShieldAlert } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { canLikeFeedItem, feedDistanceLabel, type DiscoverItem } from '../../discoverFeed';
import { formatCount } from '../../engagement';
import { freshnessLabelKey, freshnessTier } from '../../freshness';
import { formatAge, signalLabels } from '../../presentation';
import { HEART as HEART_EMOJI, reactionStateOf } from '../../reactions';
import type { Mention } from '../../richText';
import { cardText, type CardMedia } from '../../signalCard';
import { signalValueLabel } from '../../productPresentation';
import { liveA11yLabel, stateLabel } from '../../live/liveLabels';
import { postLiveState } from '../../live/postState';
import { colors, liveColors, liveRingSize, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { LiveRing } from '../live/LiveRing';
import { StatusPill } from '../live/StatusPill';
import { PlaceSymbol } from '../PlaceSymbol';
import { SignalSymbol } from '../SignalSymbol';
import { MediaCarousel } from '../signal/MediaCarousel';
import { ReactionBurst } from '../ui/ReactionBurst';
import { ReactionButton } from '../ui/ReactionButton';
import { RichText } from '../ui/RichText';
import { tx } from '../../i18n/tx';

type Props = {
  item: DiscoverItem;
  myUserId: string;
  onLike: (item: DiscoverItem) => void;
  /** V2-4: a long press on the heart picks an emoji. */
  onReact?: (item: DiscoverItem, reaction: string) => void;
  /** V2-6: a double tap on the media adds the heart (never takes a reaction away). */
  onDoubleTap?: (item: DiscoverItem) => void;
  onMention?: (mention: Mention) => void;
  onHashtag?: (tag: string) => void;
  onOpenThread: (item: DiscoverItem) => void;
  onOpenAuthor?: (item: DiscoverItem) => void;
  onShowOnMap?: (item: DiscoverItem) => void;
  /** Send it to a friend in chat (P8.7). */
  onShare?: (item: DiscoverItem) => void;
  /** Inside the comments sheet the sheet has its own like/comment row: showing both read as a duplicate (plan-devam A7). */
  hideActions?: boolean;
  /** V2-6: only the most visible card plays its video. */
  playing?: boolean;
  /** The comments sheet shows play/pause, scrubbing and sound on the video; the feed shows a quiet muted loop. */
  videoControls?: 'minimal' | 'full';
  /** Resolved in one parent-level Place batch; avoids one network request per feed card. */
  placeCategory?: string | null;
};

/** The caption folds after this many lines until "devamı" is tapped. */
const CAPTION_LINES = 2;

/**
 * One signal in the Keşfet feed (sinyal-mvp-plan P7.3, V2-6 Instagram layout): who (or "Topluluk üyesi"), where and how
 * fresh; the media edge to edge (swipe, double tap = heart); actions; the type/value badge; the caption with the name
 * first and "devamı"; "N yorumun tümünü gör". A text-only signal keeps its big text above the actions. Still a place
 * signal, never a free-form post.
 */
/** Two taps within this many ms on a text post = a like (the same window as the photo carousel). */
const TEXT_DOUBLE_TAP_MS = 280;

export function FeedCard({ item, myUserId, onLike, onReact, onDoubleTap, onMention, onHashtag, onOpenThread, onOpenAuthor, onShowOnMap, onShare, hideActions = false, playing = false, videoControls = 'minimal', placeCategory }: Props) {
  const { t, i18n } = useTranslation('feed');
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const [width, setWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // The reaction animation over the post: double tap (❤️) or any emoji picked.
  const [burst, setBurst] = useState({ emoji: HEART_EMOJI, n: 0 });
  const pop = (emoji: string) => setBurst((b) => ({ emoji, n: b.n + 1 }));
  const lastTextTap = useRef(0);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (textTimer.current) clearTimeout(textTimer.current); }, []);
  const doubleTapLike = () => { if (!likeable || !onDoubleTap) return; pop(HEART_EMOJI); onDoubleTap(item); };
  // Text posts: one tap opens the comments (after a short wait), two taps like - the same gesture as on a photo.
  const onTextPress = () => {
    const now = Date.now();
    if (onDoubleTap && likeable && now - lastTextTap.current < TEXT_DOUBLE_TAP_MS) {
      if (textTimer.current) clearTimeout(textTimer.current);
      lastTextTap.current = 0;
      doubleTapLike();
      return;
    }
    lastTextTap.current = now;
    textTimer.current = setTimeout(() => onOpenThread(item), onDoubleTap && likeable ? TEXT_DOUBLE_TAP_MS : 0);
  };
  const value = signalValueLabel(item.signalType, item.signalValue);
  const text = cardText(item.title, item.content, item.signalType);
  const media: CardMedia[] = item.media.filter((m) => m.url).map((m) => ({ url: m.url, thumbnailUrl: m.thumbnailUrl ?? null, type: m.type === 'Video' ? 'Video' : 'Image', width: m.width ?? null, height: m.height ?? null }));
  const hasMedia = media.length > 0;
  const distance = feedDistanceLabel(item.distanceMeters, lang);
  const likeable = canLikeFeedItem(item, myUserId);
  const freshness = freshnessTier(item.createdAtUtc, item.expiresAtUtc);
  const authorLabel = item.anonymous ? t('discover.anonymous') : item.authorName;
  // State-first header: the place, and what THIS post reported about it. Only a server-verified post can wear a live ring.
  const reported = item.verified ? postLiveState(item, Date.now()) : null;
  const liveState = reported && reported.source === 'live' ? reported : null;
  const placeTitle = item.locationName || null;
  const title = placeTitle ?? authorLabel;
  const authorTappable = !item.anonymous && Boolean(onOpenAuthor);
  const headMeta = [formatAge(item.createdAtUtc), distance].filter(Boolean).join(' · ');
  const openHead = () => { if (item.placeId && onShowOnMap) onShowOnMap(item); else onOpenAuthor?.(item); };
  const headTappable = Boolean((item.placeId && onShowOnMap) || authorTappable);
  // With a place the header opens the map, so the author link inside it is out of a screen reader's reach: name the author in the label and offer the profile as an action.
  const authorInLabel = placeTitle && authorLabel ? `, ${authorLabel}` : '';
  const authorAction = placeTitle && authorTappable && item.placeId && onShowOnMap;

  // The state is shown once, in one colour: the header pill. Without a live state (an observation, an expired or
  // unverified post) a quiet grey chip still says what kind of signal this is.
  const badge = liveState && !item.sensitive ? null : (
    <View style={styles.typeRow}>
      {liveState ? null : (
        <View style={[styles.typeBadge, { backgroundColor: colors.surfaceElevated }]}>
          <SignalSymbol color={colors.textSecondary} size={14} type={item.signalType} />
          <Text style={[styles.typeText, { color: colors.textSecondary }]}>{signalLabels[item.signalType] ?? 'Sinyal'}{value ? ` · ${value}` : ''}</Text>
        </View>
      )}
      {item.sensitive ? (
        <View style={styles.sensitive} testID="feed-sensitive">
          <ShieldAlert color={colors.textSecondary} size={12} />
          <Text style={styles.sensitiveText}>{t('discover.sensitive')}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={[styles.card, item.expired && styles.expired]} testID={`feed-card-${item.id}`}>
      <View style={styles.head}>
        <AnimatedPressable
          accessibilityActions={authorAction ? [{ name: 'openAuthor', label: t('discover.openAuthor') }] : undefined}
          accessibilityLabel={liveState ? liveA11yLabel(`${title}${authorInLabel}`, liveState) : `${title}${authorInLabel}. ${headMeta}`}
          accessibilityRole="button"
          disabled={!headTappable}
          onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'openAuthor') onOpenAuthor?.(item); }}
          onPress={openHead}
          pressScale={0.98}
          style={styles.author}
          testID={`feed-head-${item.id}`}
        >
          <LiveRing freshness={liveState?.freshness ?? 0} kind={liveState?.kind ?? 'unknown'} size={liveRingSize.card}>
            <PlaceSymbol category={placeCategory} color={liveState ? liveColors[liveState.kind] : colors.textSecondary} size={20} />
          </LiveRing>
          <View style={styles.authorCopy}>
            <Text numberOfLines={1} style={styles.authorName}>{title}</Text>
            <Text numberOfLines={1} style={styles.meta}>
              {placeTitle ? (
                <>
                  <Text accessibilityRole={authorTappable ? 'link' : undefined} onPress={authorTappable ? () => onOpenAuthor?.(item) : undefined} style={authorTappable ? styles.authorLink : undefined}>{authorLabel}</Text>
                  {headMeta ? ` · ${headMeta}` : ''}
                </>
              ) : headMeta}
            </Text>
          </View>
        </AnimatedPressable>
        {/* One freshness rule (plan-devam A8): "Canlı" only for a server-verified signal under 15 minutes. */}
        {liveState
          ? <StatusPill kind={liveState.kind} label={stateLabel(liveState)} style={styles.pill} />
          : freshness === 'live' && item.verified
            ? <View style={styles.live}><Radio color={colors.primary} size={12} /><Text style={styles.liveText}>{t(freshnessLabelKey(freshness, true))}</Text></View>
            : <Text style={styles.meta}>{t(freshnessLabelKey(item.expired ? 'expired' : freshness, Boolean(item.verified)))}</Text>}
      </View>

      <View style={styles.bodyHost}>
      {hasMedia ? (
        width > 0 ? (
          <View style={styles.mediaBleed}>
            <MediaCarousel
              accessibilityLabel={`${signalLabels[item.signalType] ?? ''}${value ? `, ${value}` : ''}`}
              items={media}
              heart={false}
              onDoubleTap={onDoubleTap && likeable ? doubleTapLike : undefined}
              onOpen={() => onOpenThread(item)}
              playing={playing}
              rounded={false}
              videoControls={videoControls}
              width={width}
            />
          </View>
        ) : <View style={styles.mediaPlaceholder} />
      ) : (
        <AnimatedPressable accessibilityLabel={`${signalLabels[item.signalType] ?? ''}${value ? `, ${value}` : ''}. ${t('discover.comments')}`} accessibilityRole="button" onPress={onTextPress} pressScale={0.99} style={styles.textBlock}>
          {badge}
          {text ? <RichText mentions={item.mentions} numberOfLines={4} onHashtag={onHashtag} onMention={onMention} style={styles.content} text={text} /> : null}
        </AnimatedPressable>
      )}
      <ReactionBurst emoji={burst.emoji} trigger={burst.n} />
      </View>

      {hideActions ? null : <View style={styles.actions}>
        <ReactionButton
          disabled={!likeable}
          onPick={(reaction) => { if (reaction) pop(reaction); if (onReact) onReact(item, reaction); else onLike(item); }}
          onTap={() => { if (!reactionStateOf(item).mine) pop(HEART_EMOJI); onLike(item); }}
          size={22}
          state={reactionStateOf(item)}
          testID={`feed-like-${item.id}`}
        />
        <AnimatedPressable accessibilityLabel={t('discover.comments')} accessibilityRole="button" onPress={() => onOpenThread(item)} pressScale={0.9} style={styles.action}>
          <MessageCircle color={colors.text} size={22} />
          <Text style={styles.actionCount}>{formatCount(item.commentCount, lang)}</Text>
        </AnimatedPressable>
        {onShare ? (
          <AnimatedPressable accessibilityLabel={tx('signal:engagement.shareChat', 'Sohbette paylaş')} accessibilityRole="button" onPress={() => onShare(item)} pressScale={0.9} style={styles.action} testID={`feed-share-${item.id}`}>
            <Send color={colors.text} size={21} />
          </AnimatedPressable>
        ) : null}
        {item.placeId && onShowOnMap ? (
          <AnimatedPressable accessibilityRole="button" onPress={() => onShowOnMap(item)} pressScale={0.95} style={[styles.action, styles.mapLink]}>
            <MapPin color={colors.textSecondary} size={16} />
            <Text style={styles.meta}>{t('discover.showOnMap')}</Text>
          </AnimatedPressable>
        ) : null}
      </View>}

      {hasMedia ? badge : null}
      {hasMedia && text ? (
        <AnimatedPressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)} pressScale={1} testID={`feed-caption-${item.id}`}>
          <Text numberOfLines={expanded ? undefined : CAPTION_LINES} style={styles.content}>
            <Text style={styles.captionName}>{authorLabel} </Text>
            <RichText mentions={item.mentions} onHashtag={onHashtag} onMention={onMention} style={styles.content} text={text} />
          </Text>
          {!expanded && text.length > 90 ? <Text style={styles.more}>{t('discover.more')}</Text> : null}
        </AnimatedPressable>
      ) : null}
      {!hideActions && item.commentCount > 1 ? (
        <AnimatedPressable accessibilityRole="button" onPress={() => onOpenThread(item)} pressScale={0.98} testID={`feed-all-comments-${item.id}`}>
          <Text style={styles.meta}>{t('discover.allComments', { count: item.commentCount })}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bodyHost: { position: 'relative' },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.sm, overflow: 'hidden', padding: spacing.lg, ...shadowSoft },
  expired: { opacity: 0.6 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  author: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minHeight: 44 },
  authorLink: { color: colors.text, fontWeight: '600' },
  pill: { alignSelf: 'center', flexShrink: 0 },
  authorCopy: { flex: 1 },
  authorName: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  live: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  liveText: { ...typography.label, color: colors.primary },
  mediaBleed: { marginHorizontal: -spacing.lg },
  mediaPlaceholder: { aspectRatio: 4 / 5, backgroundColor: colors.surfaceElevated, marginHorizontal: -spacing.lg },
  textBlock: { gap: spacing.xs },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeBadge: { alignItems: 'center', borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  typeText: { ...typography.label },
  sensitive: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sensitiveText: { ...typography.label, color: colors.textSecondary },
  content: { ...typography.body, color: colors.text },
  captionName: { ...typography.bodyStrong, color: colors.text },
  more: { ...typography.caption, color: colors.textSecondary },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  action: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44 },
  actionCount: { ...typography.bodyStrong, color: colors.text },
  mapLink: { marginLeft: 'auto' },
});
