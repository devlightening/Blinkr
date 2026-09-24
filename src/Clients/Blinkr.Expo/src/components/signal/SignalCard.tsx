import { Bookmark, Check, ChevronRight, Eye, EyeOff, Heart, MapPin, MessageCircle, MoreHorizontal, RefreshCw, Send, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { formatCount } from '../../engagement';
import { placeSensitivity } from '../../placeSafety';
import { formatAge, formatDistance, signalLabels } from '../../presentation';
import { freshnessProgress, isFreshnessPulseDue, signalValueLabel } from '../../productPresentation';
import { timeLeft, type CardSignal, type VerifyState } from '../../signalCard';
import { colors, radii, signalColors, signalInks, signalTints, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { PlaceSymbol } from '../PlaceSymbol';
import { SignalSymbol } from '../SignalSymbol';
import { FreshnessRing } from '../ui/BlinkrFreshnessRing';
import { TypeBadge } from '../ui/BlinkrTypeBadge';
import { HealthNotice } from './HealthNotice';
import { MediaCarousel } from './MediaCarousel';

export type TopComment = { authorName: string; text: string } | null;

type Props = {
  card: CardSignal;
  width: number;
  /** Metres from the device to the signal's place/area, when known. */
  distanceMeters: number | null;
  verify: VerifyState;
  /** "Hâlâ böyle mi?" makes sense only for a place with a structured live value. */
  showVerify: boolean;
  confirmed: boolean;
  verifyBusy: boolean;
  topComment: TopComment;
  saved: boolean;
  onLike: () => void;
  onDoubleTapLike: () => void;
  onOpenMedia: (index: number) => void;
  onOpenThread: (focusInput: boolean) => void;
  onShare: () => void;
  onSave?: () => void;
  onMenu: () => void;
  onOpenAuthor: () => void;
  onOpenPlace?: () => void;
  onVerify: (mode: 'confirm' | 'changed') => void;
};

/**
 * One signal as the centre card (plan-devam C3, plan 04 §2.1): who and how fresh, the media drawn whole (or a tinted
 * text card), where, what they said, health help at health places, "Hâlâ böyle mi?", actions and the best comment.
 * The card never shows a separate title; the type badge says what kind of signal it is.
 */
export function SignalCard({
  card, width, distanceMeters, verify, showVerify, confirmed, verifyBusy, topComment, saved,
  onLike, onDoubleTapLike, onOpenMedia, onOpenThread, onShare, onSave, onMenu, onOpenAuthor, onOpenPlace, onVerify,
}: Props) {
  const { t, i18n } = useTranslation(['signal', 'common']);
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const [expanded, setExpanded] = useState(false);
  const type = card.signalType;
  const tone = signalColors[type] ?? colors.mint;
  const typeLabel = signalLabels[type] ?? t('signal:card.signal');
  const valueLabel = signalValueLabel(type, card.signalValue) || null;
  const left = timeLeft(card.expiresAtUtc);
  const leftText = left
    ? t('signal:card.left', { time: left.hours > 0 ? t('signal:card.hoursMinutes', { h: left.hours, m: left.minutes }) : t('signal:card.minutes', { m: left.minutes }) })
    : t('common:freshness.expired');
  const name = card.anonymous ? t('signal:card.anonymous') : card.authorName ?? t('signal:card.anonymous');
  const mediaWidth = width - spacing.lg * 2;
  const hasMedia = card.media.length > 0;
  const health = placeSensitivity(card.placeCategory) === 'health';
  const verifyHint = verify.reason === 'far' ? t('signal:card.farHint') : verify.reason === 'mine' ? t('signal:card.mineHint') : verify.reason === 'noLocation' ? t('signal:card.noLocationHint') : null;

  return (
    <View style={[styles.card, { width }]} testID={`signal-card-${card.postId}`}>
      <View style={styles.head}>
        <AnimatedPressable accessibilityRole="button" disabled={card.anonymous || !card.authorId} onPress={onOpenAuthor} style={styles.author}>
          <FreshnessRing color={tone} live={isFreshnessPulseDue(card.createdAtUtc)} progress={freshnessProgress(card.createdAtUtc, card.expiresAtUtc)} size={44}>
            {card.anonymous
              ? <View style={styles.anon}><EyeOff color={colors.textSecondary} size={16} /></View>
              : <Avatar seed={card.authorId ?? card.postId} size={36} />}
          </FreshnessRing>
          <View style={styles.authorCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>{name}</Text>
              {card.verified ? (
                <View accessibilityLabel={t('signal:card.onSiteHint')} style={styles.onSite} testID="card-on-site">
                  <ShieldCheck color={colors.primary} size={13} />
                  <Text style={styles.onSiteText}>{t('signal:card.onSite')}</Text>
                </View>
              ) : null}
              {card.fromGallery ? (
                <View accessibilityLabel={t('signal:card.fromGalleryHint')} style={styles.gallery} testID="card-gallery">
                  <Text style={styles.galleryText}>{t('signal:card.fromGallery')}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.meta}>{[formatAge(card.createdAtUtc ?? undefined), leftText].filter(Boolean).join(' · ')}</Text>
          </View>
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={t('signal:card.menu')} accessibilityRole="button" hitSlop={8} onPress={onMenu} style={styles.iconButton} testID="card-menu">
          <MoreHorizontal color={colors.text} size={22} />
        </AnimatedPressable>
      </View>

      {hasMedia ? (
        <MediaCarousel
          accessibilityLabel={`${typeLabel}${valueLabel ? `, ${valueLabel}` : ''}`}
          items={card.media}
          onDoubleTap={onDoubleTapLike}
          onOpen={onOpenMedia}
          overlayStart={<View style={styles.badgeOnMedia}><TypeBadge signalType={type} tone={tone} typeLabel={typeLabel} valueLabel={valueLabel} /></View>}
          width={mediaWidth}
        />
      ) : (
        // A text-only signal: a soft tinted panel with the type, big value and what they said (plan 04 §2.1).
        <View style={[styles.textCard, { backgroundColor: `${signalTints[type] ?? colors.primary}33` }]} testID="card-text">
          <View style={[styles.textIcon, { backgroundColor: signalTints[type] ?? colors.primary }]}>
            <SignalSymbol color={signalInks[type] ?? colors.text} size={26} type={type} />
          </View>
          <Text style={[styles.textType, { color: tone }]}>{typeLabel}</Text>
          {valueLabel ? <Text style={styles.textValue}>{valueLabel}</Text> : null}
          {card.text ? <Text style={styles.textBody}>{card.text}</Text> : null}
        </View>
      )}

      {card.placeName ? (
        <AnimatedPressable accessibilityHint={onOpenPlace ? t('signal:card.placePage') : undefined} accessibilityRole={onOpenPlace ? 'button' : undefined} disabled={!onOpenPlace} onPress={onOpenPlace} style={styles.placeRow} testID="card-place">
          {card.placeId ? <PlaceSymbol category={card.placeCategory} color={colors.textSecondary} size={18} /> : <MapPin color={colors.textSecondary} size={18} />}
          <Text numberOfLines={1} style={styles.placeName}>{card.placeName}</Text>
          {distanceMeters !== null ? <Text style={styles.meta}>{formatDistance(distanceMeters)}</Text> : null}
          {onOpenPlace ? <ChevronRight color={colors.textSecondary} size={18} /> : null}
        </AnimatedPressable>
      ) : null}

      {hasMedia && card.text ? (
        <AnimatedPressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)} pressScale={1}>
          <Text numberOfLines={expanded ? undefined : 3} style={styles.description}>{card.text}</Text>
          {card.text.length > 120 ? <Text style={styles.more}>{expanded ? t('signal:card.less') : t('signal:card.more')}</Text> : null}
        </AnimatedPressable>
      ) : null}

      {health ? <HealthNotice /> : null}

      {showVerify ? (
        <View style={styles.verify} testID="card-verify">
          <Text style={styles.verifyTitle}>{t('signal:card.verifyTitle')}</Text>
          <View style={styles.verifyRow}>
            <AnimatedPressable
              accessibilityRole="button"
              aria-selected={confirmed}
              disabled={!verify.enabled || verifyBusy || confirmed}
              onPress={() => onVerify('confirm')}
              style={[styles.verifyButton, confirmed && styles.verifyOn, (!verify.enabled && !confirmed) && styles.disabled]}
              testID="card-verify-yes"
            >
              <Check color={confirmed ? colors.ink : colors.text} size={18} />
              <Text style={[styles.verifyText, confirmed && styles.verifyTextOn]}>{confirmed ? t('signal:card.confirmed') : t('signal:card.yes')}</Text>
            </AnimatedPressable>
            <AnimatedPressable accessibilityRole="button" disabled={!verify.enabled || verifyBusy} onPress={() => onVerify('changed')} style={[styles.verifyButton, !verify.enabled && styles.disabled]} testID="card-verify-changed">
              <RefreshCw color={colors.text} size={18} />
              <Text style={styles.verifyText}>{t('signal:card.changed')}</Text>
            </AnimatedPressable>
          </View>
          {verifyHint ? <Text style={styles.meta} testID="card-verify-hint">{verifyHint}</Text> : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <AnimatedPressable
          accessibilityLabel={card.liked ? t('signal:engagement.unlike') : t('signal:engagement.like')}
          accessibilityRole="button"
          aria-selected={card.liked}
          disabled={card.isMine}
          onPress={onLike}
          style={[styles.action, card.isMine && styles.disabled]}
          testID="card-like"
        >
          <Heart color={card.liked ? colors.danger : colors.text} fill={card.liked ? colors.danger : 'none'} size={22} />
          <Text style={styles.count}>{formatCount(card.likeCount, lang)}</Text>
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={t('signal:comments.title')} accessibilityRole="button" onPress={() => onOpenThread(false)} style={styles.action} testID="card-comments">
          <MessageCircle color={colors.text} size={22} />
          <Text style={styles.count}>{formatCount(card.commentCount, lang)}</Text>
        </AnimatedPressable>
        <AnimatedPressable accessibilityLabel={t('signal:card.share')} accessibilityRole="button" onPress={onShare} style={styles.action} testID="card-share">
          <Send color={colors.text} size={21} />
        </AnimatedPressable>
        <View style={styles.flex} />
        {card.viewCount !== null ? (
          <View accessibilityLabel={t('signal:card.views', { count: card.viewCount })} style={styles.action}>
            <Eye color={colors.textSecondary} size={18} />
            <Text style={styles.meta}>{formatCount(card.viewCount, lang)}</Text>
          </View>
        ) : null}
        {onSave ? (
          <AnimatedPressable accessibilityLabel={saved ? t('signal:card.saved') : t('signal:card.save')} accessibilityRole="button" aria-selected={saved} onPress={onSave} style={styles.action} testID="card-save">
            <Bookmark color={saved ? colors.primary : colors.text} fill={saved ? colors.primary : 'none'} size={21} />
          </AnimatedPressable>
        ) : null}
      </View>

      {topComment ? (
        <AnimatedPressable accessibilityRole="button" onPress={() => onOpenThread(false)} style={styles.comment}>
          <Text numberOfLines={2} style={styles.commentText}><Text style={styles.commentAuthor}>{topComment.authorName} </Text>{topComment.text}</Text>
          {card.commentCount > 1 ? <Text style={styles.meta}>{t('signal:card.allComments', { count: card.commentCount })}</Text> : null}
        </AnimatedPressable>
      ) : null}
      <AnimatedPressable accessibilityRole="button" onPress={() => onOpenThread(true)} style={styles.addComment} testID="card-add-comment">
        <Text style={styles.addCommentText}>{t('signal:card.addComment')}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  author: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm },
  anon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  authorCopy: { flex: 1, gap: 2 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  name: { ...typography.heading, color: colors.text, flexShrink: 1 },
  onSite: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radii.pill, flexDirection: 'row', gap: 3, paddingHorizontal: 7, paddingVertical: 2 },
  onSiteText: { ...typography.micro, color: colors.primary },
  gallery: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
  galleryText: { ...typography.micro, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textSecondary },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  badgeOnMedia: { backgroundColor: colors.surface, borderRadius: radii.pill },
  textCard: { borderRadius: radii.lg, gap: spacing.xs, padding: spacing.lg },
  textIcon: { alignItems: 'center', borderRadius: radii.pill, height: 48, justifyContent: 'center', marginBottom: spacing.xs, width: 48 },
  textType: { ...typography.label },
  textValue: { ...typography.headline, color: colors.text },
  textBody: { ...typography.body, color: colors.text },
  placeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  placeName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  description: { ...typography.body, color: colors.text },
  more: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  verify: { backgroundColor: colors.surfaceElevated, borderRadius: radii.md, gap: spacing.sm, padding: spacing.md },
  verifyTitle: { ...typography.heading, color: colors.text },
  verifyRow: { flexDirection: 'row', gap: spacing.sm },
  verifyButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 44 },
  verifyOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  verifyText: { ...typography.button, color: colors.text },
  verifyTextOn: { color: colors.ink },
  disabled: { opacity: 0.45 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  action: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 44, minWidth: 44, paddingHorizontal: 4 },
  count: { ...typography.number, color: colors.text },
  flex: { flex: 1 },
  comment: { gap: 2 },
  commentText: { ...typography.body, color: colors.text },
  commentAuthor: { ...typography.bodyStrong, color: colors.text },
  addComment: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg },
  addCommentText: { ...typography.body, color: colors.textSecondary },
});
