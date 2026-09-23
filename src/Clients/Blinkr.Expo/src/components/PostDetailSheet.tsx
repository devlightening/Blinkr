import { Bookmark, Camera, Check, Clock3, Compass, Flag, Image as ImageIcon, MapPin, MessageCircle, RefreshCw, Share2, ShieldCheck, X } from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';

import { toAbsoluteUrl } from '../api';
import { formatAge, formatCategory, formatDistance, meaningfulTitle, signalLabels } from '../presentation';
import { isPlaceSaved, savePlace, unsavePlace } from '../savedPlaces';
import { categoryTone, colors, radii, signalColors, spacing, typography } from '../theme';
import type { AuthResponse, BlinkrMedia, BlinkrPlace, CoordinateSignal, RecentSignal, SignalType } from '../types';
import type { ReportReasonId } from '../friends';
import { emergencyNumber, placeSensitivity } from '../placeSafety';
import { recheckSignal, signalValueLabel, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { ReportPanel } from './ReportPanel';
import { Sheet } from './Sheet';
import { SignalSymbol } from './SignalSymbol';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';
import { SignalThreadPanel } from './signal/SignalThreadPanel';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrChip } from './ui/BlinkrChip';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';
import { BlinkrSignalCard } from './ui/BlinkrSignalCard';
import { StatRow } from './ui/BlinkrStatRow';

type Props = {
  /** Signed-in session: likes and comments. Without it the thread is read-only. */
  auth?: AuthResponse | null;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  /** Reports a person (a comment's author). Rejects with the failure to show. */
  onReportUser?: (userId: string, reason: ReportReasonId, note: string) => Promise<void>;
  isLoading: boolean;
  onClose: () => void;
  onCreateSignal: () => void;
  /** Answer to "Hâlâ böyle mi?": confirm the current value, or say it changed. Both open the composer pre-filled. */
  onRecheck?: (mode: 'confirm' | 'changed', signal: { type: SignalType; value: string }) => void;
  /** Files a report about one signal (wrong or inappropriate content). Rejects with the failure to show. */
  onReportSignal?: (postId: string, reason: ReportReasonId, note: string) => Promise<void>;
  place: BlinkrPlace | null;
  signal?: CoordinateSignal | null;
  /** Saved places are stored per user on this device. */
  userId: string;
};

const MAX_PHOTOS = 3;

// The axis name ("güven") is the StatRow label, shown once; the value never repeats it (sinyal-mvp-plan AUDIT #1: "Orta güven güven").
const formatConfidence = (label?: string | null) =>
  label?.toUpperCase() === 'HIGH' ? 'Yüksek' : label?.toUpperCase() === 'MEDIUM' ? 'Orta' : 'Yeni';

const formatFreshness = (freshness?: string | null) => {
  if (freshness?.toUpperCase() === 'FRESH') return 'Taze';
  if (['RECENT', 'STALE'].includes(freshness?.toUpperCase() ?? '')) return 'Yakın zamanda';
  if (freshness?.toUpperCase() === 'EXPIRED') return 'Süresi doldu';
  return 'Beklemede';
};

const openDirections = (place: BlinkrPlace) => {
  const label = encodeURIComponent(place.name);
  const url = Platform.select({
    ios: `maps://?daddr=${place.latitude},${place.longitude}&q=${label}`,
    android: `geo:0,0?q=${place.latitude},${place.longitude}(${label})`,
    default: `https://maps.google.com/?q=${place.latitude},${place.longitude}`,
  });
  Linking.openURL(url ?? `https://maps.google.com/?q=${place.latitude},${place.longitude}`).catch(() => Alert.alert('Yol tarifi açılamadı'));
};

const MediaThumb = ({ media, style }: { media: BlinkrMedia; style: object }) => {
  const url = toAbsoluteUrl(media.thumbnailUrl ?? media.url);
  if (!url) return null;
  if (media.mediaType === 'Video' && media.url) {
    const videoUrl = toAbsoluteUrl(media.url);
    if (videoUrl) return <VideoPreview style={style} uri={videoUrl} />;
  }
  return <Image accessibilityIgnoresInvertColors source={{ uri: url }} style={style} />;
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
        <MediaThumb key={key} media={media} style={[styles.photo, index === 0 ? styles.photoMain : styles.photoSide]} />
      ))}
      {extra > 0 && (
        <View style={[styles.photo, styles.photoSide, styles.photoMore]}>
          <Text style={styles.photoMoreText}>+{extra}</Text>
          <Text style={styles.photoMoreLabel}>Fotoğraf</Text>
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

/** Health places: a calm, permanent pointer to real help (sinyal-mvp-plan 11_SAFETY §3 HealthNotice). */
const HealthNotice = () => {
  const { t } = useTranslation('signal');
  const number = emergencyNumber(Localization.getLocales()[0]?.regionCode);
  return (
    <View accessibilityRole="summary" style={styles.healthNotice} testID="health-notice">
      <View style={styles.flex1}>
        <Text style={styles.healthTitle}>{t('health.title')}</Text>
        <Text style={styles.subtitle}>{t('health.body', { number })}</Text>
      </View>
      <AnimatedPressable accessibilityRole="button" onPress={() => { Linking.openURL(`tel:${number}`).catch(() => {}); }} pressScale={0.95} style={styles.healthCall}>
        <Text style={styles.healthCallText}>{t('health.call', { number })}</Text>
      </AnimatedPressable>
    </View>
  );
};

const ReportLink = ({ onPress }: { onPress: () => void }) => (
  <AnimatedPressable accessibilityLabel="Bu sinyali bildir" accessibilityRole="button" onPress={onPress} pressScale={0.97} style={styles.reportLink}>
    <Flag color={colors.textSecondary} size={14} />
    <Text style={styles.reportText}>Bildir</Text>
  </AnimatedPressable>
);

const SignalItem = ({ signal, index, onReport, onOpenThread }: { signal: RecentSignal; index: number; onReport?: () => void; onOpenThread?: () => void }) => {
  const type = signal.signalType ?? 'GeneralObservation';
  const firstMedia = signal.media?.[0];
  return (
    <View>
      <BlinkrSignalCard
        ageLabel={formatAge(signal.createdAtUtc)}
        authorLabel={signal.authorName || 'Topluluk üyesi'}
        media={firstMedia ? <MediaThumb media={firstMedia} style={styles.signalMedia} /> : undefined}
        signalType={type}
        text={signal.text}
        title={meaningfulTitle(signal.title, signalLabels[type])}
        tone={signalColors[type] ?? colors.mint}
        trustLabel={trustLabel(signal.publicationTrust)}
        typeLabel={signalLabels[type] ?? 'Sinyal'}
      />
      <View style={styles.itemLinks}>
        {onOpenThread ? (
          <AnimatedPressable accessibilityLabel="Beğeni ve yorumlar" accessibilityRole="button" onPress={onOpenThread} pressScale={0.97} style={styles.reportLink} testID={`open-thread-${signal.postId}`}>
            <MessageCircle color={colors.textSecondary} size={14} />
            <Text style={styles.reportText}>Yorumlar</Text>
          </AnimatedPressable>
        ) : null}
        {onReport ? <ReportLink onPress={onReport} /> : null}
      </View>
    </View>
  );
};

export function PostDetailSheet({ auth = null, refresh, onReportUser, isLoading, onClose, onCreateSignal, onRecheck, onReportSignal, place, signal, userId }: Props) {
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
      Alert.alert('Yer kaydedilemedi', err instanceof Error && err.message.startsWith('En fazla') ? err.message : 'Tekrar dene.');
    }
  };

  if (!visible) return null;

  const tone = place ? categoryTone(place.category) : colors.mint;
  const stateType = state?.signalType ?? null;
  const distance = place ? formatDistance(place.distanceMeters) : '';

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
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{signal.locationName || 'Yaklaşık konum sinyali'}</Text>
              <Text style={styles.subtitle}>Yaklaşık konum · {formatAge(signal.createdAtUtc)}</Text>
            </View>
            <AnimatedPressable accessibilityLabel="Kapat" accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
              <X color={colors.text} size={22} />
            </AnimatedPressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {isLoading && <ActivityIndicator accessibilityLabel="İçerik yükleniyor" color={colors.mint} style={styles.loading} />}
            <BlinkrSignalCard
              ageLabel={formatAge(signal.createdAtUtc)}
              authorLabel={signal.authorPreview || 'Topluluk üyesi'}
              media={signal.media?.[0]
                ? <MediaThumb media={signal.media[0]} style={styles.signalMedia} />
                : signal.mediaThumbnailUrl
                  ? <Image accessibilityIgnoresInvertColors source={{ uri: toAbsoluteUrl(signal.mediaThumbnailUrl) ?? signal.mediaThumbnailUrl }} style={styles.signalMedia} />
                  : undefined}
              signalType={signal.signalType}
              text={signal.content ?? signal.textPreview}
              title={meaningfulTitle(signal.title, signalLabels[signal.signalType ?? 'GeneralObservation'])}
              tone={signalColors[signal.signalType] ?? colors.mint}
              typeLabel={signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}
            />
            <View style={styles.itemLinks}>
              {signal.postId ? (
                <AnimatedPressable
                  accessibilityLabel="Beğeni ve yorumlar"
                  accessibilityRole="button"
                  onPress={() => setThread({ postId: signal.postId, title: signal.title, text: signal.content ?? signal.textPreview, signalType: signal.signalType, signalValue: signal.signalValue, createdAtUtc: signal.createdAtUtc, authorName: signal.authorPreview, media: signal.media })}
                  pressScale={0.97}
                  style={styles.reportLink}
                  testID="open-thread-signal"
                >
                  <MessageCircle color={colors.textSecondary} size={14} />
                  <Text style={styles.reportText}>Beğeni ve yorumlar</Text>
                </AnimatedPressable>
              ) : null}
              {onReportSignal && signal.postId ? <ReportLink onPress={() => setReportTarget({ postId: signal.postId, label: signal.title || 'Yaklaşık konum sinyali' })} /> : null}
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
              <AnimatedPressable accessibilityLabel="Kapat" accessibilityRole="button" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
                <X color={colors.text} size={22} />
              </AnimatedPressable>
            </View>

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.mint} size="small" />
                <Text style={styles.subtitle}>Yer detayı yenileniyor</Text>
              </View>
            )}

            {placeSensitivity(place.category) === 'health' ? <HealthNotice /> : null}

            <View style={styles.statusBanner}>
              <View style={styles.statusIcon}>
                {stateType ? <SignalSymbol color={colors.mint} size={22} type={stateType} /> : <Clock3 color={colors.textSecondary} size={22} />}
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{stateType ? signalLabels[stateType] ?? stateType : 'Henüz taze sinyal yok'}</Text>
                <Text style={styles.subtitle}>{signalValueLabel(stateType, state?.signalValue) || 'Henüz doğrulanmış canlı gözlem yok.'}</Text>
              </View>
            </View>

            <StatRow
              items={[
                { key: 'signals', icon: <MessageCircle color={colors.mint} size={22} />, label: 'sinyal', value: String(state?.activeSignalCount ?? recentSignals.length) },
                { key: 'freshness', icon: <Clock3 color={colors.mint} size={22} />, label: 'tazelik', value: formatFreshness(state?.freshness) },
                { key: 'confidence', icon: <ShieldCheck color={colors.mint} size={22} />, label: 'güven', value: formatConfidence(state?.confidence) },
                ...(distance ? [{ key: 'distance', icon: <MapPin color={colors.mint} size={22} />, label: 'uzaklık', value: distance }] : []),
              ]}
              style={styles.stats}
            />

            {recheck && onRecheck ? (
              <View style={styles.recheck}>
                <Text style={styles.recheckTitle}>Hâlâ böyle mi?</Text>
                <Text style={styles.recheckHint}>Buradaysan cevabın bu yerin canlı durumunu güncel tutar.</Text>
                <View style={styles.recheckRow}>
                  <BlinkrChip accessibilityLabel="Evet, hâlâ böyle" selected={false} icon={(color) => <Check color={color} size={18} />} label="Evet, hâlâ böyle" onPress={() => onRecheck('confirm', recheck)} />
                  <BlinkrChip accessibilityLabel="Değişti" selected={false} icon={(color) => <RefreshCw color={color} size={18} />} label="Değişti" onPress={() => onRecheck('changed', recheck)} />
                </View>
              </View>
            ) : null}

            <View style={styles.actions}>
              <BlinkrButton
                icon={<Camera color={colors.ink} size={22} />}
                label="Sinyal bırak"
                onPress={onCreateSignal}
                size="lg"
                style={styles.primaryAction}
                subtitle="Burada neler oluyor?"
              />
              <ActionTile
                accessibilityLabel={saved ? 'Kayıttan kaldır' : 'Kaydet'}
                icon={<Bookmark color={colors.text} fill={saved ? colors.primary : 'none'} size={24} />}
                label={saved ? 'Kayıtlı' : 'Kaydet'}
                onPress={toggleSaved}
                selected={saved}
              />
              <ActionTile
                icon={<Share2 color={colors.text} size={24} />}
                label="Paylaş"
                onPress={() => Share.share({ message: `${place.name} · ${formatCategory(place.category)}\nhttps://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.latitude},${place.longitude}` }).catch(() => Alert.alert('Paylaşılamadı'))}
              />
              <ActionTile accessibilityLabel="Yol tarifi" icon={<Compass color={colors.text} size={24} />} label="Yol tarifi" onPress={() => openDirections(place)} />
            </View>

            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionLabel}>Son sinyaller</Text>
              <Text style={styles.sectionCount}>{recentSignals.length}</Text>
            </View>
            {recentSignals.length === 0 ? (
              <BlinkrEmptyState
                description="İlk sinyali paylaşarak haritadaki kararı kolaylaştırabilirsin."
                icon={<ImageIcon color={colors.textSecondary} size={28} />}
                title="Bu yer için taze içerik bekleniyor"
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
  itemLinks: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end' },
  reportLink: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 36, paddingHorizontal: spacing.sm },
  reportText: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { ...typography.heading, color: colors.text },
  sectionCount: { ...typography.caption, color: colors.textSecondary },
  signalList: { gap: spacing.md, paddingBottom: spacing.sm },
  signalMedia: { backgroundColor: colors.surfaceElevated, height: 80, width: 80 },
});
