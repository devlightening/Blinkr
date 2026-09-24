import { Bookmark, Camera, Check, Clock3, Compass, Flag, Image as ImageIcon, Layers, MapPin, MessageCircle, RefreshCw, Share2, ShieldCheck, X, Zap } from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toAbsoluteUrl } from '../api';
import { formatAge, formatCategory, formatDistance, signalLabels } from '../presentation';
import { cardText } from '../signalCard';
import { isPlaceSaved, savePlace, unsavePlace } from '../savedPlaces';
import { categoryTone, colors, radii, signalColors, spacing, typography } from '../theme';
import type { AuthResponse, BlinkrMedia, BlinkrPlace, CoordinateSignal, RecentSignal, SignalType } from '../types';
import type { ReportReasonId } from '../friends';
import { placeSensitivity } from '../placeSafety';
import { confidenceKey, freshnessLabelKey, freshnessTier } from '../freshness';
import { recheckSignal, signalValueLabel, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { ReportPanel } from './ReportPanel';
import { Sheet } from './Sheet';
import { SignalSymbol } from './SignalSymbol';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';
import { HealthNotice } from './signal/HealthNotice';
import { SignalThreadPanel } from './signal/SignalThreadPanel';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrChip } from './ui/BlinkrChip';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';
import { BlinkrSignalCard } from './ui/BlinkrSignalCard';
import { StatRow } from './ui/BlinkrStatRow';
import { MediaImage } from './ui/BlinkrMediaImage';
import { tx } from '../i18n/tx';

type Props = {
  /** Signed-in session: likes and comments. Without it the thread is read-only. */
  auth?: AuthResponse | null;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  /** Reports a person (a comment's author). Rejects with the failure to show. */
  onReportUser?: (userId: string, reason: ReportReasonId, note: string) => Promise<void>;
  isLoading: boolean;
  onClose: () => void;
  onCreateSignal: () => void;
  /** Answer to tx('signal:verify.question', 'Hâlâ böyle mi?'): confirm the current value, or say it changed. Both open the composer pre-filled. */
  onRecheck?: (mode: 'confirm' | 'changed', signal: { type: SignalType; value: string }) => void;
  /** Files a report about one signal (wrong or inappropriate content). Rejects with the failure to show. */
  onReportSignal?: (postId: string, reason: ReportReasonId, note: string) => Promise<void>;
  /** V2-4: a resolved @name in a comment opens that person; a #tag opens its feed. */
  onOpenPerson?: (user: { id: string; userName: string }) => void;
  onOpenHashtag?: (tag: string) => void;
  place: BlinkrPlace | null;
  signal?: CoordinateSignal | null;
  /** Saved places are stored per user on this device. */
  userId: string;
};

const MAX_PHOTOS = 3;


const openDirections = (place: BlinkrPlace) => {
  const label = encodeURIComponent(place.name);
  const url = Platform.select({
    ios: `maps://?daddr=${place.latitude},${place.longitude}&q=${label}`,
    android: `geo:0,0?q=${place.latitude},${place.longitude}(${label})`,
    default: `https://maps.google.com/?q=${place.latitude},${place.longitude}`,
  });
  Linking.openURL(url ?? `https://maps.google.com/?q=${place.latitude},${place.longitude}`).catch(() => Alert.alert(tx('signal:place.directionsFailed', 'Yol tarifi açılamadı')));
};

/**
 * One photo, never cropped (plan-devam C4): with `whole`, it is drawn "contain" over a blurred copy of itself, so a face at
 * the edge of a wide or tall picture stays in view; small list thumbnails still fill their square.
 */
const MediaThumb = ({ media, style, whole = false }: { media: BlinkrMedia; style: object; whole?: boolean }) => {
  const url = toAbsoluteUrl(media.thumbnailUrl ?? media.url);
  if (!url) return null;
  if (media.mediaType === 'Video' && media.url) {
    const videoUrl = toAbsoluteUrl(media.url);
    if (videoUrl) return <VideoPreview style={style} uri={videoUrl} />;
  }
  if (!whole) return <MediaImage style={style} uri={url} />;
  return (
    <View style={[style, styles.wholeFrame]}>
      <Image blurRadius={20} resizeMode="cover" source={{ uri: url }} style={StyleSheet.absoluteFill} />
      <MediaImage resizeMode="contain" style={StyleSheet.absoluteFill} uri={url} />
    </View>
  );
};

/** Real photos only: whatever media the place's recent signals actually carry, never a placeholder. */
const PhotoRail = ({ signals }: { signals: RecentSignal[] }) => {
  const photos = useMemo(
    () => signals.flatMap((item) => (item.media ?? []).map((media) => ({ media, key: `${item.postId}-${media.mediaId ?? media.id ?? media.url}` }))),
    [signals],
  );
  if (photos.length === 0) return null;
  const shown = photos.slice(0, MAX_PHOTOS);
  const extra = photos.length - shown.length;
  return (
    <View style={styles.photoRail}>
      {shown.map(({ media, key }, index) => (
        <MediaThumb key={key} media={media} style={[styles.photo, index === 0 ? styles.photoMain : styles.photoSide]} whole />
      ))}
      {extra > 0 && (
        <View style={[styles.photo, styles.photoSide, styles.photoMore]}>
          <Text style={styles.photoMoreText}>+{extra}</Text>
          <Text style={styles.photoMoreLabel}>{tx('signal:place.photo', 'Fotoğraf')}</Text>
        </View>
      )}
    </View>
  );
};

const ActionTile = ({ label, icon, onPress, accessibilityLabel, selected }: { label: string; icon: React.ReactNode; onPress: () => void; accessibilityLabel?: string; selected?: boolean }) => (
  <AnimatedPressable
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityRole="button"
    aria-selected={Boolean(selected)}
    onPress={onPress}
    pressScale={0.92}
    style={styles.actionTile}
  >
    {icon}
    <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
  </AnimatedPressable>
);

const ReportLink = ({ onPress }: { onPress: () => void }) => (
  <AnimatedPressable accessibilityLabel={tx('signal:place.reportSignal', 'Bu sinyali bildir')} accessibilityRole="button" onPress={onPress} pressScale={0.97} style={styles.reportLink}>
    <Flag color={colors.textSecondary} size={14} />
    <Text style={styles.reportText}>{tx('common:actions.report', 'Bildir')}</Text>
  </AnimatedPressable>
);

const SignalItem = ({ signal, index, onReport, onOpenThread }: { signal: RecentSignal; index: number; onReport?: () => void; onOpenThread?: () => void }) => {
  const type = signal.signalType ?? 'GeneralObservation';
  const firstMedia = signal.media?.[0];
  return (
    <View>
      <BlinkrSignalCard
        ageLabel={formatAge(signal.createdAtUtc)}
        authorLabel={signal.authorName || tx('common:member', 'Topluluk üyesi')}
        media={firstMedia ? <MediaThumb media={firstMedia} style={styles.signalMedia} /> : undefined}
        signalType={type}
        text={cardText(signal.title, signal.text, type)}
        tone={signalColors[type] ?? colors.mint}
        trustLabel={trustLabel(signal.publicationTrust)}
        typeLabel={signalLabels[type] ?? 'Sinyal'}
      />
      <View style={styles.itemLinks}>
        {onOpenThread ? (
          <AnimatedPressable accessibilityLabel={tx('signal:place.engagement', 'Beğeni ve yorumlar')} accessibilityRole="button" onPress={onOpenThread} pressScale={0.97} style={styles.reportLink} testID={`open-thread-${signal.postId}`}>
            <MessageCircle color={colors.textSecondary} size={14} />
            <Text style={styles.reportText}>{tx('signal:comments.title', 'Yorumlar')}</Text>
          </AnimatedPressable>
        ) : null}
        {onReport ? <ReportLink onPress={onReport} /> : null}
      </View>
    </View>
  );
};

export function PostDetailSheet({ auth = null, refresh, onReportUser, isLoading, onClose, onCreateSignal, onRecheck, onReportSignal, place, signal, userId, onOpenPerson, onOpenHashtag }: Props) {
  const { t } = useTranslation('common');
  const state = place?.currentState;
  const recheck = onRecheck ? recheckSignal(state) : null;
  const recentSignals = place?.recentSignals ?? [];
  const visible = Boolean(place || signal);
  const [saved, setSaved] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ postId?: string; userId?: string; label: string } | null>(null);
  const [thread, setThread] = useState<RecentSignal | null>(null);

  // A different place or signal closes any half-filled report and any open thread.
  useEffect(() => { setReportTarget(null); setThread(null); }, [place?.id, signal?.postId]);

  useEffect(() => {
    let active = true;
    setSaved(false);
    if (place) isPlaceSaved(userId, place.id).then((value) => { if (active) setSaved(value); }).catch(() => {});
    return () => { active = false; };
  }, [place?.id, userId]);

  const toggleSaved = async () => {
    if (!place) return;
    try {
      if (saved) await unsavePlace(userId, place.id);
      else await savePlace(userId, place);
      setSaved(!saved);
    } catch (err) {
      Alert.alert(tx('signal:place.saveFailed', 'Yer kaydedilemedi'), err instanceof Error && err.message.startsWith('En fazla') ? err.message : tx('signal:place.tryAgain', 'Tekrar dene.'));
    }
  };

  if (!visible) return null;

  const tone = place ? categoryTone(place.category) : colors.mint;
  const stateType = state?.signalType ?? null;
  const distance = place ? formatDistance(place.distanceMeters) : '';
  // Place state only holds server-verified observations, so the shared rule may call it "Canlı" (freshness.ts).
  const freshness = freshnessTier(state?.observedAtUtc ?? place?.lastActivityUtc, state?.expiresAtUtc);

  return (
    <Sheet onClose={onClose}>
      {reportTarget && (reportTarget.userId ? onReportUser : onReportSignal) ? (
        <BlinkrSheetPanel maxHeightRatio={0.9}>
          <ReportPanel
            onDone={() => setReportTarget(null)}
            onSubmit={(reason, note) => (reportTarget.userId
              ? onReportUser!(reportTarget.userId, reason, note)
              : onReportSignal!(reportTarget.postId ?? '', reason, note))}
            subject={reportTarget.label}
            target={reportTarget.userId ? 'user' : 'signal'}
          />
        </BlinkrSheetPanel>
      ) : null}
      {!reportTarget && thread ? (
        <BlinkrSheetPanel maxHeightRatio={0.92}>
          <SignalThreadPanel
            auth={auth}
            header={<SignalItem index={0} signal={thread} />}
            onBack={place ? () => setThread(null) : undefined}
            onClose={onClose}
            onHashtag={onOpenHashtag ? (tag) => { onClose(); onOpenHashtag(tag); } : undefined}
            onMention={onOpenPerson ? (m) => { onClose(); onOpenPerson({ id: m.userId, userName: m.userName }); } : undefined}
            onReport={(target) => setReportTarget(target.kind === 'user' ? { userId: target.userId, label: target.label } : { postId: thread.postId, label: thread.title || target.label })}
            postId={thread.postId}
            refresh={refresh}
          />
        </BlinkrSheetPanel>
      ) : null}
      {!reportTarget && !thread && signal && !place && (
        <BlinkrSheetPanel maxHeightRatio={0.88}>
          <View style={styles.header}>
            <View style={[styles.signalIcon, { borderColor: signalColors[signal.signalType] ?? colors.mint }]}>
              <SignalSymbol color={signalColors[signal.signalType] ?? colors.mint} size={24} type={signal.signalType} />
            </View>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{signal.locationName || tx('signal:place.coordinateSignal', 'Yaklaşık konum sinyali')}</Text>
              <Text style={styles.subtitle}>Yaklaşık konum · {formatAge(signal.createdAtUtc)}</Text>
            </View>
            <AnimatedPressable accessibilityLabel={tx('common:actions.close', 'Kapat')} accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
              <X color={colors.text} size={22} />
            </AnimatedPressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {isLoading && <ActivityIndicator accessibilityLabel={tx('signal:place.loadingContent', 'İçerik yükleniyor')} color={colors.mint} style={styles.loading} />}
            <BlinkrSignalCard
              ageLabel={formatAge(signal.createdAtUtc)}
              authorLabel={signal.authorPreview || tx('common:member', 'Topluluk üyesi')}
              media={signal.media?.[0]
                ? <MediaThumb media={signal.media[0]} style={styles.signalMedia} />
                : signal.mediaThumbnailUrl
                  ? <Image accessibilityIgnoresInvertColors source={{ uri: toAbsoluteUrl(signal.mediaThumbnailUrl) ?? signal.mediaThumbnailUrl }} style={styles.signalMedia} />
                  : undefined}
              signalType={signal.signalType}
              text={cardText(signal.title, signal.content ?? signal.textPreview, signal.signalType ?? 'GeneralObservation')}
              tone={signalColors[signal.signalType] ?? colors.mint}
              typeLabel={signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}
            />
            <View style={styles.itemLinks}>
              {signal.postId ? (
                <AnimatedPressable
                  accessibilityLabel={tx('signal:place.engagement', 'Beğeni ve yorumlar')}
                  accessibilityRole="button"
                  onPress={() => setThread({ postId: signal.postId, title: signal.title, text: signal.content ?? signal.textPreview, signalType: signal.signalType, signalValue: signal.signalValue, createdAtUtc: signal.createdAtUtc, authorName: signal.authorPreview, media: signal.media })}
                  pressScale={0.97}
                  style={styles.reportLink}
                  testID="open-thread-signal"
                >
                  <MessageCircle color={colors.textSecondary} size={14} />
                  <Text style={styles.reportText}>{tx('signal:place.engagement', 'Beğeni ve yorumlar')}</Text>
                </AnimatedPressable>
              ) : null}
              {onReportSignal && signal.postId ? <ReportLink onPress={() => setReportTarget({ postId: signal.postId, label: signal.title || tx('signal:place.coordinateSignal', 'Yaklaşık konum sinyali') })} /> : null}
            </View>
          </ScrollView>
        </BlinkrSheetPanel>
      )}

      {!reportTarget && !thread && place && (
        <BlinkrSheetPanel maxHeightRatio={0.9}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <PhotoRail signals={recentSignals} />

            <View style={styles.header}>
              <View style={[styles.placeIcon, { borderColor: tone }]}>
                <PlaceSymbol category={place.category} color={tone} size={26} />
              </View>
              <View style={styles.headerText}>
                <Text accessibilityRole="header" style={styles.title}>{place.name}</Text>
                <Text style={styles.subtitle}>{formatCategory(place.category)}{distance ? ` · ${distance}` : ''}</Text>
              </View>
              <AnimatedPressable accessibilityLabel={tx('common:actions.close', 'Kapat')} accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
                <X color={colors.text} size={22} />
              </AnimatedPressable>
            </View>

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.mint} size="small" />
                <Text style={styles.subtitle}>{tx('signal:place.refreshing', 'Yer detayı yenileniyor')}</Text>
              </View>
            )}

            {placeSensitivity(place.category) === 'health' ? <HealthNotice /> : null}

            <View style={styles.statusBanner}>
              <View style={styles.statusIcon}>
                {stateType ? <SignalSymbol color={colors.mint} size={22} type={stateType} /> : <Clock3 color={colors.textSecondary} size={22} />}
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{stateType ? signalLabels[stateType] ?? stateType : tx('signal:place.noFresh', 'Henüz taze sinyal yok')}</Text>
                <Text style={styles.subtitle}>{signalValueLabel(stateType, state?.signalValue) || tx('signal:place.noVerified', 'Henüz doğrulanmış canlı gözlem yok.')}</Text>
              </View>
            </View>

            <StatRow
              items={[
                { key: 'signals', icon: <Layers color={colors.mint} size={18} />, text: t('common:stats.signals', { count: recentSignals.length || (state?.activeSignalCount ?? 0) }) },
                // No observation time: say nothing rather than "Henüz yok" next to a signal count.
                ...(freshness !== 'none' ? [{ key: 'freshness', icon: <Zap color={colors.mint} size={18} />, text: t(freshnessLabelKey(freshness, true)) }] : []),
                { key: 'confidence', icon: <ShieldCheck color={colors.mint} size={18} />, text: t(confidenceKey(state?.confidence)) },
                ...(distance ? [{ key: 'distance', icon: <MapPin color={colors.mint} size={18} />, text: distance }] : []),
              ]}
              style={styles.stats}
            />

            {recheck && onRecheck ? (
              <View style={styles.recheck}>
                <Text style={styles.recheckTitle}>{tx('signal:verify.question', 'Hâlâ böyle mi?')}</Text>
                <Text style={styles.recheckHint}>{tx('signal:place.recheckHint', 'Buradaysan cevabın bu yerin canlı durumunu güncel tutar.')}</Text>
                <View style={styles.recheckRow}>
                  <BlinkrChip accessibilityLabel={tx('signal:verify.yes', 'Evet, hâlâ böyle')} selected={false} icon={(color) => <Check color={color} size={18} />} label={tx('signal:verify.yes', 'Evet, hâlâ böyle')} onPress={() => onRecheck('confirm', recheck)} />
                  <BlinkrChip accessibilityLabel={tx('signal:verify.changed', 'Değişti')} selected={false} icon={(color) => <RefreshCw color={color} size={18} />} label={tx('signal:verify.changed', 'Değişti')} onPress={() => onRecheck('changed', recheck)} />
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <BlinkrButton
                icon={<Camera color={colors.ink} size={22} />}
                label={tx('signal:drop', 'Sinyal bırak')}
                onPress={onCreateSignal}
                size="lg"
                style={styles.primaryAction}
                subtitle={tx('signal:place.whatsHappening', 'Burada neler oluyor?')}
              />
              <ActionTile
                accessibilityLabel={saved ? tx('signal:place.unsave', 'Kayıttan kaldır') : tx('signal:place.save', 'Kaydet')}
                icon={<Bookmark color={colors.text} fill={saved ? colors.primary : 'none'} size={24} />}
                label={saved ? tx('signal:place.saved', 'Kayıtlı') : tx('signal:place.save', 'Kaydet')}
                onPress={toggleSaved}
                selected={saved}
              />
              <ActionTile
                icon={<Share2 color={colors.text} size={24} />}
                label={tx('common:actions.share', 'Paylaş')}
                onPress={() => Share.share({ message: `${place.name} · ${formatCategory(place.category)}\nhttps://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.latitude},${place.longitude}` }).catch(() => Alert.alert(tx('signal:place.shareFailed', 'Paylaşılamadı')))}
              />
              <ActionTile accessibilityLabel={tx('signal:place.directions', 'Yol tarifi')} icon={<Compass color={colors.text} size={24} />} label={tx('signal:place.directions', 'Yol tarifi')} onPress={() => openDirections(place)} />
            </View>

            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionLabel}>{tx('signal:place.recent', 'Son sinyaller')}</Text>
              <Text style={styles.sectionCount}>{recentSignals.length}</Text>
            </View>
            {recentSignals.length === 0 ? (
              <BlinkrEmptyState
                description={tx('signal:place.emptyHint', 'İlk sinyali paylaşarak haritadaki kararı kolaylaştırabilirsin.')}
                icon={<ImageIcon color={colors.textSecondary} size={28} />}
                title={tx('signal:place.empty', 'Bu yer için taze içerik bekleniyor')}
              />
            ) : (
              <View style={styles.signalList}>
                {recentSignals.map((item, index) => <SignalItem index={index} key={item.postId} onOpenThread={() => setThread(item)} onReport={onReportSignal ? () => setReportTarget({ postId: item.postId, label: item.title || `${place.name} sinyali` }) : undefined} signal={item} />)}
              </View>
            )}
          </ScrollView>
        </BlinkrSheetPanel>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoRail: { flexDirection: 'row', gap: spacing.sm, height: 128, marginBottom: spacing.lg },
  photo: { backgroundColor: colors.surfaceElevated, borderRadius: radii.card, height: '100%' },
  photoMain: { flex: 2.4 },
  photoSide: { flex: 1 },
  photoMore: { alignItems: 'center', borderColor: colors.border, borderWidth: 1, justifyContent: 'center' },
  photoMoreText: { ...typography.heading, color: colors.text },
  photoMoreLabel: { ...typography.caption, color: colors.textSecondary },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  placeIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  signalIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  headerText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  body: { marginTop: spacing.lg },
  loading: { marginBottom: spacing.md },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBanner: { alignItems: 'center', backgroundColor: colors.greenSoft, borderColor: colors.greenLine, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  statusIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, height: 38, justifyContent: 'center', width: 38 },
  statusCopy: { flex: 1 },
  statusTitle: { ...typography.bodyStrong, color: colors.mint },
  stats: { marginTop: spacing.md },
  // One row like the design: a wide lime CTA plus three fixed tiles. On very narrow screens the tiles
  // wrap under the CTA instead of squeezing its label.
  recheck: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.xs, marginTop: spacing.md, padding: spacing.md },
  recheckTitle: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  recheckHint: { ...typography.caption, color: colors.textSecondary },
  recheckRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actions: { alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  primaryAction: { flexBasis: 146, flexGrow: 1, minWidth: 146, paddingHorizontal: 10 },
  actionTile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: 4, justifyContent: 'center', minHeight: 56, width: 54 },
  actionLabel: { ...typography.micro, color: colors.text },
  healthNotice: { alignItems: 'center', backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  healthTitle: { ...typography.bodyStrong, color: colors.text },
  healthCall: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: radii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  healthCallText: { ...typography.label, color: colors.ink },
  flex1: { flex: 1 },
  wholeFrame: { overflow: 'hidden' },
  itemLinks: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end' },
  reportLink: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 36, paddingHorizontal: spacing.sm },
  reportText: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { ...typography.heading, color: colors.text },
  sectionCount: { ...typography.caption, color: colors.textSecondary },
  signalList: { gap: spacing.md, paddingBottom: spacing.sm },
  signalMedia: { backgroundColor: colors.surfaceElevated, height: 80, width: 80 },
});
