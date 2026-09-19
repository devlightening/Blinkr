import { Clock3, Compass, Image as ImageIcon, MessageCircle, Plus, ShieldCheck, X, Bookmark, Share2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, Share } from 'react-native';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { toAbsoluteUrl } from '../api';
import { formatAge, formatCategory, formatDistance, signalLabels } from '../presentation';
import { colors, radii, shadow, shadowSoft } from '../theme';
import type { BlinkrMedia, BlinkrPlace, CoordinateSignal, RecentSignal } from '../types';
import { signalValueLabel, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { Sheet } from './Sheet';
import { SignalSymbol } from './SignalSymbol';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';

type Props = {
  isLoading: boolean;
  onClose: () => void;
  onCreateSignal: () => void;
  place: BlinkrPlace | null;
  signal?: CoordinateSignal | null;
};

const formatConfidence = (value?: number | null, label?: string | null) => {
  return label?.toUpperCase() === 'HIGH' ? 'Yüksek güven' : label?.toUpperCase() === 'MEDIUM' ? 'Orta güven' : 'Yeni sinyal';
};

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

const MediaPreview = ({ media }: { media: BlinkrMedia }) => {
  const url = toAbsoluteUrl(media.url);
  if (!url) return null;
  if (media.mediaType === 'Video') {
    return <VideoPreview style={styles.mediaPreview} uri={url} />;
  }
  return <Image source={{ uri: url }} style={styles.mediaPreview} />;
};

const SignalCard = ({ signal, index }: { signal: RecentSignal; index: number }) => (
  <Animated.View entering={FadeInUp.duration(320).delay(Math.min(index, 6) * 45)} style={styles.signalCard}>
    <View style={styles.signalMeta}>
      <View style={styles.freshBadge}>
        <Text style={styles.freshText}>{signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}</Text>
      </View>
      <Clock3 color={colors.muted} size={15} />
      <Text style={styles.age}>{formatAge(signal.createdAtUtc)}</Text>
    </View>
    <Text style={styles.signalTitle}>{signal.title || 'Yeni yer sinyali'}</Text>
    {Boolean(signal.text) && <Text style={styles.signalText}>{signal.text}</Text>}
    <Text style={styles.age}>{signal.authorName || 'Topluluk üyesi'} · {trustLabel(signal.publicationTrust)}</Text>
    {Boolean(signal.media?.length) && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRail}>
        {signal.media?.map((item, index) => (
          <MediaPreview key={`${signal.postId}-${item.mediaId ?? item.id ?? index}`} media={item} />
        ))}
      </ScrollView>
    )}
  </Animated.View>
);

export function PostDetailSheet({ isLoading, onClose, onCreateSignal, place, signal }: Props) {
  const insets = useSafeAreaInsets();
  const state = place?.currentState;
  const recentSignals = place?.recentSignals ?? [];
  const visible = Boolean(place || signal);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    setSaved(false);
    if (place) SecureStore.getItemAsync(`blinkr.saved.${place.id}`).then(value => { if (active) setSaved(Boolean(value)); }).catch(() => {});
    return () => { active = false; };
  }, [place?.id]);
  const toggleSaved = async () => {
    if (!place) return;
    try {
      if (saved) await SecureStore.deleteItemAsync(`blinkr.saved.${place.id}`);
      else await SecureStore.setItemAsync(`blinkr.saved.${place.id}`, JSON.stringify({ id: place.id, name: place.name }));
      setSaved(!saved);
    } catch { Alert.alert('Yer kaydedilemedi', 'Tekrar dene.'); }
  };

  if (!visible) return null;

  return (
    <Sheet onClose={onClose}>
        {signal && !place && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.signalIcon}>
                <SignalSymbol type={signal.signalType} color={colors.white} size={21} />
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={styles.placeName}>{signal.locationName || 'Yaklaşık konum sinyali'}</Text>
                <Text style={styles.placeContext}>Yaklaşık konum · {formatAge(signal.createdAtUtc)}</Text>
              </View>
              <AnimatedPressable accessibilityLabel="Kapat" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
                <X color={colors.textPrimary} size={21} />
              </AnimatedPressable>
            </View>
            <ScrollView style={styles.coordinateSignalCard}>
              <View style={styles.signalMeta}>
                <View style={styles.freshBadge}>
                  <Text style={styles.freshText}>{signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}</Text>
                </View>
                <Clock3 color={colors.muted} size={15} />
                <Text style={styles.age}>{formatAge(signal.createdAtUtc)}</Text>
              </View>
              <Text style={styles.signalTitle}>{signal.title || 'Yeni sinyal'}</Text>
              <Text style={styles.signalText}>{signal.content ?? signal.textPreview}</Text>
              <Text style={styles.age}>{signal.authorPreview || 'Topluluk üyesi'}</Text>
              {isLoading && <ActivityIndicator accessibilityLabel="İçerik yükleniyor" color={colors.green} />}
              {signal.media?.length ? <ScrollView horizontal style={styles.mediaRail}>{signal.media.map((item, index) => <MediaPreview key={index} media={item} />)}</ScrollView>
                : signal.mediaThumbnailUrl && <Image source={{ uri: toAbsoluteUrl(signal.mediaThumbnailUrl) ?? signal.mediaThumbnailUrl }} style={styles.coordinateMedia} />}
            </ScrollView>
          </View>
        )}
        {place && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.placeIcon}>
                <PlaceSymbol category={place.category} color={colors.greenDark} size={24} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeContext}>{formatCategory(place.category)}{formatDistance(place.distanceMeters) ? ` · ${formatDistance(place.distanceMeters)}` : ''}</Text>
              </View>
              <AnimatedPressable accessibilityLabel="Kapat" hitSlop={10} onPress={onClose} pressScale={0.88} style={styles.close}>
                <X color={colors.textPrimary} size={21} />
              </AnimatedPressable>
            </View>

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.green} size="small" />
                <Text style={styles.loadingText}>Yer detayı yenileniyor</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statePanel}>
                <View style={styles.stateEyebrowRow}>
                  <View style={styles.statePulse} />
                  <Text style={styles.stateEyebrow}>ŞU AN</Text>
                </View>
                <Text style={styles.stateTitle}>
                  {state?.signalType ? signalLabels[state.signalType] ?? state.signalType : 'Henüz taze sinyal yok'}
                </Text>
                <Text style={styles.stateText}>
                  {signalValueLabel(state?.signalType, state?.signalValue) || 'Henüz doğrulanmış canlı gözlem yok.'}
                </Text>
                <View style={styles.stateStats}>
                  <View style={styles.statPill}>
                    <Clock3 color={colors.lime} size={14} />
                    <Text style={styles.statText}>{formatFreshness(state?.freshness)}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <ShieldCheck color={colors.lime} size={14} />
                    <Text style={styles.statText}>{formatConfidence(state?.confidenceValue, state?.confidence)}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <MessageCircle color={colors.lime} size={14} />
                    <Text style={styles.statText}>{state?.activeSignalCount ?? recentSignals.length} sinyal</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <AnimatedPressable onPress={onCreateSignal} pressScale={0.95} style={styles.primaryAction}>
                  <Plus color={colors.ink} size={18} />
                  <Text style={styles.primaryActionText}>Sinyal bırak</Text>
                </AnimatedPressable>
                <AnimatedPressable accessibilityLabel="Yol tarifi" onPress={() => openDirections(place)} pressScale={0.9} style={styles.secondaryAction}>
                  <Compass color={colors.greenDark} size={18} />
                </AnimatedPressable>
                <AnimatedPressable accessibilityLabel={saved ? 'Kayıttan kaldır' : 'Kaydet'} accessibilityState={{ selected: saved }} onPress={toggleSaved} pressScale={0.85} style={styles.secondaryAction}><Bookmark color={colors.greenDark} fill={saved ? colors.lime : 'none'} size={20} /></AnimatedPressable>
                <AnimatedPressable accessibilityLabel="Paylaş" onPress={() => Share.share({ message: `${place.name} · ${formatCategory(place.category)}\nhttps://maps.apple.com/?q=${encodeURIComponent(place.name)}&ll=${place.latitude},${place.longitude}` }).catch(() => Alert.alert('Paylaşılamadı'))} pressScale={0.9} style={styles.secondaryAction}><Share2 color={colors.greenDark} size={20} /></AnimatedPressable>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Son sinyaller</Text>
                <Text style={styles.sectionCount}>{recentSignals.length}</Text>
              </View>
              {recentSignals.length === 0 ? (
                <View style={styles.empty}>
                  <ImageIcon color={colors.muted} size={22} />
                  <Text style={styles.emptyTitle}>Bu yer için taze içerik bekleniyor</Text>
                  <Text style={styles.emptyText}>İlk sinyali paylaşarak haritadaki kararı kolaylaştırabilirsin.</Text>
                </View>
              ) : recentSignals.map((signal, index) => (
                <SignalCard index={index} key={signal.postId} signal={signal} />
              ))}
            </ScrollView>
          </View>
        )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, maxHeight: '88%', paddingHorizontal: 20, paddingTop: 10, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 2, height: 4, marginBottom: 18, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row' },
  placeIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 44 },
  signalIcon: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 44 },
  headerText: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  placeContext: { color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 40 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statePanel: { backgroundColor: colors.ink, borderRadius: radii.card, marginTop: 18, padding: 16 },
  stateEyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  statePulse: { backgroundColor: colors.lime, borderRadius: 4, height: 7, width: 7 },
  stateEyebrow: { color: colors.lime, fontSize: 12, fontWeight: '600' },
  stateTitle: { color: colors.white, fontSize: 22, fontWeight: '600', lineHeight: 27, marginTop: 7 },
  stateText: { color: colors.mutedOnDark, fontSize: 13, lineHeight: 20, marginTop: 7 },
  stateStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statPill: { alignItems: 'center', backgroundColor: colors.surfaceOnDark, borderRadius: radii.pill, flexDirection: 'row', gap: 6, minHeight: 32, paddingHorizontal: 9 },
  statText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryAction: { alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.ink, borderRadius: radii.control, borderWidth: 2, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48, ...shadowSoft },
  primaryActionText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  secondaryAction: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radii.control, borderWidth: 1, justifyContent: 'center', width: 48 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 22 },
  sectionLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  sectionCount: { backgroundColor: colors.surfaceSoft, borderRadius: radii.pill, color: colors.muted, fontSize: 12, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  empty: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, padding: 18 },
  emptyTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 4, textAlign: 'center' },
  signalCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card, borderWidth: 1, marginBottom: 10, padding: 13, ...shadowSoft },
  coordinateSignalCard: { marginTop: 18 },
  signalMeta: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  freshBadge: { backgroundColor: colors.lime, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  freshText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  age: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  signalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 10 },
  signalText: { color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginTop: 6 },
  mediaRail: { marginTop: 10 },
  mediaPreview: { backgroundColor: colors.surfaceSoft, borderRadius: radii.control, height: 138, marginRight: 9, width: 138 },
  coordinateMedia: { backgroundColor: colors.surfaceSoft, borderRadius: radii.control, height: 190, marginTop: 12, width: '100%' },
});
