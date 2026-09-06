import { ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  Camera,
  Check,
  Crosshair,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadMedia } from '../api';
import { colors, shadow } from '../theme';
import type {
  AuthResponse,
  BlinkrPlace,
  ComposerArea,
  CreateSignalInput,
  IdentityDisclosure,
  LocationReadiness,
  MediaKind,
  SignalType,
  UploadState,
} from '../types';

type ComposerInput = Omit<CreateSignalInput, 'latitude' | 'longitude' | 'accuracyMeters' | 'locationName'>;

type Props = {
  area: ComposerArea | null;
  auth: AuthResponse;
  canAskLocationAgain: boolean;
  error: string | null;
  isSubmitting: boolean;
  locationReadiness: LocationReadiness;
  nearbyPlaces: BlinkrPlace[];
  onAuthChange: (auth: AuthResponse) => void;
  onClearError: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onSelectArea: (source: 'device' | 'map', place?: BlinkrPlace | null) => Promise<void>;
  onSessionExpired: () => void;
  onSubmit: (input: ComposerInput) => Promise<void>;
  visible: boolean;
};

type MediaDraft = {
  id: string;
  mediaId?: string;
  mediaType: MediaKind;
  name: string;
  previewUri: string;
  status: UploadState;
  error?: string;
};

const signalTypes: Array<{ type: SignalType; label: string; value?: string }> = [
  { type: 'Crowd', label: 'Doluluk', value: 'Busy' },
  { type: 'Queue', label: 'Sıra', value: '5To15' },
  { type: 'TemporaryStatus', label: 'Geçici durum', value: 'Closed' },
  { type: 'Event', label: 'Etkinlik', value: 'Started' },
  { type: 'Offer', label: 'Fırsat', value: 'Available' },
  { type: 'GeneralObservation', label: 'Gözlem' },
];

const PRIMARY_NEARBY_RADIUS_METERS = 350;
const PRIMARY_NEARBY_LIMIT = 4;

const formatDistance = (meters?: number) => {
  if (meters == null) return '';
  if (meters < 1000) return `~${Math.round(meters)} m`;
  return `~${(meters / 1000).toFixed(1)} km`;
};

const categoryLabels: Record<string, string> = {
  BAR: 'Bar',
  CAFE: 'Kafe',
  EDUCATION: 'Eğitim',
  ENTERTAINMENT: 'Eğlence',
  FAST_FOOD: 'Fast Food',
  FUEL: 'Akaryakıt',
  HEALTH: 'Sağlık',
  OTHER: 'Diğer',
  PARK: 'Park',
  PLAYGROUND: 'Oyun alanı',
  PUBLIC: 'Kamusal yer',
  RESTAURANT: 'Restoran',
  SHOP: 'Mağaza',
  SPORT: 'Spor',
  SUPERMARKET: 'Market',
  TOURISM: 'Gezilecek yer',
  TRANSPORT: 'Ulaşım',
};

const formatCategory = (category?: string | null) => categoryLabels[(category ?? '').toUpperCase()] ?? 'Yer';
const isRealtimeSignal = (type: SignalType) => ['GeneralObservation', 'Crowd', 'Queue', 'TemporaryStatus'].includes(type);

export function SignalComposer({
  area,
  auth,
  canAskLocationAgain,
  error,
  isSubmitting,
  locationReadiness,
  nearbyPlaces,
  onAuthChange,
  onClearError,
  onClose,
  onOpenSettings,
  onSelectArea,
  onSessionExpired,
  onSubmit,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const [signalType, setSignalType] = useState<SignalType>('GeneralObservation');
  const [signalValue, setSignalValue] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [identityDisclosure, setIdentityDisclosure] = useState<IdentityDisclosure>('LimitedProfile');
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [showExtendedPlaces, setShowExtendedPlaces] = useState(false);
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSignalType('GeneralObservation');
      setSignalValue(null);
      setTitle('');
      setContent('');
      setIdentityDisclosure('LimitedProfile');
      setShowExtendedPlaces(false);
      setMedia([]);
      setMediaError(null);
    }
  }, [visible]);

  const selectedType = signalTypes.find((item) => item.type === signalType);
  const readyMedia = media.filter((item) => item.status === 'ready' && item.mediaId);
  const isMediaBusy = media.some((item) => item.status === 'preparing' || item.status === 'uploading');
  const hasPayload = title.trim().length > 0 || content.trim().length >= 3 || readyMedia.length > 0 || signalType !== 'GeneralObservation';
  const isRealtimePlaceBlocked = Boolean(area?.place && isRealtimeSignal(signalType) && area.proximity && !area.proximity.allowed);
  const canPublish = Boolean(area && hasPayload && !isRealtimePlaceBlocked && !isSubmitting && !isMediaBusy && media.every((item) => item.status === 'ready'));
  const placeName = useMemo(() => area?.place?.name ?? area?.name ?? 'Yaklaşık konum', [area]);
  const primaryPlaces = nearbyPlaces
    .filter((place) => (place.distanceMeters ?? Number.POSITIVE_INFINITY) <= PRIMARY_NEARBY_RADIUS_METERS)
    .slice(0, PRIMARY_NEARBY_LIMIT);
  const extendedPlaces = nearbyPlaces.filter((place) => !primaryPlaces.some((primary) => primary.id === place.id));
  const visibleNearbyPlaces = showExtendedPlaces ? [...primaryPlaces, ...extendedPlaces].slice(0, 10) : primaryPlaces;

  const selectArea = async (source: 'device' | 'map', place?: BlinkrPlace | null) => {
    setIsSelectingArea(true);
    onClearError();
    try {
      await onSelectArea(source, place);
    } finally {
      setIsSelectingArea(false);
    }
  };

  const pickMedia = async (source: 'camera' | 'library') => {
    setMediaError(null);
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      setMediaError(source === 'camera' ? 'Kamera izni gerekiyor.' : 'Fotoğraf arşivi izni gerekiyor.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.84, videoMaxDuration: 45 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.84, videoMaxDuration: 45 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const localId = `${Date.now()}-${asset.uri}`;
    const draft: MediaDraft = {
      id: localId,
      mediaType: asset.type === 'video' ? 'Video' : 'Image',
      name: asset.fileName || (asset.type === 'video' ? 'Video sinyali' : 'Fotoğraf sinyali'),
      previewUri: asset.uri,
      status: 'preparing',
    };
    setMedia((current) => [...current, draft]);

    try {
      setMedia((current) => current.map((item) => item.id === localId ? { ...item, status: 'uploading' } : item));
      const uploaded = await uploadMedia(auth, asset, onAuthChange, onSessionExpired);
      setMedia((current) => current.map((item) => item.id === localId
        ? { ...item, mediaId: uploaded.mediaId, mediaType: uploaded.mediaType, status: 'ready' }
        : item));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setMedia((current) => current.map((item) => item.id === localId
        ? { ...item, error: err instanceof Error ? err.message : 'Medya yüklenemedi.', status: 'failed' }
        : item));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const publish = async () => {
    if (!canPublish) return;
    await onSubmit({
      audienceType: 'Public',
      content: content.trim(),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      identityDisclosure,
      locationPrecision: area?.place ? 'PlaceCenter' : 'ApproximateArea',
      media: readyMedia.map((item) => ({ mediaId: item.mediaId as string, mediaType: item.mediaType })),
      placeId: area?.place?.id ?? null,
      signalType,
      signalValue: selectedType?.value ?? signalValue,
      title: title.trim() || selectedType?.label || 'Yeni sinyal',
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <Pressable onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>TAZE SİNYAL</Text>
              <Text style={styles.heading}>Burada ne oluyor?</Text>
            </View>
            <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.iconButton}>
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(error || mediaError) && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AlertCircle color={colors.error} size={18} />
                <Text style={styles.errorText}>{error || mediaError}</Text>
              </View>
            )}

            <Text style={styles.locationTitle}>Neredesin?</Text>

            {area?.place ? (
              <View style={styles.selectedPlaceCard}>
                <View style={styles.selectedPlaceIcon}><Store color={colors.greenDark} size={21} /></View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.areaName}>{area.place.name}</Text>
                  <Text style={styles.areaMeta}>{formatCategory(area.place.category)} {formatDistance(area.place.distanceMeters) ? `• ${formatDistance(area.place.distanceMeters)}` : ''}</Text>
                  {area.proximity && (
                    <Text style={[styles.proximityText, !area.proximity.allowed && styles.proximityBlocked]}>
                      {area.proximity.allowed
                        ? 'Anlık sinyal için yeterince yakınsın.'
                        : 'Bu yer için anlık sinyal bırakmak için yakına gelmelisin.'}
                    </Text>
                  )}
                  <Text style={styles.selectedText}>Seçildi</Text>
                </View>
                <Pressable onPress={() => { setShowExtendedPlaces(false); area && selectArea(area.source === 'map' ? 'map' : 'device'); }} style={styles.changeButton}>
                  <Text style={styles.changeButtonText}>Değiştir</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.areaSummary}>
                <MapPin color={colors.greenDark} size={22} />
                <View style={styles.flex}>
                  <Text style={styles.summaryLabel}>YAKLAŞIK KONUM</Text>
                  <Text numberOfLines={1} style={styles.areaName}>{placeName}</Text>
                  <Text style={styles.areaMeta}>Place seçmeden koordinat sinyali olarak yayınlanır</Text>
                </View>
                {area && <Check color={colors.green} size={20} />}
              </View>
            )}

            <View style={styles.areaActions}>
              <Pressable disabled={isSelectingArea} onPress={() => selectArea('device')} style={styles.secondaryButton}>
                {isSelectingArea ? <ActivityIndicator color={colors.green} size="small" /> : <Navigation color={colors.green} size={18} />}
                <Text style={styles.secondaryButtonText}>Yakınımdaki yerler</Text>
              </Pressable>
              <Pressable disabled={isSelectingArea} onPress={() => selectArea('map')} style={styles.secondaryButton}>
                <Crosshair color={colors.green} size={18} />
                <Text style={styles.secondaryButtonText}>Haritadaki nokta</Text>
              </Pressable>
            </View>

            {locationReadiness === 'permission-required' && (
              <Pressable onPress={canAskLocationAgain ? () => selectArea('device') : onOpenSettings} style={styles.settingsLink}>
                <Settings color={colors.warning} size={16} />
                <Text style={styles.settingsText}>{canAskLocationAgain ? 'Konum izni ver' : 'Konum ayarlarını aç'}</Text>
              </Pressable>
            )}

            {!area?.place && (
              <>
                <Text style={styles.sectionLabel}>YAKININDA</Text>
                {isSelectingArea ? (
                  <View style={styles.nearbyState}><ActivityIndicator color={colors.green} /><Text style={styles.nearbyStateText}>Yakındaki yerler aranıyor</Text></View>
                ) : visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><Search color={colors.muted} size={18} /><Text style={styles.nearbyStateText}>Yakınında uygun bir yer bulamadık. Daha uzaktaki yerleri açabilir veya bu konumda paylaşabilirsin.</Text></View>
                ) : (
                  <View style={styles.nearbyList}>
                    {visibleNearbyPlaces.map((place, index) => (
                      <Pressable
                        accessibilityLabel={`${place.name} yerini seç`}
                        key={place.id}
                        onPress={() => selectArea('map', place)}
                        style={styles.nearbyItem}
                      >
                        <View style={[styles.placeRank, index === 0 && styles.placeRankPrimary]}>
                          <Store color={index === 0 ? colors.white : colors.greenDark} size={17} />
                        </View>
                        <View style={styles.flex}>
                          <Text numberOfLines={1} style={styles.nearbyName}>{place.name}</Text>
                          <Text numberOfLines={1} style={styles.nearbyMeta}>{formatCategory(place.category)} {formatDistance(place.distanceMeters) ? `• ${formatDistance(place.distanceMeters)}` : ''}</Text>
                        </View>
                        <Text style={styles.pickText}>Seç</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable accessibilityLabel="Bu konumda paylaş" onPress={() => area && selectArea(area.source === 'map' ? 'map' : 'device')} style={styles.coordinateAction}>
                  <MapPin color={colors.greenDark} size={18} />
                  <Text style={styles.coordinateActionText}>Bu konumda paylaş</Text>
                </Pressable>
                {extendedPlaces.length > 0 && (
                  <Pressable accessibilityLabel="Daha fazla yer" onPress={() => setShowExtendedPlaces((value) => !value)} style={styles.morePlacesButton}>
                    <Text style={styles.morePlacesText}>{showExtendedPlaces ? 'Yakın listeye dön' : `Daha fazla yer (${extendedPlaces.length})`}</Text>
                  </Pressable>
                )}
              </>
            )}

            {isRealtimePlaceBlocked && (
              <View style={styles.proximityWarning}>
                <AlertCircle color={colors.error} size={18} />
                <Text style={styles.proximityWarningText}>Seçili yer için anlık sinyal yayınlamak üzere mekana daha yakın olmalısın. İstersen “Bu konumda paylaş” ile koordinat sinyali bırakabilirsin.</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>SİNYAL TÜRÜ</Text>
            <View style={styles.optionGrid}>
              {signalTypes.map((item) => (
                <Pressable key={item.type} onPress={() => { setSignalType(item.type); setSignalValue(item.value ?? null); }} style={[styles.typeOption, signalType === item.type && styles.selectedOption]}>
                  <Text style={[styles.typeLabel, signalType === item.type && styles.typeLabelActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Kısa başlık</Text>
            <TextInput maxLength={80} onChangeText={setTitle} placeholder="Örn. Bekleme süresi 10 dakika" placeholderTextColor="#929A95" style={styles.input} value={title} />
            <Text style={styles.inputLabel}>Gördüğün şey</Text>
            <TextInput maxLength={500} multiline onChangeText={setContent} placeholder="Karar vermeyi kolaylaştıracak güncel ve somut bir bilgi yaz." placeholderTextColor="#929A95" style={[styles.input, styles.textArea]} textAlignVertical="top" value={content} />
            <Text style={styles.counter}>{content.length}/500</Text>

            <Text style={styles.sectionLabel}>KANIT MEDYASI</Text>
            <View style={styles.areaActions}>
              <Pressable onPress={() => pickMedia('camera')} style={styles.secondaryButton}>
                <Camera color={colors.green} size={18} />
                <Text style={styles.secondaryButtonText}>Kamera</Text>
              </Pressable>
              <Pressable onPress={() => pickMedia('library')} style={styles.secondaryButton}>
                <ImageIcon color={colors.green} size={18} />
                <Text style={styles.secondaryButtonText}>Galeri</Text>
              </Pressable>
            </View>

            {media.map((item) => (
              <View key={item.id} style={styles.mediaDraft}>
                {item.mediaType === 'Video'
                  ? <Video resizeMode={ResizeMode.COVER} source={{ uri: item.previewUri }} style={styles.mediaThumb} useNativeControls />
                  : <Image source={{ uri: item.previewUri }} style={styles.mediaThumb} />}
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.mediaName}>{item.name}</Text>
                  <Text style={[styles.mediaStatus, item.status === 'failed' && styles.mediaFailed]}>
                    {item.status === 'ready' ? 'Hazır' : item.status === 'failed' ? item.error : item.status === 'uploading' ? 'Yükleniyor' : 'Hazırlanıyor'}
                  </Text>
                </View>
                {(item.status === 'uploading' || item.status === 'preparing') && <ActivityIndicator color={colors.green} />}
                <Pressable onPress={() => setMedia((current) => current.filter((draft) => draft.id !== item.id))} style={styles.deleteButton}>
                  <Trash2 color={colors.muted} size={17} />
                </Pressable>
              </View>
            ))}

            <Text style={styles.sectionLabel}>GÖRÜNÜRLÜK</Text>
            <View style={styles.segmented}>
              <Pressable onPress={() => setIdentityDisclosure('LimitedProfile')} style={[styles.segment, identityDisclosure === 'LimitedProfile' && styles.segmentActive]}>
                <Text style={[styles.segmentText, identityDisclosure === 'LimitedProfile' && styles.segmentTextActive]}>Sınırlı profil</Text>
              </Pressable>
              <Pressable onPress={() => setIdentityDisclosure('AnonymousMap')} style={[styles.segment, identityDisclosure === 'AnonymousMap' && styles.segmentActive]}>
                <Text style={[styles.segmentText, identityDisclosure === 'AnonymousMap' && styles.segmentTextActive]}>Anonim</Text>
              </Pressable>
            </View>

            <View style={styles.policySummary}>
              <ShieldCheck color={colors.greenDark} size={19} />
              <Text style={styles.policyText}>Konum ve medya, yalnız bu yer sinyalini doğru bağlama yerleştirmek için kullanılır.</Text>
            </View>
          </ScrollView>

          <Pressable disabled={!canPublish} onPress={publish} style={[styles.primaryButton, !canPublish && styles.disabledButton]}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Send color={colors.white} size={19} />}
            <Text style={styles.primaryButtonText}>{isMediaBusy ? 'Medya hazırlanıyor' : 'Sinyali yayınla'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.scrim, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, height: '92%', paddingHorizontal: 18, paddingTop: 9, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.line, borderRadius: 2, height: 4, marginBottom: 12, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900' },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 2 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  scrollContent: { paddingBottom: 18, paddingTop: 18 },
  flex: { flex: 1 },
  errorBox: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: 8, flexDirection: 'row', gap: 9, marginBottom: 14, padding: 12 },
  errorText: { color: colors.error, flex: 1, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  locationTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  areaSummary: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 11, padding: 13 },
  selectedPlaceCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.green, borderRadius: 8, borderWidth: 1.5, flexDirection: 'row', gap: 11, padding: 13, ...shadow },
  selectedPlaceIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  summaryLabel: { color: colors.green, fontSize: 9, fontWeight: '900' },
  areaName: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 2 },
  areaMeta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  selectedText: { color: colors.greenDark, fontSize: 10, fontWeight: '900', marginTop: 4 },
  proximityText: { color: colors.greenDark, fontSize: 10, fontWeight: '800', lineHeight: 15, marginTop: 4 },
  proximityBlocked: { color: colors.error },
  changeButton: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, justifyContent: 'center', minHeight: 34, paddingHorizontal: 10 },
  changeButtonText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  areaActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  secondaryButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  secondaryButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  settingsLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 10 },
  settingsText: { color: colors.warning, fontSize: 11, fontWeight: '900' },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', marginBottom: 9, marginTop: 22 },
  nearbyState: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 12 },
  nearbyStateText: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  nearbyList: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  nearbyItem: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 58, paddingHorizontal: 11 },
  placeRank: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  placeRankPrimary: { backgroundColor: colors.greenDark },
  nearbyName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  nearbyMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  pickText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  coordinateAction: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, minHeight: 44 },
  coordinateActionText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  morePlacesButton: { alignItems: 'center', minHeight: 40, justifyContent: 'center', marginTop: 6 },
  morePlacesText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  proximityWarning: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: 8, flexDirection: 'row', gap: 9, marginTop: 14, padding: 12 },
  proximityWarningText: { color: colors.error, flex: 1, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  placeRow: { flexDirection: 'row', gap: 8 },
  placeChip: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, maxWidth: 170, minHeight: 36, justifyContent: 'center', paddingHorizontal: 11 },
  placeChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  placeChipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  placeChipTextActive: { color: colors.white },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  selectedOption: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  typeLabel: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  typeLabelActive: { color: colors.white },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 18 },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 13, paddingVertical: 11 },
  textArea: { minHeight: 128 },
  counter: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'right' },
  mediaDraft: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 10, padding: 8 },
  mediaThumb: { backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 58, width: 58 },
  mediaName: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  mediaStatus: { color: colors.muted, fontSize: 10, marginTop: 3 },
  mediaFailed: { color: colors.error },
  deleteButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  segmented: { backgroundColor: colors.surfaceSoft, borderRadius: 8, flexDirection: 'row', padding: 3 },
  segment: { alignItems: 'center', borderRadius: 6, flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  segmentTextActive: { color: colors.greenDark },
  policySummary: { alignItems: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 10, marginTop: 16, padding: 13 },
  policyText: { color: colors.greenDark, flex: 1, fontSize: 10, fontWeight: '800', lineHeight: 15 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 52 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.42 },
});
