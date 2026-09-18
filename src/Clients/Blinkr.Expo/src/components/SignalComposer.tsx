import { ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadMedia } from '../api';
import { splitNearbyPlaces } from '../nearbyPlaceTiers';
import { formatCategory, formatDistance } from '../presentation';
import { colors, shadow, shadowSoft } from '../theme';
import { canPublishAt, friendlyError, signalOptions, trustLabel } from '../productPresentation';
import { SignalSymbol } from './SignalSymbol';
import { Sheet } from './Sheet';
import { PlacePicker } from './PlacePicker';
import { PlaceSymbol } from './PlaceSymbol';
import type {
  AuthResponse,
  BlinkrPlace,
  ComposerArea,
  CreateSignalInput,
  IdentityDisclosure,
  LocationReadiness,
  MediaKind,
  NearbyStatus,
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
  nearbyCoverageState?: string | null;
  nearbyPlaces: BlinkrPlace[];
  nearbyStatus: NearbyStatus;
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

const signalTypes: Array<{ type: SignalType; label: string; tone: string; value?: string }> = [
  { type: 'GeneralObservation', label: 'Gözlem', tone: colors.blue },
  { type: 'Crowd', label: 'Doluluk', tone: colors.coral, value: 'Busy' },
  { type: 'Queue', label: 'Sıra', tone: colors.amber, value: '5To15' },
  { type: 'TemporaryStatus', label: 'Durum', tone: colors.error, value: 'Closed' },
  { type: 'Event', label: 'Etkinlik', tone: colors.green, value: 'Started' },
  { type: 'Offer', label: 'Fırsat', tone: '#7957C8', value: 'Available' },
];

export function SignalComposer({
  area,
  auth,
  canAskLocationAgain,
  error,
  isSubmitting,
  locationReadiness,
  nearbyCoverageState,
  nearbyPlaces,
  nearbyStatus,
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
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

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
  const hasPayload = (content.trim().length === 0 || content.trim().length >= 5) && (title.trim().length > 0 || content.trim().length >= 5 || readyMedia.length > 0 || signalType !== 'GeneralObservation');
  const isRealtimePlaceBlocked = !canPublishAt(area);
  const canPublish = Boolean(area && hasPayload && !isRealtimePlaceBlocked && !isSubmitting && !isMediaBusy && media.every((item) => item.status === 'ready'));
  const isPrimaryActionBlocked = step === 3 ? !canPublish : step === 0 ? !area || isSelectingArea : isMediaBusy;
  const placeName = useMemo(() => area?.place?.name ?? area?.name ?? 'Yaklaşık konum', [area]);
  const { primary: primaryPlaces, extended: extendedPlaces } = useMemo(
    () => splitNearbyPlaces(nearbyPlaces),
    [nearbyPlaces],
  );
  const visibleNearbyPlaces = showExtendedPlaces ? [...primaryPlaces, ...extendedPlaces].slice(0, 10) : primaryPlaces;

  const selectArea = async (source: 'device' | 'map', place?: BlinkrPlace | null) => {
    if (isSelectingArea) return;
    setIsSelectingArea(true);
    onClearError();
    try {
      await onSelectArea(source, place);
      setPickerOpen(false);
    } catch (err) {
      setMediaError(friendlyError(err));
    } finally {
      setIsSelectingArea(false);
    }
  };

  const pickMediaInternal = async (source: 'camera' | 'library') => {
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
        ? { ...item, error: friendlyError(err, 'Medya yüklenemedi. Tekrar dene.'), status: 'failed' }
        : item));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const pickMedia = async (source: 'camera' | 'library') => {
    try { await pickMediaInternal(source); }
    catch (err) { setMediaError(friendlyError(err, 'Medya seçilemedi. Tekrar dene.')); }
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
      signalValue,
      title: title.trim() || selectedType?.label || 'Yeni sinyal',
    });
  };

  if (!visible) return null;
  return (
    <Sheet onClose={onClose}>
        <View style={[styles.sheet, { height: pickerOpen || step === 0 || step === 2 ? '86%' : '76%', paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.eyebrowRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.eyebrow}>{['YER', 'SİNYAL', 'İÇERİK', 'PAYLAŞ'][step]} · {step + 1}/4</Text>
              </View>
              <Text style={styles.heading}>{['Nerede oluyor?', 'Burada ne oluyor?', 'Gözlemini ekle', 'Paylaşmaya hazır'][step]}</Text>
            </View>
            <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.iconButton}>
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>

          {pickerOpen ? <PlacePicker nearby={nearbyPlaces} origin={area ? { latitude: area.observationLatitude ?? area.region.latitude, longitude: area.observationLongitude ?? area.region.longitude } : null} onBack={() => setPickerOpen(false)} onSelect={place => selectArea('device', place)} /> : <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(error || mediaError) && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AlertCircle color={colors.error} size={18} />
                <Text style={styles.errorText}>{friendlyError(new Error(error || mediaError || ''))}</Text>
              </View>
            )}

            {step === 0 && <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.locationTitle}>Konum</Text>
              <Text style={styles.sectionHint}>YER VEYA ALAN</Text>
            </View>

            {area?.place ? (
              <View style={styles.selectedPlaceCard}>
                <View style={styles.selectedPlaceIcon}><PlaceSymbol category={area.place.category} color={colors.greenDark} size={21} /></View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.areaName}>{area.place.name}</Text>
                  <Text style={styles.areaMeta}>{formatCategory(area.place.category)} {formatDistance(area.place.distanceMeters) ? `• ${formatDistance(area.place.distanceMeters)}` : ''}</Text>
                  {area.proximity && (
                    <Text style={[styles.proximityText, !area.proximity.allowed && styles.proximityBlocked]}>
                      {trustLabel(area.proximity.trustLevel)}
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
                  <Text style={styles.summaryLabel}>HARİTA KONUMU</Text>
                  <Text numberOfLines={1} style={styles.areaName}>{placeName}</Text>
                  <Text style={styles.areaMeta}>Yaklaşık alan olarak paylaşılacak</Text>
                </View>
                {area && <Check color={colors.green} size={20} />}
              </View>
            )}

            <View style={styles.areaActions}>
              <Pressable onPress={() => setPickerOpen(true)} style={styles.secondaryButton}><Search color={colors.green} size={18} /><Text style={styles.secondaryButtonText}>Yer ara</Text></Pressable>
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
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionLabel}>Yakınındaki yerler</Text>
                  {nearbyStatus === 'READY' && <Text style={styles.sectionHint}>{primaryPlaces.length} YER</Text>}
                </View>
                {nearbyStatus === 'LOADING' && visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><ActivityIndicator color={colors.green} /><Text style={styles.nearbyStateText}>Yakındaki yerler aranıyor</Text></View>
                ) : nearbyStatus === 'NOT_LOADED' ? (
                  <View style={styles.nearbyState}><Search color={colors.muted} size={18} /><Text style={styles.nearbyStateText}>Bu bölgedeki Blinkr yer kataloğu henüz hazır değil. Bu konumda paylaşabilirsin.</Text></View>
                ) : nearbyStatus === 'FAILED' && visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><Search color={colors.muted} size={18} /><Text style={styles.nearbyStateText}>Yakındaki yerler şu an yenilenemedi. Bu konumda paylaşabilirsin.</Text></View>
                ) : visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><Search color={colors.muted} size={18} /><Text style={styles.nearbyStateText}>{nearbyCoverageState === 'not_loaded' ? 'Bu bölgedeki Blinkr yer kataloğu henüz hazır değil. Bu konumda paylaşabilirsin.' : 'Yakınında uygun bir yer bulamadık. Daha uzaktaki yerleri açabilir veya bu konumda paylaşabilirsin.'}</Text></View>
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
                          <PlaceSymbol category={place.category} color={index === 0 ? colors.ink : colors.greenDark} size={20} />
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
                <Pressable accessibilityLabel="Bu konumda paylaş" onPress={() => area && selectArea(area.source === 'map' ? 'map' : 'device', null)} style={styles.coordinateAction}>
                  <MapPin color={colors.greenDark} size={18} />
                  <Text style={styles.coordinateActionText}>Bu konumda paylaş</Text>
                </Pressable>
                {extendedPlaces.length > 0 && (
                  <Pressable accessibilityLabel="Daha fazla yer" onPress={() => setPickerOpen(true)} style={styles.morePlacesButton}>
                    <Text style={styles.morePlacesText}>{showExtendedPlaces ? 'Yakın listeye dön' : `Daha fazla yer (${extendedPlaces.length})`}</Text>
                    {showExtendedPlaces ? <ChevronUp color={colors.greenDark} size={16} /> : <ChevronDown color={colors.greenDark} size={16} />}
                  </Pressable>
                )}
              </>
            )}

            </>}
            {area?.place && isRealtimePlaceBlocked && (
              <View style={styles.proximityWarning}>
                <AlertCircle color={colors.error} size={18} />
                <Text style={styles.proximityWarningText}>Yer seçildi. Burada paylaşmak için daha yakın ve güncel bir konum gerekli.</Text>
              </View>
            )}

            {step === 1 && <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Ne tür bir sinyal?</Text>
              <Text style={styles.sectionHint}>3 SAAT CANLI</Text>
            </View>
            <View style={styles.optionGrid}>
              {signalTypes.map((item) => (
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: signalType === item.type }} key={item.type} onPress={() => { setSignalType(item.type); setSignalValue(item.value ?? null); }} style={[styles.typeOption, styles.signalTile, signalType === item.type && styles.selectedOption]}>
                  <SignalSymbol type={item.type} color={signalType === item.type ? colors.lime : item.tone} size={24} />
                  <Text style={[styles.typeLabel, signalType === item.type && styles.typeLabelActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.optionGrid, { marginTop: 20 }]}>
              {signalOptions[signalType]?.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: signalValue === option.value }} onPress={() => setSignalValue(option.value)} style={[styles.typeOption, signalValue === option.value && styles.selectedOption]}><Text style={[styles.typeLabel, signalValue === option.value && styles.typeLabelActive]}>{option.label}</Text></Pressable>)}
            </View>
            </>}

            {step === 2 && <>
            <Text style={styles.inputLabel}>Başlık</Text>
            <TextInput maxLength={80} onChangeText={setTitle} placeholder="Örn. Bekleme süresi 10 dakika" placeholderTextColor="#929A95" style={styles.input} value={title} />
            <Text style={styles.inputLabel}>Gözlemin</Text>
            <TextInput maxLength={500} multiline onChangeText={setContent} placeholder="Karar vermeyi kolaylaştıracak güncel ve somut bir bilgi yaz." placeholderTextColor="#929A95" style={[styles.input, styles.textArea]} textAlignVertical="top" value={content} />
            <Text style={styles.counter}>{content.length}/500</Text>
            {content.trim().length > 0 && content.trim().length < 5 && <Text style={styles.errorText}>Gözlem en az 5 karakter olmalı.</Text>}

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Fotoğraf veya video</Text>
              <Text style={styles.sectionHint}>İSTEĞE BAĞLI</Text>
            </View>
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
            </>}

            {step === 3 && <>
            <View style={styles.areaSummary}><SignalSymbol type={signalType} color={colors.green} /><View style={styles.flex}><Text style={styles.areaName}>{placeName}</Text><Text style={styles.areaMeta}>{area?.place ? trustLabel(area.proximity?.trustLevel) : 'Yaklaşık konum'}</Text></View></View>
            <Text style={[styles.heading, { marginTop: 20 }]}>{title.trim() || selectedType?.label}</Text>
            {!!content && <Text style={styles.input}>{content}</Text>}
            {!!media.length && <Text style={styles.areaMeta}>{media.length} medya eklendi</Text>}
            {!hasPayload && <Text style={styles.errorText}>Paylaşım içeriği eksik veya çok kısa.</Text>}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Haritada görünüm</Text>
              <ShieldCheck color={colors.green} size={16} />
            </View>
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
              <Text style={styles.policyText}>Paylaşım haritada herkese görünür. Kesin cihaz konumun gösterilmez.</Text>
            </View>
            </>}
          </ScrollView>}

          {!pickerOpen && <View style={styles.areaActions}>
          {step > 0 && <Pressable disabled={isSubmitting} onPress={() => setStep(step - 1)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Geri</Text></Pressable>}
          <Pressable accessibilityRole="button" disabled={isPrimaryActionBlocked} onPress={() => step < 3 ? setStep(step + 1) : publish()} style={({ pressed }) => [styles.primaryButton, { flex: 2 }, isPrimaryActionBlocked && styles.disabledButton, pressed && styles.primaryButtonPressed]}>
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Send color={colors.white} size={19} />}
            <Text style={styles.primaryButtonText}>{isMediaBusy ? 'Medya hazırlanıyor' : isSubmitting ? 'Yayınlanıyor' : step < 3 ? 'Devam' : 'Yayınla'}</Text>
          </Pressable>
          </View>}
        </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, height: '86%', paddingHorizontal: 20, paddingTop: 12, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 2, height: 4, marginBottom: 12, width: 38 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  pulseDot: { backgroundColor: colors.coral, borderRadius: 4, height: 7, width: 7 },
  eyebrow: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  heading: { color: colors.ink, fontSize: 23, fontWeight: '600', marginTop: 3 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 44, justifyContent: 'center', width: 40 },
  scrollContent: { paddingBottom: 22, paddingTop: 20 },
  flex: { flex: 1 },
  errorBox: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderColor: '#F2CFCC', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 14, padding: 12 },
  errorText: { color: colors.error, flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 23 },
  locationTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  sectionHint: { color: colors.mutedSoft, fontSize: 12, fontWeight: '600' },
  areaSummary: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderColor: '#CDE3D5', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 13 },
  selectedPlaceCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.green, borderRadius: 8, borderWidth: 1.5, flexDirection: 'row', gap: 11, padding: 13, ...shadowSoft },
  selectedPlaceIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 42, justifyContent: 'center', width: 42 },
  summaryLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  areaName: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 2 },
  areaMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  selectedText: { color: colors.greenDark, fontSize: 12, fontWeight: '600', marginTop: 4 },
  proximityText: { color: colors.greenDark, fontSize: 12, fontWeight: '600', lineHeight: 15, marginTop: 4 },
  proximityBlocked: { color: colors.error },
  changeButton: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
  changeButtonText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  areaActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.lineStrong, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 45, paddingHorizontal: 8 },
  secondaryButtonText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  settingsLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: 10 },
  settingsText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  sectionLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  nearbyState: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 13 },
  nearbyStateText: { color: colors.muted, flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  nearbyList: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, overflow: 'hidden', ...shadowSoft },
  nearbyItem: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 62, paddingHorizontal: 11 },
  placeRank: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  placeRankPrimary: { backgroundColor: colors.lime },
  nearbyName: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  nearbyMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  pickText: { backgroundColor: colors.surfaceTint, borderRadius: 6, color: colors.greenDark, fontSize: 12, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 },
  coordinateAction: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, minHeight: 44 },
  coordinateActionText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  morePlacesButton: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 44, justifyContent: 'center', marginTop: 6 },
  morePlacesText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  proximityWarning: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: 8, flexDirection: 'row', gap: 9, marginTop: 14, padding: 12 },
  proximityWarningText: { color: colors.error, flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signalTile: { width: '48%', minHeight: 68, justifyContent: 'flex-start', paddingHorizontal: 16 },
  typeOption: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 42, justifyContent: 'center', paddingHorizontal: 12 },
  selectedOption: { backgroundColor: colors.ink, borderColor: colors.ink },
  typeLabel: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  typeLabelActive: { color: colors.white },
  inputLabel: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 52, paddingHorizontal: 13, paddingVertical: 12 },
  textArea: { minHeight: 128 },
  counter: { color: colors.muted, fontSize: 12, marginTop: 5, textAlign: 'right' },
  mediaDraft: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 10, padding: 8 },
  mediaThumb: { backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 58, width: 58 },
  mediaName: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  mediaStatus: { color: colors.muted, fontSize: 12, marginTop: 3 },
  mediaFailed: { color: colors.error },
  deleteButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 34 },
  segmented: { backgroundColor: colors.surfaceSoft, borderRadius: 8, flexDirection: 'row', padding: 4 },
  segment: { alignItems: 'center', borderRadius: 6, flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.white, ...shadowSoft },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: colors.greenDark },
  policySummary: { alignItems: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 10, marginTop: 14, padding: 13 },
  policyText: { color: colors.greenDark, flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 15 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, ...shadowSoft },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  disabledButton: { opacity: 0.42 },
});
