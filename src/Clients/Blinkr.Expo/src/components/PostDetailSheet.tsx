import { ResizeMode, Video } from 'expo-av';
import { Clock3, Compass, Image as ImageIcon, MapPin, MessageCircle, Plus, ShieldCheck, X } from 'lucide-react-native';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toAbsoluteUrl } from '../api';
import { colors, shadow } from '../theme';
import type { BlinkrMedia, BlinkrPlace, CoordinateSignal, RecentSignal } from '../types';

type Props = {
  isLoading: boolean;
  onClose: () => void;
  onCreateSignal: () => void;
  place: BlinkrPlace | null;
  signal?: CoordinateSignal | null;
};

const signalLabels: Record<string, string> = {
  Crowd: 'Doluluk',
  Queue: 'Bekleme',
  Event: 'Etkinlik',
  Offer: 'Fırsat',
  NewOpening: 'Yeni açılış',
  TemporaryStatus: 'Geçici durum',
  GeneralObservation: 'Gözlem',
};

const formatAge = (createdAt?: string | null) => {
  if (!createdAt) return 'Yeni';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} sa önce`;
  return `${Math.round(minutes / 1440)} gün önce`;
};

const formatConfidence = (value?: number | null, label?: string | null) => {
  if (typeof value === 'number') return `%${Math.round(value * 100)} güven`;
  return label ? `${label} güven` : 'Güven skoru oluşuyor';
};

const openDirections = (place: BlinkrPlace) => {
  const label = encodeURIComponent(place.name);
  const url = Platform.select({
    ios: `maps://?daddr=${place.latitude},${place.longitude}&q=${label}`,
    android: `geo:0,0?q=${place.latitude},${place.longitude}(${label})`,
    default: `https://maps.google.com/?q=${place.latitude},${place.longitude}`,
  });
  Linking.openURL(url ?? `https://maps.google.com/?q=${place.latitude},${place.longitude}`);
};

const MediaPreview = ({ media }: { media: BlinkrMedia }) => {
  const url = toAbsoluteUrl(media.url);
  if (!url) return null;
  if (media.mediaType === 'Video') {
    return <Video resizeMode={ResizeMode.COVER} source={{ uri: url }} style={styles.mediaPreview} useNativeControls />;
  }
  return <Image source={{ uri: url }} style={styles.mediaPreview} />;
};

const SignalCard = ({ signal }: { signal: RecentSignal }) => (
  <View style={styles.signalCard}>
    <View style={styles.signalMeta}>
      <View style={styles.freshBadge}>
        <Text style={styles.freshText}>{signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}</Text>
      </View>
      <Clock3 color={colors.muted} size={15} />
      <Text style={styles.age}>{formatAge(signal.createdAtUtc)}</Text>
    </View>
    <Text style={styles.signalTitle}>{signal.title || 'Yeni yer sinyali'}</Text>
    {Boolean(signal.text) && <Text style={styles.signalText}>{signal.text}</Text>}
    {Boolean(signal.media?.length) && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRail}>
        {signal.media?.map((item, index) => (
          <MediaPreview key={`${signal.postId}-${item.mediaId ?? item.id ?? index}`} media={item} />
        ))}
      </ScrollView>
    )}
  </View>
);

export function PostDetailSheet({ isLoading, onClose, onCreateSignal, place, signal }: Props) {
  const insets = useSafeAreaInsets();
  const state = place?.currentState;
  const recentSignals = place?.recentSignals ?? [];
  const visible = Boolean(place || signal);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Pressable onPress={onClose} style={styles.scrim} />
        {signal && !place && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.signalIcon}>
                <MapPin color={colors.white} fill={colors.white} size={22} />
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={styles.placeName}>{signal.locationName || 'Yaklaşık konum sinyali'}</Text>
                <Text style={styles.placeContext}>Koordinat tabanlı taze sinyal</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" hitSlop={10} onPress={onClose} style={styles.close}>
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>
            <View style={styles.signalCard}>
              <View style={styles.signalMeta}>
                <View style={styles.freshBadge}>
                  <Text style={styles.freshText}>{signalLabels[signal.signalType ?? 'GeneralObservation'] ?? 'Sinyal'}</Text>
                </View>
                <Clock3 color={colors.muted} size={15} />
                <Text style={styles.age}>{formatAge(signal.createdAtUtc)}</Text>
              </View>
              <Text style={styles.signalTitle}>{signal.title || 'Yeni sinyal'}</Text>
              <Text style={styles.signalText}>{signal.textPreview || 'Bu koordinat için güncel bir paylaşım var.'}</Text>
              {signal.mediaThumbnailUrl && <Image source={{ uri: toAbsoluteUrl(signal.mediaThumbnailUrl) ?? signal.mediaThumbnailUrl }} style={styles.coordinateMedia} />}
            </View>
          </View>
        )}
        {place && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.placeIcon}>
                <MapPin color={colors.greenDark} fill={colors.lime} size={22} />
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={styles.placeName}>{place.name}</Text>
                <Text numberOfLines={1} style={styles.placeContext}>{place.displayAddress || place.category || 'Yakın çevre yeri'}</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" hitSlop={10} onPress={onClose} style={styles.close}>
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.green} size="small" />
                <Text style={styles.loadingText}>Yer detayı yenileniyor</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statePanel}>
                <Text style={styles.stateEyebrow}>CANLI DURUM</Text>
                <Text style={styles.stateTitle}>
                  {state?.signalType ? signalLabels[state.signalType] ?? state.signalType : 'Henüz güçlü sinyal yok'}
                </Text>
                <Text style={styles.stateText}>
                  {state?.signalValue || 'Bu yer için taze topluluk sinyalleri oluştuğunda burada görünür.'}
                </Text>
                <View style={styles.stateStats}>
                  <View style={styles.statPill}>
                    <Clock3 color={colors.greenDark} size={15} />
                    <Text style={styles.statText}>{state?.freshness || 'Beklemede'}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <ShieldCheck color={colors.greenDark} size={15} />
                    <Text style={styles.statText}>{formatConfidence(state?.confidenceValue, state?.confidence)}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <MessageCircle color={colors.greenDark} size={15} />
                    <Text style={styles.statText}>{state?.activeSignalCount ?? recentSignals.length} sinyal</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable onPress={onCreateSignal} style={styles.primaryAction}>
                  <Plus color={colors.white} size={18} />
                  <Text style={styles.primaryActionText}>Bu yer için sinyal ver</Text>
                </Pressable>
                <Pressable onPress={() => openDirections(place)} style={styles.secondaryAction}>
                  <Compass color={colors.greenDark} size={18} />
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>SON İÇERİKLER</Text>
              {recentSignals.length === 0 ? (
                <View style={styles.empty}>
                  <ImageIcon color={colors.muted} size={22} />
                  <Text style={styles.emptyTitle}>Bu yer için taze içerik bekleniyor</Text>
                  <Text style={styles.emptyText}>İlk sinyali paylaşarak haritadaki kararı kolaylaştırabilirsin.</Text>
                </View>
              ) : recentSignals.map((signal) => (
                <SignalCard key={signal.postId} signal={signal} />
              ))}
            </ScrollView>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { bottom: 0, justifyContent: 'flex-end', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 60 },
  scrim: { backgroundColor: 'rgba(16,28,20,0.25)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, maxHeight: '86%', paddingHorizontal: 20, paddingTop: 10, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.line, borderRadius: 2, height: 4, marginBottom: 18, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row' },
  placeIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 44, justifyContent: 'center', width: 44 },
  signalIcon: { alignItems: 'center', backgroundColor: colors.coral, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  headerText: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  placeContext: { color: colors.muted, fontSize: 11, marginTop: 3 },
  close: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14 },
  loadingText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  statePanel: { backgroundColor: colors.greenSoft, borderRadius: 8, marginTop: 18, padding: 14 },
  stateEyebrow: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  stateTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', lineHeight: 27, marginTop: 6 },
  stateText: { color: '#465049', fontSize: 14, lineHeight: 21, marginTop: 8 },
  stateStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statPill: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, flexDirection: 'row', gap: 6, minHeight: 34, paddingHorizontal: 10 },
  statText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryAction: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  primaryActionText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  secondaryAction: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: 'center', width: 48 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', marginBottom: 9, marginTop: 22 },
  empty: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 18 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4, textAlign: 'center' },
  signalCard: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginBottom: 10, padding: 12 },
  signalMeta: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  freshBadge: { backgroundColor: colors.lime, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  freshText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  age: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  signalTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 10 },
  signalText: { color: '#465049', fontSize: 13, lineHeight: 20, marginTop: 6 },
  mediaRail: { marginTop: 10 },
  mediaPreview: { backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 138, marginRight: 9, width: 138 },
  coordinateMedia: { backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 190, marginTop: 12, width: '100%' },
});
