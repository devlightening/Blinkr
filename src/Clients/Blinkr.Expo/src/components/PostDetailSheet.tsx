import { Bookmark, Camera, Clock3, Compass, Image as ImageIcon, MapPin, MessageCircle, Share2, ShieldCheck, X } from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { toAbsoluteUrl } from '../api';
import { formatAge, formatCategory, formatDistance, signalLabels } from '../presentation';
import { isPlaceSaved, savePlace, unsavePlace } from '../savedPlaces';
import { categoryTone, colors, radii, signalColors, spacing, typography } from '../theme';
import type { BlinkrMedia, BlinkrPlace, CoordinateSignal, RecentSignal } from '../types';
import { signalValueLabel, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { Sheet } from './Sheet';
import { SignalSymbol } from './SignalSymbol';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';
import { BlinkrSignalCard } from './ui/BlinkrSignalCard';

type Props = {
  isLoading: boolean;
  onClose: () => void;
  onCreateSignal: () => void;
  place: BlinkrPlace | null;
  signal?: CoordinateSignal | null;
  /** Saved places are stored per user on this device. */
  userId: string;
};

const MAX_PHOTOS = 3;

const formatConfidence = (label?: string | null) =>
  label?.toUpperCase() === 'HIGH' ? 'Yüksek güven' : label?.toUpperCase() === 'MEDIUM' ? 'Orta güven' : 'Yeni sinyal';

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

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <View style={styles.stat}>
    {icon}
    <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
    <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
  </View>
);

const SignalItem = ({ signal, index }: { signal: RecentSignal; index: number }) => {
  const type = signal.signalType ?? 'GeneralObservation';
  const firstMedia = signal.media?.[0];
  return (
    <Animated.View entering={FadeInUp.duration(320).delay(Math.min(index, 6) * 45)}>
      <BlinkrSignalCard
        ageLabel={formatAge(signal.createdAtUtc)}
        authorLabel={signal.authorName || 'Topluluk üyesi'}
        media={firstMedia ? <MediaThumb media={firstMedia} style={styles.signalMedia} /> : undefined}
        signalType={type}
        text={signal.text}
        title={signal.title || 'Yeni yer sinyali'}
        tone={signalColors[type] ?? colors.mint}
        trustLabel={trustLabel(signal.publicationTrust)}
        typeLabel={signalLabels[type] ?? 'Sinyal'}
      />
    </Animated.View>
  );
};

export function PostDetailSheet({ isLoading, onClose, onCreateSignal, place, signal, userId }: Props) {
  const state = place?.currentState;
  const recentSignals = place?.recentSignals ?? [];
  const visible = Boolean(place || signal);
  const [saved, setSaved] = useState(false);

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
      {signal && !place && (
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
              title={signal.title || 'Yeni sinyal'}
              tone={signalColors[signal.signalType] ?? colors.mint}
              typeLabel={signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}
            />
          </ScrollView>
        </BlinkrSheetPanel>
      )}

      {place && (
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

            <View style={styles.statusBanner}>
              <View style={styles.statusIcon}>
                {stateType ? <SignalSymbol color={colors.mint} size={22} type={stateType} /> : <Clock3 color={colors.textSecondary} size={22} />}
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{stateType ? signalLabels[stateType] ?? stateType : 'Henüz taze sinyal yok'}</Text>
                <Text style={styles.subtitle}>{signalValueLabel(stateType, state?.signalValue) || 'Henüz doğrulanmış canlı gözlem yok.'}</Text>
              </View>
            </View>

            <View style={styles.stats}>
              <Stat icon={<MessageCircle color={colors.mint} size={22} />} label="sinyal" value={String(state?.activeSignalCount ?? recentSignals.length)} />
              <View style={styles.statDivider} />
              <Stat icon={<Clock3 color={colors.mint} size={22} />} label="tazelik" value={formatFreshness(state?.freshness)} />
              <View style={styles.statDivider} />
              <Stat icon={<ShieldCheck color={colors.mint} size={22} />} label="güven" value={formatConfidence(state?.confidence)} />
              {distance ? (
                <>
                  <View style={styles.statDivider} />
                  <Stat icon={<MapPin color={colors.mint} size={22} />} label="uzaklık" value={distance} />
                </>
              ) : null}
            </View>

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
                {recentSignals.map((item, index) => <SignalItem index={index} key={item.postId} signal={item} />)}
              </View>
            )}
          </ScrollView>
        </BlinkrSheetPanel>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoRail: { flexDirection: 'row', gap: spacing.sm, height: 148, marginBottom: spacing.lg },
  photo: { backgroundColor: colors.surfaceElevated, borderRadius: radii.card, height: '100%' },
  photoMain: { flex: 2.4 },
  photoSide: { flex: 1 },
  photoMore: { alignItems: 'center', borderColor: colors.border, borderWidth: 1, justifyContent: 'center' },
  photoMoreText: { ...typography.heading, color: colors.text },
  photoMoreLabel: { ...typography.caption, color: colors.textSecondary },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  placeIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 2, height: 52, justifyContent: 'center', width: 52 },
  signalIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.pill, borderWidth: 2, height: 52, justifyContent: 'center', width: 52 },
  headerText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  body: { marginTop: spacing.lg },
  loading: { marginBottom: spacing.md },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBanner: { alignItems: 'center', backgroundColor: colors.greenSoft, borderColor: colors.greenLine, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  statusIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  statusCopy: { flex: 1 },
  statusTitle: { ...typography.bodyStrong, color: colors.mint },
  stats: { alignItems: 'stretch', backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', marginTop: spacing.md, paddingVertical: spacing.md },
  stat: { alignItems: 'center', flex: 1, gap: 2, paddingHorizontal: 4 },
  statValue: { ...typography.bodyStrong, color: colors.text, fontSize: 15 },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statDivider: { backgroundColor: colors.border, width: 1 },
  // One row like the design: a wide lime CTA plus three fixed tiles. On very narrow screens the tiles
  // wrap under the CTA instead of squeezing its label.
  actions: { alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  primaryAction: { flexBasis: 146, flexGrow: 1, minWidth: 146, paddingHorizontal: 10 },
  actionTile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: 4, justifyContent: 'center', minHeight: 64, width: 56 },
  actionLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xl },
  sectionLabel: { ...typography.heading, color: colors.text },
  sectionCount: { ...typography.caption, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, color: colors.textSecondary, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 },
  signalList: { gap: spacing.md, paddingBottom: spacing.sm },
  signalMedia: { backgroundColor: colors.surfaceElevated, height: 96, width: 96 },
});
