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
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { uploadMedia } from '../api';
import { splitNearbyPlaces } from '../nearbyPlaceTiers';
import { formatCategory, formatDistance } from '../presentation';
import { categoryTone, colors, motion, radii, shadow, signalColors, spacing, typography } from '../theme';
import { canPublishAt, friendlyError, signalOptions, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { SignalSymbol } from './SignalSymbol';
import { PlacePicker } from './PlacePicker';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';
import { BlinkrButton } from './ui/BlinkrButton';
import { MAX_VIDEO_SECONDS } from '../cameraEffects';
import { accuracyUncertain, mediaAllowedAt, placeSensitivity } from '../placeSafety';
import { SIGNAL_TTL_MINUTES, formatLifetime } from '../signalCatalog';
import { BlinkrChip } from './ui/BlinkrChip';
import { BlinkrHeader } from './ui/BlinkrHeader';
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
  initialStep?: number;
  /** Pre-selected signal, e.g. when answering "Hâlâ böyle mi?" on a Place. */
  initialSignal?: { type: SignalType; value: string | null } | null;
  isSubmitting: boolean;
  locationReadiness: LocationReadiness;
  nearbyCoverageState?: string | null;
  nearbyPlaces: BlinkrPlace[];
  nearbyStatus: NearbyStatus;
  onAuthChange: (auth: AuthResponse) => void;
  onClearError: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  /** Opens the in-app camera above the composer; without it the system camera is used. */
  onRequestCamera?: () => void;
  onSelectArea: (source: 'device' | 'map', place?: BlinkrPlace | null) => Promise<void>;
  onSessionExpired: () => void;
  onSubmit: (input: ComposerInput) => Promise<void>;
  pendingCapture?: ImagePicker.ImagePickerAsset | null;
  visible: boolean;
};

type MediaDraft = {
  id: string;
  asset: ImagePicker.ImagePickerAsset;
  mediaId?: string;
  mediaType: MediaKind;
  name: string;
  previewUri: string;
  status: UploadState;
  error?: string;
};

const signalTypes: Array<{ type: SignalType; label: string; tone: string; value?: string }> = [
  { type: 'GeneralObservation', label: 'Gözlem', tone: signalColors.GeneralObservation },
  { type: 'Crowd', label: 'Doluluk', tone: signalColors.Crowd, value: 'Busy' },
  { type: 'Queue', label: 'Sıra', tone: signalColors.Queue, value: '5To15' },
  { type: 'TemporaryStatus', label: 'Durum', tone: signalColors.TemporaryStatus, value: 'Closed' },
  { type: 'Event', label: 'Etkinlik', tone: signalColors.Event, value: 'Started' },
  { type: 'Offer', label: 'Fırsat', tone: signalColors.Offer, value: 'Available' },
];

export function SignalComposer({
  area,
  auth,
  canAskLocationAgain,
  error,
  initialStep,
  initialSignal,
  isSubmitting,
  locationReadiness,
  nearbyCoverageState,
  nearbyPlaces,
  nearbyStatus,
  onAuthChange,
  onClearError,
  onClose,
  onOpenSettings,
  onRequestCamera,
  onSelectArea,
  onSessionExpired,
  onSubmit,
  pendingCapture,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [signalType, setSignalType] = useState<SignalType>(initialSignal?.type ?? 'GeneralObservation');
  const [signalValue, setSignalValue] = useState<string | null>(initialSignal?.value ?? null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [identityDisclosure, setIdentityDisclosure] = useState<IdentityDisclosure>('LimitedProfile');
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [showExtendedPlaces, setShowExtendedPlaces] = useState(false);
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [step, setStep] = useState(initialStep ?? 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t, i18n } = useTranslation('create');
  // The privacy reminder at a sensitive place is shown once per place per composer session.
  const [privacyAckFor, setPrivacyAckFor] = useState<string | null>(null);

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
      setStep(initialStep ?? 0);
    }
  }, [visible, initialStep]);

  const selectedType = signalTypes.find((item) => item.type === signalType);
  const readyMedia = media.filter((item) => item.status === 'ready' && item.mediaId);
  const isMediaPreparing = media.some((item) => item.status === 'preparing');
  const isMediaUploading = media.some((item) => item.status === 'uploading');
  const isMediaBusy = isMediaPreparing || isMediaUploading;
  const hasPayload = (content.trim().length === 0 || content.trim().length >= 5) && (title.trim().length > 0 || content.trim().length >= 5 || readyMedia.length > 0 || signalType !== 'GeneralObservation');
  const isRealtimePlaceBlocked = !canPublishAt(area);
  const sensitivity = placeSensitivity(area?.place?.category);
  const mediaBlocked = !mediaAllowedAt(area?.place?.category);
  const locationUncertain = area?.source !== 'map' && accuracyUncertain(area?.observationAccuracyMeters ?? area?.accuracyMeters);
  const canPublish = Boolean(area && hasPayload && !(mediaBlocked && media.length > 0) && !isRealtimePlaceBlocked && !isSubmitting && !isMediaBusy && media.every((item) => item.status === 'ready'));
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

  const uploadDraft = async (asset: ImagePicker.ImagePickerAsset, localId: string) => {
    try {
      setMedia((current) => current.map((item) => item.id === localId ? { ...item, status: 'uploading' } : item));
      const uploaded = await uploadMedia(auth, asset, onAuthChange, onSessionExpired);
      setMedia((current) => current.map((item) => item.id === localId
        ? { ...item, mediaId: uploaded.mediaId, mediaType: uploaded.mediaType, status: 'ready' }
        : item));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('[Blinkr Media]', { failedStage: 'upload', errorCode: err instanceof Error ? err.name : 'Unknown', reason: err instanceof Error ? err.message : String(err) });
      setMedia((current) => current.map((item) => item.id === localId
        ? { ...item, error: friendlyError(err, 'Medya yüklenemedi. Tekrar dene.'), status: 'failed' }
        : item));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const attachCapturedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const localId = `${Date.now()}-${asset.uri}`;
    const draft: MediaDraft = {
      id: localId,
      asset,
      mediaType: asset.type === 'video' ? 'Video' : 'Image',
      name: asset.fileName || (asset.type === 'video' ? 'Video sinyali' : 'Fotoğraf sinyali'),
      previewUri: asset.uri,
      status: 'preparing',
    };
    setMedia((current) => [...current, draft]);
    void uploadDraft(asset, localId);
  };

  const retryUpload = (item: MediaDraft) => {
    setMedia((current) => current.map((draft) => draft.id === item.id ? { ...draft, error: undefined, status: 'preparing' } : draft));
    void uploadDraft(item.asset, item.id);
  };

  useEffect(() => {
    if (visible && pendingCapture) attachCapturedAsset(pendingCapture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pendingCapture]);

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
      ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS });

    if (result.canceled || !result.assets[0]) return;
    attachCapturedAsset(result.assets[0]);
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
      // No client-side expiresAt: the server applies its own per-signal-type default
      // (Crowd/Queue 1h, TemporaryStatus 3h, Event/Offer 24h, NewOpening 7d) — trust is
      // server-owned (kök CLAUDE.md §2.1), a fixed client TTL would silently override that
      // for every signal type regardless of how long it actually stays meaningful.
      identityDisclosure,
      locationPrecision: area?.place ? 'PlaceCenter' : 'ApproximateArea',
      media: readyMedia.map((item) => ({ mediaId: item.mediaId as string, mediaType: item.mediaType })),
      placeId: area?.place?.id ?? null,
      signalType,
      signalValue,
      title: title.trim() || selectedType?.label || 'Yeni sinyal',
    });
  };

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const backdrop = media.find((item) => item.status !== 'failed') ?? null;
  const stepTitles = ['Yer', 'Sinyal', 'İçerik', 'Paylaş'];
  const panelMaxHeight = Math.round((windowHeight - insets.top) * 0.72);
  const typeTone = selectedType?.tone ?? colors.mint;
  const publishLabel = isMediaUploading ? 'Medya yükleniyor' : isMediaPreparing ? 'Medya hazırlanıyor' : isSubmitting ? 'Yayınlanıyor' : step < 3 ? 'Devam' : 'Sinyal bırak';

  return (
    <Animated.View accessibilityViewIsModal entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={styles.host}>
      {/* The real capture fills the screen, exactly like the camera-first design; without one it is plain dark. */}
      {backdrop ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {backdrop.mediaType === 'Video'
            ? <VideoPreview controls={false} style={StyleSheet.absoluteFill} uri={backdrop.previewUri} />
            : <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: backdrop.previewUri }} style={StyleSheet.absoluteFill} />}
          <View style={styles.backdropShade} />
        </View>
      ) : null}

      <View pointerEvents="box-none" style={styles.top}>
        <BlinkrHeader
          right={
            <AnimatedPressable accessibilityLabel="Kapat" accessibilityRole="button" onPress={onClose} pressScale={0.88} style={styles.close}>
              <X color={colors.text} size={24} />
            </AnimatedPressable>
          }
          subtitle={<Text style={styles.stepLabel}>Adım {step + 1}/4 · {stepTitles[step]}</Text>}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.bottom}>
        <View style={[styles.panel, { maxHeight: panelMaxHeight, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View accessibilityLabel={`Adım ${step + 1} / 4`} style={styles.progress}>
            {stepTitles.map((title, index) => <View key={title} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />)}
          </View>
          <Text accessibilityRole="header" style={styles.heading}>{['Nerede oluyor?', 'Burada ne oluyor?', 'Gözlemini ekle', 'Paylaşmaya hazır'][step]}</Text>

          {pickerOpen ? <PlacePicker nearby={nearbyPlaces} origin={area ? { latitude: area.observationLatitude ?? area.region.latitude, longitude: area.observationLongitude ?? area.region.longitude } : null} onBack={() => setPickerOpen(false)} onSelect={place => selectArea('device', place)} /> : <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(error || mediaError) && (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <AlertCircle color={colors.danger} size={18} />
                <Text style={styles.errorText}>{friendlyError(new Error(error || mediaError || ''))}</Text>
              </View>
            )}

            {step === 0 && <>
            {locationUncertain ? (
              <View accessibilityRole="alert" style={styles.safetyNotice} testID="location-uncertain">
                <AlertCircle color={colors.warning} size={20} />
                <View style={styles.flex}>
                  <Text style={styles.safetyTitle}>{t('safety.uncertainTitle')}</Text>
                  <Text style={styles.uncertain}>{t('safety.uncertainBody', { meters: Math.round(area?.observationAccuracyMeters ?? area?.accuracyMeters ?? 0) })}</Text>
                </View>
              </View>
            ) : null}
            {area?.place ? (
              <View style={[styles.placeCard, styles.placeCardSelected]}>
                <View style={[styles.placeTile, { borderColor: categoryTone(area.place.category) }]}><PlaceSymbol category={area.place.category} color={categoryTone(area.place.category)} size={24} /></View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.placeName}>{area.place.name}</Text>
                  <Text style={styles.placeMeta}>{formatCategory(area.place.category)} {formatDistance(area.place.distanceMeters) ? `• ${formatDistance(area.place.distanceMeters)}` : ''}</Text>
                  {area.proximity && (
                    <Text style={[styles.proximityText, !area.proximity.allowed && styles.proximityBlocked]}>
                      {trustLabel(area.proximity.trustLevel)}
                    </Text>
                  )}
                </View>
                <BlinkrButton label="Değiştir" onPress={() => { setShowExtendedPlaces(false); area && selectArea(area.source === 'map' ? 'map' : 'device'); }} style={styles.changeButton} variant="secondary" />
              </View>
            ) : (
              <View style={styles.placeCard}>
                <View style={[styles.placeTile, { borderColor: colors.mint }]}><MapPin color={colors.mint} size={24} /></View>
                <View style={styles.flex}>
                  <Text style={styles.summaryLabel}>HARİTA KONUMU</Text>
                  <Text numberOfLines={1} style={styles.placeName}>{placeName}</Text>
                  <Text style={styles.placeMeta}>Yaklaşık alan olarak paylaşılacak</Text>
                </View>
                {area && <Check color={colors.mint} size={22} />}
              </View>
            )}

            <View style={styles.sourceRow}>
              <BlinkrButton icon={<Search color={colors.text} size={18} />} label="Yer ara" onPress={() => setPickerOpen(true)} style={styles.sourceButton} variant="secondary" />
              <BlinkrButton disabled={isSelectingArea} icon={isSelectingArea ? <ActivityIndicator color={colors.text} size="small" /> : <Navigation color={colors.text} size={18} />} label="Yakınımdaki yerler" onPress={() => selectArea('device')} style={styles.sourceButton} variant="secondary" />
              <BlinkrButton disabled={isSelectingArea} icon={<Crosshair color={colors.text} size={18} />} label="Haritadaki nokta" onPress={() => selectArea('map')} style={styles.sourceButton} variant="secondary" />
            </View>

            {locationReadiness === 'permission-required' && (
              <AnimatedPressable accessibilityRole="button" onPress={canAskLocationAgain ? () => selectArea('device') : onOpenSettings} style={styles.settingsLink}>
                <Settings color={colors.orange} size={16} />
                <Text style={styles.settingsText}>{canAskLocationAgain ? 'Konum izni ver' : 'Konum ayarlarını aç'}</Text>
              </AnimatedPressable>
            )}

            {!area?.place && (
              <>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionLabel}>Yakınındaki yerler</Text>
                  {nearbyStatus === 'READY' && <Text style={styles.sectionHint}>{primaryPlaces.length} YER</Text>}
                </View>
                {nearbyStatus === 'LOADING' && visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><ActivityIndicator color={colors.mint} /><Text style={styles.nearbyStateText}>Yakındaki yerler aranıyor</Text></View>
                ) : nearbyStatus === 'NOT_LOADED' ? (
                  <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>Bu bölgedeki Blinkr yer kataloğu henüz hazır değil. Bu konumda paylaşabilirsin.</Text></View>
                ) : nearbyStatus === 'FAILED' && visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>Yakındaki yerler şu an yenilenemedi. Bu konumda paylaşabilirsin.</Text></View>
                ) : visibleNearbyPlaces.length === 0 ? (
                  <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>{nearbyCoverageState === 'not_loaded' ? 'Bu bölgedeki Blinkr yer kataloğu henüz hazır değil. Bu konumda paylaşabilirsin.' : 'Yakınında uygun bir yer bulamadık. Daha uzaktaki yerleri açabilir veya bu konumda paylaşabilirsin.'}</Text></View>
                ) : (
                  <View style={styles.nearbyList}>
                    {visibleNearbyPlaces.map((place, index) => {
                      const tone = categoryTone(place.category);
                      return (
                        <Animated.View entering={FadeIn.duration(motion.base)} key={place.id}>
                          <AnimatedPressable
                            accessibilityLabel={`${place.name} yerini seç`}
                            accessibilityRole="button"
                            onPress={() => selectArea('map', place)}
                            style={[styles.nearbyItem, index > 0 && styles.nearbyItemDivider]}
                          >
                            <View style={[styles.placeTile, styles.placeTileSmall, { borderColor: tone }]}>
                              <PlaceSymbol category={place.category} color={tone} size={20} />
                            </View>
                            <View style={styles.flex}>
                              <Text numberOfLines={1} style={styles.nearbyName}>{place.name}</Text>
                              <Text numberOfLines={1} style={styles.nearbyMeta}>{formatCategory(place.category)} {formatDistance(place.distanceMeters) ? `• ${formatDistance(place.distanceMeters)}` : ''}</Text>
                            </View>
                            <Text style={styles.pickText}>Seç</Text>
                          </AnimatedPressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                )}
                <BlinkrButton accessibilityLabel="Bu konumda paylaş" icon={<MapPin color={colors.mint} size={18} />} label="Bu konumda paylaş" onPress={() => area && selectArea(area.source === 'map' ? 'map' : 'device', null)} style={styles.coordinateAction} variant="ghost" />
                {extendedPlaces.length > 0 && (
                  <AnimatedPressable accessibilityLabel="Daha fazla yer" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.morePlacesButton}>
                    <Text style={styles.morePlacesText}>{showExtendedPlaces ? 'Yakın listeye dön' : `Daha fazla yer (${extendedPlaces.length})`}</Text>
                    {showExtendedPlaces ? <ChevronUp color={colors.mint} size={16} /> : <ChevronDown color={colors.mint} size={16} />}
                  </AnimatedPressable>
                )}
              </>
            )}

            </>}
            {area?.place && isRealtimePlaceBlocked && (
              <View style={styles.proximityWarning}>
                <AlertCircle color={colors.danger} size={18} />
                <Text style={styles.proximityWarningText}>Yer seçildi. Burada paylaşmak için daha yakın ve güncel bir konum gerekli.</Text>
              </View>
            )}

            {step === 1 && <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Sinyal türü seç</Text>
              <Text style={styles.sectionHint}>3 saat canlı kalır</Text>
            </View>
            <View style={styles.chipRow}>
              {signalTypes.map((item) => (
                <BlinkrChip
                  icon={(color) => <SignalSymbol color={color} size={20} type={item.type} />}
                  key={item.type}
                  label={item.label}
                  onPress={() => { setSignalType(item.type); setSignalValue(item.value ?? null); }}
                  selected={signalType === item.type}
                  tone={item.tone}
                />
              ))}
            </View>

            {signalOptions[signalType] ? (
              <View style={[styles.chipRow, styles.valueRow]}>
                {signalOptions[signalType]?.map((option) => (
                  <BlinkrChip key={option.value} label={option.label} onPress={() => setSignalValue(option.value)} selected={signalValue === option.value} tone={typeTone} />
                ))}
              </View>
            ) : null}
            </>}

            {step === 2 && <>
            <Text style={styles.inputLabel}>Başlık</Text>
            <TextInput maxLength={80} onChangeText={setTitle} placeholder="Örn. Bekleme süresi 10 dakika" placeholderTextColor={colors.textSecondary} style={styles.input} value={title} />
            <Text style={styles.inputLabel}>Gözlemin</Text>
            <TextInput maxLength={500} multiline onChangeText={setContent} placeholder="Karar vermeyi kolaylaştıracak güncel ve somut bir bilgi yaz." placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textArea]} textAlignVertical="top" value={content} />
            <Text style={styles.counter}>{content.length}/500</Text>
            {content.trim().length > 0 && content.trim().length < 5 && <Text style={styles.errorText}>Gözlem en az 5 karakter olmalı.</Text>}

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Fotoğraf veya video</Text>
              <Text style={styles.sectionHint}>İSTEĞE BAĞLI</Text>
            </View>
            {mediaBlocked ? (
              <View accessibilityRole="alert" style={styles.safetyNotice} testID="no-media-notice">
                <AlertCircle color={colors.warning} size={20} />
                <View style={styles.flex}>
                  <Text style={styles.safetyTitle}>{t('safety.noMediaTitle')}</Text>
                  <Text style={styles.policyText}>{t('safety.noMediaBody')}</Text>
                  {media.length > 0 ? <BlinkrButton label={t('safety.removeMedia')} onPress={() => setMedia([])} style={styles.safetyAction} variant="secondary" /> : null}
                </View>
              </View>
            ) : null}
            {sensitivity && !mediaBlocked && privacyAckFor !== area?.place?.id ? (
              <View accessibilityRole="alert" style={styles.safetyNotice} testID="privacy-notice">
                <ShieldCheck color={colors.warning} size={20} />
                <View style={styles.flex}>
                  <Text style={styles.safetyTitle}>{t('safety.privacyTitle')}</Text>
                  <Text style={styles.policyText}>{t('safety.privacyBody')}</Text>
                  <BlinkrButton label={t('safety.gotIt')} onPress={() => setPrivacyAckFor(area?.place?.id ?? null)} style={styles.safetyAction} variant="secondary" />
                </View>
              </View>
            ) : null}
            {mediaBlocked ? null : <View style={styles.sourceRow}>
              <BlinkrButton icon={<Camera color={colors.text} size={18} />} label="Kamera" onPress={() => (onRequestCamera ? onRequestCamera() : pickMedia('camera'))} style={styles.mediaButton} variant="secondary" />
              <BlinkrButton icon={<ImageIcon color={colors.text} size={18} />} label="Galeri" onPress={() => pickMedia('library')} style={styles.mediaButton} variant="secondary" />
            </View>}

            {media.map((item) => (
              <View key={item.id} style={styles.mediaDraft}>
                {item.mediaType === 'Video'
                  ? <VideoPreview style={styles.mediaThumb} uri={item.previewUri} />
                  : <Image accessibilityIgnoresInvertColors source={{ uri: item.previewUri }} style={styles.mediaThumb} />}
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.mediaName}>{item.name}</Text>
                  <Text style={[styles.mediaStatus, item.status === 'failed' && styles.mediaFailed]}>
                    {item.status === 'ready' ? 'Hazır' : item.status === 'failed' ? item.error : item.status === 'uploading' ? 'Yükleniyor' : 'Hazırlanıyor'}
                  </Text>
                </View>
                {(item.status === 'uploading' || item.status === 'preparing') && <ActivityIndicator color={colors.mint} />}
                {item.status === 'failed' && (
                  <AnimatedPressable accessibilityLabel="Tekrar dene" accessibilityRole="button" onPress={() => retryUpload(item)} style={styles.deleteButton}>
                    <RefreshCw color={colors.mint} size={18} />
                  </AnimatedPressable>
                )}
                <AnimatedPressable accessibilityLabel="Medyayı kaldır" accessibilityRole="button" onPress={() => setMedia((current) => current.filter((draft) => draft.id !== item.id))} style={styles.deleteButton}>
                  <Trash2 color={colors.textSecondary} size={18} />
                </AnimatedPressable>
              </View>
            ))}
            </>}

            {step === 3 && <>
            <View style={styles.placeCard}>
              <View style={[styles.placeTile, { borderColor: typeTone }]}><SignalSymbol color={typeTone} size={24} type={signalType} /></View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.placeName}>{placeName}</Text>
                <Text style={styles.placeMeta}>{area?.place ? trustLabel(area.proximity?.trustLevel) : 'Yaklaşık konum'}</Text>
              </View>
            </View>
            <Text style={styles.summaryTitle}>{title.trim() || selectedType?.label}</Text>
            {!!content && <Text style={styles.summaryText}>{content}</Text>}
            {!!media.length && <Text style={styles.placeMeta}>{media.length} medya eklendi</Text>}
            {!hasPayload && <Text style={styles.errorText}>Paylaşım içeriği eksik veya çok kısa.</Text>}
            {mediaBlocked && media.length > 0 ? <Text style={styles.errorText}>{t('safety.noMediaTitle')}</Text> : null}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionLabel}>Haritada görünüm</Text>
              <ShieldCheck color={colors.mint} size={18} />
            </View>
            <View style={styles.segmented}>
              <AnimatedPressable accessibilityRole="button" aria-selected={identityDisclosure === 'LimitedProfile'} onPress={() => setIdentityDisclosure('LimitedProfile')} style={[styles.segment, identityDisclosure === 'LimitedProfile' && styles.segmentActive]}>
                <Text style={[styles.segmentText, identityDisclosure === 'LimitedProfile' && styles.segmentTextActive]}>Sınırlı profil</Text>
              </AnimatedPressable>
              <AnimatedPressable accessibilityRole="button" aria-selected={identityDisclosure === 'AnonymousMap'} onPress={() => setIdentityDisclosure('AnonymousMap')} style={[styles.segment, identityDisclosure === 'AnonymousMap' && styles.segmentActive]}>
                <Text style={[styles.segmentText, identityDisclosure === 'AnonymousMap' && styles.segmentTextActive]}>Anonim</Text>
              </AnimatedPressable>
            </View>

            <View style={styles.policySummary}>
              <ShieldCheck color={colors.mint} size={20} />
              <Text style={styles.policyText}>Paylaşım haritada herkese görünür. Kesin cihaz konumun gösterilmez.</Text>
            </View>
            <Text style={styles.placeMeta} testID="ttl-info">{t('lifetime', { duration: formatLifetime(SIGNAL_TTL_MINUTES[signalType], i18n.language === 'en' ? 'en' : 'tr') })}</Text>
            </>}
          </ScrollView>}

          {!pickerOpen && <View style={styles.footer}>
            {step > 0 && <BlinkrButton disabled={isSubmitting} label="Geri" onPress={() => setStep(step - 1)} style={styles.backButton} variant="secondary" />}
            <BlinkrButton
              disabled={isPrimaryActionBlocked}
              icon={step === 3 && !isSubmitting ? <Send color={colors.ink} size={22} /> : undefined}
              label={publishLabel}
              loading={isSubmitting}
              onPress={() => step < 3 ? setStep(step + 1) : publish()}
              size="lg"
              style={styles.primaryButton}
            />
          </View>}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 100 },
  backdropShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 12, 10, 0.32)' },
  top: { left: 0, paddingHorizontal: spacing.md, position: 'absolute', right: 0, top: 0 },
  stepLabel: { ...typography.caption, color: colors.textSecondary },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  bottom: { bottom: 0, left: 0, position: 'absolute', right: 0 },
  panel: { backgroundColor: colors.glass, borderColor: colors.border, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, ...shadow },
  progress: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  progressSegment: { backgroundColor: colors.lineStrong, borderRadius: 2, flex: 1, height: 3 },
  progressSegmentActive: { backgroundColor: colors.primary },
  heading: { ...typography.title, color: colors.text },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md, paddingTop: spacing.md },
  errorBox: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { ...typography.bodyStrong, color: colors.text },
  sectionHint: { ...typography.label, color: colors.textSecondary },
  placeCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  placeCardSelected: { borderColor: colors.mint },
  placeTile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  placeTileSmall: { borderRadius: radii.sm + 2, height: 36, width: 36 },
  placeName: { ...typography.bodyStrong, color: colors.text },
  placeMeta: { ...typography.caption, color: colors.textSecondary },
  summaryLabel: { ...typography.label, color: colors.mint },
  proximityText: { ...typography.caption, color: colors.mint, fontWeight: '700', marginTop: 2 },
  proximityBlocked: { color: colors.danger },
  changeButton: { minHeight: 44, paddingHorizontal: 14 },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  sourceButton: { flexBasis: '46%', flexGrow: 1, minHeight: 48, paddingHorizontal: 10 },
  mediaButton: { flex: 1, minHeight: 48 },
  settingsLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: spacing.md, minHeight: 44 },
  settingsText: { ...typography.caption, color: colors.orange, fontWeight: '700' },
  nearbyState: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  nearbyStateText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  nearbyList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  nearbyItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.md },
  nearbyItemDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  nearbyName: { ...typography.bodyStrong, color: colors.text, fontSize: 15 },
  nearbyMeta: { ...typography.caption, color: colors.textSecondary },
  pickText: { ...typography.label, backgroundColor: colors.greenSoft, borderRadius: radii.pill, color: colors.mint, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  coordinateAction: { marginTop: spacing.sm },
  morePlacesButton: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 44 },
  morePlacesText: { ...typography.caption, color: colors.mint, fontWeight: '700' },
  proximityWarning: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  proximityWarningText: { ...typography.caption, color: colors.danger, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  valueRow: { marginTop: spacing.lg },
  inputLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.lg },
  input: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  textArea: { minHeight: 112 },
  counter: { ...typography.caption, color: colors.textSecondary, marginTop: 6, textAlign: 'right' },
  mediaDraft: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, padding: spacing.sm },
  mediaThumb: { backgroundColor: colors.surfaceElevated, borderRadius: radii.sm, height: 52, width: 52 },
  mediaName: { ...typography.caption, color: colors.text, fontWeight: '700' },
  mediaStatus: { ...typography.caption, color: colors.textSecondary },
  mediaFailed: { color: colors.danger },
  deleteButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 40 },
  summaryTitle: { ...typography.heading, color: colors.text, marginTop: spacing.lg },
  summaryText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  segmented: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', padding: 4 },
  segment: { alignItems: 'center', borderRadius: radii.md - 4, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: colors.ink },
  policySummary: { alignItems: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  policyText: { ...typography.caption, color: colors.mint, flex: 1 },
  safetyNotice: { alignItems: 'flex-start', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  safetyTitle: { ...typography.bodyStrong, color: colors.text },
  safetyAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  uncertain: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  backButton: { minWidth: 96 },
  primaryButton: { flex: 1 },
});
