import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Crosshair,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Search,
  Send,
  Settings,
  ShieldCheck,
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

import { listFriends } from '../api';
import { splitNearbyPlaces } from '../nearbyPlaceTiers';
import { formatCategory, formatDistance } from '../presentation';
import { categoryTone, colors, radii, spacing, typography } from '../theme';
import { canPublishAt, friendlyError, signalOptions, trustLabel } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { SignalSymbol } from './SignalSymbol';
import { PlacePicker } from './PlacePicker';
import { PlaceSymbol } from './PlaceSymbol';
import { VideoPreview } from './VideoPreview';
import { BlinkrButton } from './ui/BlinkrButton';
import { MAX_VIDEO_SECONDS } from '../cameraEffects';
import { accuracyUncertain, mediaAllowedAt, placeSensitivity } from '../placeSafety';
import { SIGNAL_CATALOG, SIGNAL_TTL_MINUTES, formatLifetime } from '../signalCatalog';
import { capturedAtOf, isStaleCapture, oldestCapture } from '../galleryCapture';
import { shareToFriendsAvailability, toggleSnapFriend } from '../snapPresentation';
import { BlinkrChip } from './ui/BlinkrChip';
import { PersonalDataNotice } from './ui/PersonalDataNotice';
import { MentionSuggestions } from './ui/MentionSuggestions';
import { insertMention } from '../richText';
import type {
  AuthResponse,
  BlinkrPlace,
  ComposerArea,
  CreateSignalInput,
  Friend,
  IdentityDisclosure,
  LocationReadiness,
  NearbyStatus,
  SignalType,
} from '../types';

/** What the composer decides; the map adds the position and hands it to the share outbox (plan-devam D9). */
export type ComposerInput = Omit<CreateSignalInput, 'latitude' | 'longitude' | 'accuracyMeters' | 'locationName' | 'media'>;
export type ComposerMedia = { uri: string; kind: 'image' | 'video'; mimeType?: string | null; fileName?: string | null };
/** The send targets (D8): the map always; the story and friends (as snaps) when chosen. */
export type ComposerExtras = { media: ComposerMedia[]; story: boolean; snapFriendIds: string[] };

type Props = {
  area: ComposerArea | null;
  auth: AuthResponse;
  canAskLocationAgain: boolean;
  error: string | null;
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
  onSubmit: (input: ComposerInput, extras: ComposerExtras) => Promise<void>;
  pendingCapture?: ImagePicker.ImagePickerAsset | null;
  visible: boolean;
};

type MediaDraft = {
  id: string;
  uri: string;
  kind: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
  /** Gallery capture time (EXIF), when known - only used to lower trust, never sent as EXIF. */
  capturedAt: Date | null;
};

const MAX_MEDIA = 4;
const MAX_TEXT = 280;
const TYPE_ORDER: SignalType[] = ['GeneralObservation', 'Crowd', 'Queue', 'TemporaryStatus', 'Event', 'Offer', 'NewOpening'];

/**
 * plan-devam D6/D8: one page instead of the four-step wizard - the place (pre-selected, changeable), what is happening
 * (big type chips + level), one description (no title), who sees it, and where it goes (map, my story, friends as
 * snaps). The yellow Gönder hands it to the outbox; uploading happens in the background (D9).
 */
export function SignalComposer({
  area,
  auth,
  canAskLocationAgain,
  error,
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { t, i18n } = useTranslation('create');
  const [signalType, setSignalType] = useState<SignalType>(initialSignal?.type ?? 'GeneralObservation');
  const [signalValue, setSignalValue] = useState<string | null>(initialSignal?.value ?? null);
  const [content, setContent] = useState('');
  /** V2-4: where the cursor is in the description, for the @ suggestions. */
  const [contentCursor, setContentCursor] = useState(0);
  const [identityDisclosure, setIdentityDisclosure] = useState<IdentityDisclosure>('LimitedProfile');
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [showExtendedPlaces, setShowExtendedPlaces] = useState(false);
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // 'main' = the one page; 'place' = the place chooser; 'search' = the place search.
  const [view, setView] = useState<'main' | 'place' | 'search'>('main');
  // The privacy reminder at a sensitive place is shown once per place per composer session.
  const [privacyAckFor, setPrivacyAckFor] = useState<string | null>(null);
  const [storyOn, setStoryOn] = useState(true);
  const [friendsOn, setFriendsOn] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendsFailed, setFriendsFailed] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [snapFriendIds, setSnapFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) return;
    setSignalType('GeneralObservation');
    setSignalValue(null);
    setContent('');
    setIdentityDisclosure('LimitedProfile');
    setShowExtendedPlaces(false);
    setMedia([]);
    setMediaError(null);
    setView('main');
    setStoryOn(true);
    setFriendsOn(false);
    setSnapFriendIds([]);
  }, [visible]);

  const text = content.trim();
  const hasPayload = (text.length === 0 || text.length >= 5) && (text.length >= 5 || media.length > 0 || signalType !== 'GeneralObservation');
  const isRealtimePlaceBlocked = !canPublishAt(area);
  const sensitivity = placeSensitivity(area?.place?.category);
  const mediaBlocked = !mediaAllowedAt(area?.place?.category);
  const locationUncertain = area?.source !== 'map' && accuracyUncertain(area?.observationAccuracyMeters ?? area?.accuracyMeters);
  const canPublish = Boolean(area && hasPayload && !(mediaBlocked && media.length > 0) && !isRealtimePlaceBlocked && !isSubmitting);
  const anonymous = identityDisclosure === 'AnonymousMap';
  const { primary: primaryPlaces, extended: extendedPlaces } = useMemo(() => splitNearbyPlaces(nearbyPlaces), [nearbyPlaces]);
  const visibleNearbyPlaces = showExtendedPlaces ? [...primaryPlaces, ...extendedPlaces].slice(0, 10) : primaryPlaces;
  const typeTone = SIGNAL_CATALOG[signalType]?.tone ?? colors.mint;
  const photo = media.find((item) => item.kind === 'image') ?? null;
  const snapAvailability = shareToFriendsAvailability({ anonymous, hasPhoto: Boolean(photo) });
  const storyAvailable = !anonymous && media.length > 0;

  const selectArea = async (source: 'device' | 'map', place?: BlinkrPlace | null) => {
    if (isSelectingArea) return;
    setIsSelectingArea(true);
    onClearError();
    try {
      await onSelectArea(source, place);
      setView('main');
    } catch (err) {
      setMediaError(friendlyError(err));
    } finally {
      setIsSelectingArea(false);
    }
  };

  const attachAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const kind = asset.type === 'video' ? 'video' : 'image';
    setMedia((current) => current.length >= MAX_MEDIA ? current : [...current, {
      id: `${Date.now()}-${asset.uri}`,
      uri: asset.uri,
      kind,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      capturedAt: capturedAtOf(asset as { exif?: Record<string, unknown> | null; capturedAtUtc?: string | null }),
    }]);
  };

  useEffect(() => {
    if (visible && pendingCapture) attachAsset(pendingCapture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pendingCapture]);

  const pickMedia = async (source: 'camera' | 'library') => {
    setMediaError(null);
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setMediaError(t(source === 'camera' ? 'media.cameraPermission' : 'media.libraryPermission'));
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS, exif: true });
      if (!result.canceled && result.assets[0]) attachAsset(result.assets[0]);
    } catch (err) {
      setMediaError(friendlyError(err, t('media.pickFailed')));
    }
  };

  // Friends are loaded once, when "Arkadaşlar" is switched on with a photo (not on every open).
  useEffect(() => {
    if (!visible || !friendsOn || snapAvailability !== 'ok' || friends) return undefined;
    const controller = new AbortController();
    listFriends(auth, controller.signal, { onAuthRefresh: onAuthChange, onSessionExpired })
      .then((list) => { if (!controller.signal.aborted) { setFriends(list); setFriendsFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setFriendsFailed(true); });
    return () => controller.abort();
  }, [visible, friendsOn, snapAvailability, friends, auth, onAuthChange, onSessionExpired]);

  const publish = async () => {
    if (!canPublish) return;
    await onSubmit({
      audienceType: 'Public',
      content: text,
      // No title field any more (D6): the server needs a title or a text, so a photo-only signal carries its type
      // name, which every list and card hides as a heading (`cardText`).
      title: text ? '' : SIGNAL_CATALOG[signalType].label,
      // No client-side expiresAt: the server applies its own per-type lifetime (trust is server-owned).
      identityDisclosure,
      locationPrecision: area?.place ? 'PlaceCenter' : 'ApproximateArea',
      mediaCapturedAtUtc: oldestCapture(media.map((item) => item.capturedAt))?.toISOString() ?? null,
      placeId: area?.place?.id ?? null,
      signalType,
      signalValue,
    }, {
      media: media.map(({ uri, kind, mimeType, fileName }) => ({ uri, kind, mimeType, fileName })),
      story: storyAvailable && storyOn,
      snapFriendIds: snapAvailability === 'ok' && friendsOn ? snapFriendIds : [],
    });
  };

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'main') setView('main'); else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, view, onClose]);

  if (!visible) return null;

  // Three even columns; the seventh type keeps the same width instead of stretching across the row.
  const typeWidth = Math.floor((windowWidth - spacing.lg * 2 - spacing.sm * 2) / 3);
  const heroHeight = Math.round(Math.min(windowWidth * 0.8, (windowHeight - insets.top) * 0.34));
  const shownFriends = (friends ?? []).filter((friend) => !friendQuery.trim() || friend.userName.toLocaleLowerCase('tr-TR').includes(friendQuery.trim().toLocaleLowerCase('tr-TR')));
  const errorText = error || mediaError;

  const placeRow = (
    <View style={[styles.placeRow, area?.place && styles.placeRowSelected]}>
      {area?.place ? (
        <View style={[styles.placeTile, { borderColor: categoryTone(area.place.category) }]}><PlaceSymbol category={area.place.category} color={categoryTone(area.place.category)} size={22} /></View>
      ) : (
        <View style={[styles.placeTile, { borderColor: colors.mint }]}>{area ? <MapPin color={colors.mint} size={22} /> : <ActivityIndicator color={colors.mint} size="small" />}</View>
      )}
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.placeName}>{area?.place?.name ?? area?.name ?? t('place.locating')}</Text>
        {area?.place ? (
          <Text numberOfLines={2} style={[styles.placeMeta, area.proximity && !area.proximity.allowed && styles.blockedText]}>
            {[formatCategory(area.place.category), formatDistance(area.place.distanceMeters), area.proximity ? trustLabel(area.proximity.trustLevel) : null].filter(Boolean).join(' · ')}
          </Text>
        ) : area ? <Text numberOfLines={1} style={styles.placeMeta}>{t('place.approximate')}</Text> : null}
      </View>
      <BlinkrButton label={area?.place ? t('place.change') : t('place.choose')} onPress={() => setView('place')} style={styles.changeButton} variant="secondary" />
    </View>
  );

  const placeChooser = (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.sourceRow}>
        <BlinkrButton icon={<Search color={colors.text} size={18} />} label={t('place.search')} onPress={() => setView('search')} style={styles.sourceButton} variant="secondary" />
        <BlinkrButton disabled={isSelectingArea} icon={isSelectingArea ? <ActivityIndicator color={colors.text} size="small" /> : <Navigation color={colors.text} size={18} />} label={t('place.nearMe')} onPress={() => selectArea('device')} style={styles.sourceButton} variant="secondary" />
        <BlinkrButton disabled={isSelectingArea} icon={<Crosshair color={colors.text} size={18} />} label={t('place.mapPoint')} onPress={() => selectArea('map')} style={styles.sourceButton} variant="secondary" />
      </View>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionLabel}>{t('place.nearby')}</Text>
        {nearbyStatus === 'READY' ? <Text style={styles.sectionHint}>{t('place.count', { count: primaryPlaces.length })}</Text> : null}
      </View>
      {nearbyStatus === 'LOADING' && visibleNearbyPlaces.length === 0 ? (
        <View style={styles.nearbyState}><ActivityIndicator color={colors.mint} /><Text style={styles.nearbyStateText}>{t('place.searching')}</Text></View>
      ) : nearbyStatus === 'NOT_LOADED' || (visibleNearbyPlaces.length === 0 && nearbyCoverageState === 'not_loaded') ? (
        <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>{t('place.notLoaded')}</Text></View>
      ) : nearbyStatus === 'FAILED' && visibleNearbyPlaces.length === 0 ? (
        <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>{t('place.failed')}</Text></View>
      ) : visibleNearbyPlaces.length === 0 ? (
        <View style={styles.nearbyState}><Search color={colors.textSecondary} size={18} /><Text style={styles.nearbyStateText}>{t('place.none')}</Text></View>
      ) : (
        <View style={styles.nearbyList}>
          {visibleNearbyPlaces.map((place, index) => {
            const tone = categoryTone(place.category);
            const selected = place.id === area?.place?.id;
            return (
              <AnimatedPressable accessibilityLabel={t('place.pick', { name: place.name })} accessibilityRole="button" key={place.id} onPress={() => selectArea('map', place)} style={[styles.nearbyItem, index > 0 && styles.nearbyItemDivider]}>
                <View style={[styles.placeTile, styles.placeTileSmall, { borderColor: tone }]}><PlaceSymbol category={place.category} color={tone} size={18} /></View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.nearbyName}>{place.name}</Text>
                  <Text numberOfLines={1} style={styles.placeMeta}>{[formatCategory(place.category), formatDistance(place.distanceMeters)].filter(Boolean).join(' · ')}</Text>
                </View>
                {selected ? <Check color={colors.mint} size={20} /> : null}
              </AnimatedPressable>
            );
          })}
        </View>
      )}
      <BlinkrButton accessibilityLabel={t('place.shareHere')} icon={<MapPin color={colors.mint} size={18} />} label={t('place.shareHere')} onPress={() => area && selectArea(area.source === 'map' ? 'map' : 'device', null)} style={styles.coordinateAction} variant="ghost" />
      {extendedPlaces.length > 0 ? (
        <AnimatedPressable accessibilityLabel={t('place.more', { count: extendedPlaces.length })} accessibilityRole="button" onPress={() => setShowExtendedPlaces((v) => !v)} style={styles.morePlacesButton}>
          <Text style={styles.morePlacesText}>{showExtendedPlaces ? t('place.less') : t('place.more', { count: extendedPlaces.length })}</Text>
          {showExtendedPlaces ? <ChevronUp color={colors.mint} size={16} /> : <ChevronDown color={colors.mint} size={16} />}
        </AnimatedPressable>
      ) : null}
    </ScrollView>
  );

  const toggleRow = ({ label, hint, on, disabled, onPress, testID }: { label: string; hint: string; on: boolean; disabled?: boolean; onPress?: () => void; testID?: string }) => (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[styles.targetRow, disabled && styles.targetDisabled]}
      testID={testID}
    >
      <View style={[styles.checkBox, on && styles.checkBoxOn]}>{on ? <Check color={colors.onCreate} size={16} strokeWidth={3} /> : null}</View>
      <View style={styles.flex}>
        <Text style={styles.targetLabel}>{label}</Text>
        <Text style={styles.placeMeta} testID={testID ? `${testID}-hint` : undefined}>{hint}</Text>
      </View>
    </AnimatedPressable>
  );

  const main = (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {errorText ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <AlertCircle color={colors.danger} size={18} />
          <Text style={styles.errorText}>{friendlyError(new Error(errorText))}</Text>
        </View>
      ) : null}

      {media.length > 0 ? (
        <View style={styles.mediaSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStrip}>
            {media.map((item) => (
              <View key={item.id} style={[styles.hero, { height: heroHeight, width: media.length === 1 ? windowWidth - spacing.lg * 2 : Math.round(heroHeight * 0.75) }]}>
                {item.kind === 'video'
                  ? <VideoPreview style={StyleSheet.absoluteFill} uri={item.uri} />
                  : <Image accessibilityIgnoresInvertColors resizeMode="contain" source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />}
                <AnimatedPressable accessibilityLabel={t('media.remove')} accessibilityRole="button" hitSlop={8} onPress={() => setMedia((current) => current.filter((draft) => draft.id !== item.id))} pressScale={0.88} style={styles.heroRemove}>
                  <X color={colors.text} size={18} />
                </AnimatedPressable>
                {isStaleCapture(item.capturedAt) ? (
                  <View style={styles.heroNote}><Text style={styles.heroNoteText} testID="gallery-stale">{t('gallery.stale', { hours: Math.max(2, Math.round((Date.now() - item.capturedAt!.getTime()) / 3_600_000)) })}</Text></View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {placeRow}
      {locationReadiness === 'permission-required' && !area ? (
        <AnimatedPressable accessibilityRole="button" onPress={canAskLocationAgain ? () => selectArea('device') : onOpenSettings} style={styles.settingsLink}>
          <Settings color={colors.warning} size={16} />
          <Text style={styles.settingsText}>{canAskLocationAgain ? t('place.permission') : t('place.settings')}</Text>
        </AnimatedPressable>
      ) : null}
      {!area?.place && primaryPlaces.length > 0 ? (
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPlaces}>
          {primaryPlaces.slice(0, 5).map((place) => (
            <BlinkrChip
              accessibilityLabel={t('place.pick', { name: place.name })}
              icon={(color) => <PlaceSymbol category={place.category} color={color} size={16} />}
              key={place.id}
              label={place.name}
              onPress={() => selectArea('map', place)}
              selected={false}
              tone={categoryTone(place.category)}
            />
          ))}
        </ScrollView>
      ) : null}
      {locationUncertain ? (
        <View accessibilityRole="alert" style={styles.safetyNotice} testID="location-uncertain">
          <AlertCircle color={colors.warning} size={20} />
          <View style={styles.flex}>
            <Text style={styles.safetyTitle}>{t('safety.uncertainTitle')}</Text>
            <Text style={styles.warningText}>{t('safety.uncertainBody', { meters: Math.round(area?.observationAccuracyMeters ?? area?.accuracyMeters ?? 0) })}</Text>
          </View>
        </View>
      ) : null}
      {area?.place && isRealtimePlaceBlocked ? (
        <View style={styles.proximityWarning}>
          <AlertCircle color={colors.danger} size={18} />
          <Text style={styles.proximityWarningText}>{t('place.tooFar')}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{t('type.heading')}</Text>
      <View style={styles.typeGrid}>
        {TYPE_ORDER.map((type) => {
          const entry = SIGNAL_CATALOG[type];
          const selected = signalType === type;
          return (
            <AnimatedPressable
              accessibilityLabel={entry.label}
              accessibilityRole="button"
              aria-selected={selected}
              key={type}
              onPress={() => { setSignalType(type); setSignalValue(entry.options?.[0]?.value ?? null); }}
              pressScale={0.95}
              style={[styles.typeChip, { width: typeWidth }, selected && { backgroundColor: entry.tone, borderColor: entry.tone }]}
            >
              <SignalSymbol color={selected ? colors.ink : entry.tone} size={22} type={type} />
              <Text numberOfLines={1} style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{entry.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
      {signalOptions[signalType] ? (
        <View style={styles.levelRow}>
          {signalOptions[signalType]?.map((option) => (
            <AnimatedPressable
              accessibilityLabel={option.label}
              accessibilityRole="button"
              aria-selected={signalValue === option.value}
              key={option.value}
              onPress={() => setSignalValue(option.value)}
              style={[styles.level, signalValue === option.value && { backgroundColor: typeTone }]}
            >
              <Text style={[styles.levelText, signalValue === option.value && styles.typeLabelSelected]}>{option.label}</Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : null}

      <TextInput
        accessibilityLabel={t('text.label')}
        maxLength={MAX_TEXT}
        multiline
        onChangeText={(value) => { setContent(value); setContentCursor(value.length); }}
        onSelectionChange={(e) => setContentCursor(e.nativeEvent.selection.end)}
        placeholder={t('text.placeholder')}
        placeholderTextColor={colors.textSecondary}
        style={styles.textArea}
        textAlignVertical="top"
        value={content}
      />
      <MentionSuggestions
        auth={auth}
        cursor={contentCursor}
        onPick={(user) => { const next = insertMention(content, contentCursor, user.userName); setContent(next.text.slice(0, MAX_TEXT)); setContentCursor(next.cursor); }}
        text={content}
      />
      <View style={styles.counterRow}>
        {text.length > 0 && text.length < 5 ? <Text style={styles.errorText}>{t('text.tooShort')}</Text> : <View style={styles.flex} />}
        <Text style={styles.counter}>{content.length}/{MAX_TEXT}</Text>
      </View>
      <PersonalDataNotice texts={[content]} />

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
      {mediaBlocked || media.length >= MAX_MEDIA ? null : (
        <View style={styles.sourceRow}>
          <BlinkrButton icon={<Camera color={colors.text} size={18} />} label={t('media.camera')} onPress={() => (onRequestCamera ? onRequestCamera() : pickMedia('camera'))} style={styles.mediaButton} variant="secondary" />
          <BlinkrButton icon={<ImageIcon color={colors.text} size={18} />} label={t('media.gallery')} onPress={() => pickMedia('library')} style={styles.mediaButton} variant="secondary" />
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('identity.heading')}</Text>
      <View style={styles.segmented}>
        {(['LimitedProfile', 'AnonymousMap'] as const).map((value) => (
          <AnimatedPressable accessibilityRole="button" aria-selected={identityDisclosure === value} key={value} onPress={() => setIdentityDisclosure(value)} style={[styles.segment, identityDisclosure === value && styles.segmentActive]}>
            <Text style={[styles.segmentText, identityDisclosure === value && styles.segmentTextActive]}>{t(value === 'LimitedProfile' ? 'identity.limited' : 'identity.anonymous')}</Text>
          </AnimatedPressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t('targets.heading')}</Text>
      <View style={styles.targets}>
        <View style={styles.targetRow}>
          <View style={[styles.checkBox, styles.checkBoxOn]}><Check color={colors.onCreate} size={16} strokeWidth={3} /></View>
          <View style={styles.flex}>
            <Text style={styles.targetLabel}>{t('targets.map')}</Text>
            <Text style={styles.placeMeta} testID="ttl-info">{t('lifetime', { duration: formatLifetime(SIGNAL_TTL_MINUTES[signalType], i18n.language === 'en' ? 'en' : 'tr') })}</Text>
          </View>
        </View>
        <View style={styles.targetDivider} />
        {toggleRow({
          label: t('targets.story'),
          hint: anonymous ? t('targets.storyAnonymous') : media.length === 0 ? t('targets.storyNeedsMedia') : t('targets.storyHint'),
          on: storyAvailable && storyOn,
          disabled: !storyAvailable,
          onPress: () => setStoryOn((v) => !v),
          testID: 'target-story',
        })}
        <View style={styles.targetDivider} />
        {toggleRow({
          label: t('targets.friends'),
          hint: snapAvailability === 'anonymous' ? t('snap.anonymous') : snapAvailability === 'no-photo' ? t('snap.noPhoto') : snapFriendIds.length > 0 && friendsOn ? t('snap.selected', { count: snapFriendIds.length }) : t('snap.hint'),
          on: snapAvailability === 'ok' && friendsOn,
          disabled: snapAvailability !== 'ok',
          onPress: () => setFriendsOn((v) => !v),
          testID: 'target-friends',
        })}
        {snapAvailability === 'ok' && friendsOn ? (
          <View style={styles.friendsBox}>
            {friendsFailed ? <Text style={styles.errorText}>{t('snap.loadFailed')}</Text> : null}
            {!friends && !friendsFailed ? <ActivityIndicator color={colors.mint} /> : null}
            {friends && friends.length === 0 ? <Text style={styles.placeMeta}>{t('snap.none')}</Text> : null}
            {friends && friends.length > 8 ? (
              <TextInput accessibilityLabel={t('targets.search')} onChangeText={setFriendQuery} placeholder={t('targets.search')} placeholderTextColor={colors.textSecondary} style={styles.friendSearch} value={friendQuery} />
            ) : null}
            {friends && friends.length > 0 ? (
              <View style={styles.chipRow} testID="snap-friends">
                {shownFriends.map((friend) => (
                  <BlinkrChip key={friend.id} label={friend.userName} onPress={() => setSnapFriendIds((current) => toggleSnapFriend(current, friend.id))} selected={snapFriendIds.includes(friend.id)} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.policySummary}>
        <ShieldCheck color={colors.mint} size={18} />
        <Text style={styles.policyText}>{t('identity.note')}</Text>
      </View>
      {!hasPayload ? <Text style={[styles.errorText, styles.missing]}>{t('text.missing')}</Text> : null}
      {mediaBlocked && media.length > 0 ? <Text style={[styles.errorText, styles.missing]}>{t('safety.noMediaTitle')}</Text> : null}
    </ScrollView>
  );

  const heading = view === 'main' ? t('title') : t('place.chooserTitle');
  return (
    <Animated.View accessibilityViewIsModal entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={[styles.host, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {view === 'main' ? (
          <AnimatedPressable accessibilityLabel={t('close')} accessibilityRole="button" onPress={onClose} pressScale={0.88} style={styles.iconButton}>
            <X color={colors.text} size={24} />
          </AnimatedPressable>
        ) : (
          <AnimatedPressable accessibilityLabel={t('back')} accessibilityRole="button" onPress={() => setView('main')} pressScale={0.88} style={styles.iconButton}>
            <ChevronLeft color={colors.text} size={26} />
          </AnimatedPressable>
        )}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>{heading}</Text>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {view === 'search'
          ? <View style={styles.pickerHost}><PlacePicker nearby={nearbyPlaces} origin={area ? { latitude: area.observationLatitude ?? area.region.latitude, longitude: area.observationLongitude ?? area.region.longitude } : null} onBack={() => setView('place')} onSelect={(place) => selectArea('device', place)} /></View>
          : view === 'place' ? placeChooser : main}
        {view === 'main' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <BlinkrButton
              disabled={!canPublish}
              icon={isSubmitting ? undefined : <Send color={colors.onCreate} size={20} />}
              label={isSubmitting ? t('sending') : t('send')}
              loading={isSubmitting}
              onPress={publish}
              size="lg"
              style={styles.flex}
              variant="create"
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 100 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  heading: { ...typography.heading, color: colors.text, flex: 1, textAlign: 'center' },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  flex: { flex: 1 },
  pickerHost: { flex: 1, paddingHorizontal: spacing.lg },
  scrollContent: { paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  errorBox: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  missing: { marginTop: spacing.md },
  mediaSection: { marginBottom: spacing.md, marginHorizontal: -spacing.lg },
  mediaStrip: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  hero: { backgroundColor: colors.surfaceElevated, borderRadius: radii.card, overflow: 'hidden' },
  heroRemove: { alignItems: 'center', backgroundColor: colors.glass, borderRadius: radii.pill, height: 36, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, width: 36 },
  heroNote: { backgroundColor: colors.glass, borderRadius: radii.md, bottom: spacing.sm, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, position: 'absolute', right: spacing.sm },
  heroNoteText: { ...typography.caption, color: colors.warning },
  placeRow: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  placeRowSelected: { borderColor: colors.mint },
  placeTile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  placeTileSmall: { height: 36, width: 36 },
  placeName: { ...typography.bodyStrong, color: colors.text },
  placeMeta: { ...typography.caption, color: colors.textSecondary },
  blockedText: { color: colors.danger },
  changeButton: { minHeight: 40, paddingHorizontal: 14 },
  quickPlaces: { gap: spacing.sm, paddingTop: spacing.sm },
  settingsLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, marginTop: spacing.sm, minHeight: 44 },
  settingsText: { ...typography.caption, color: colors.warning, fontWeight: '700' },
  sectionTitle: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { ...typography.bodyStrong, color: colors.text },
  sectionHint: { ...typography.label, color: colors.textSecondary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: 6, justifyContent: 'center', minHeight: 64, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  typeLabel: { ...typography.label, color: colors.text },
  typeLabelSelected: { color: colors.ink },
  levelRow: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: 4, marginTop: spacing.sm, padding: 4 },
  level: { alignItems: 'center', borderRadius: radii.md - 4, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 6 },
  levelText: { ...typography.caption, color: colors.text, fontWeight: '600', textAlign: 'center' },
  textArea: { ...typography.body, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, marginTop: spacing.lg, minHeight: 96, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  counterRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: 6 },
  counter: { ...typography.caption, color: colors.textSecondary },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  sourceButton: { flexBasis: '46%', flexGrow: 1, minHeight: 48, paddingHorizontal: 10 },
  mediaButton: { flex: 1, minHeight: 48 },
  nearbyState: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  nearbyStateText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  nearbyList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  nearbyItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.md },
  nearbyItemDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  nearbyName: { ...typography.bodyStrong, color: colors.text },
  coordinateAction: { marginTop: spacing.sm },
  morePlacesButton: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 44 },
  morePlacesText: { ...typography.caption, color: colors.mint, fontWeight: '700' },
  proximityWarning: { alignItems: 'flex-start', backgroundColor: colors.errorSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  proximityWarningText: { ...typography.caption, color: colors.danger, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmented: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', padding: 4 },
  segment: { alignItems: 'center', borderRadius: radii.md - 4, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: colors.ink },
  targets: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  targetRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  targetDisabled: { opacity: 0.55 },
  targetDivider: { backgroundColor: colors.border, height: 1, marginLeft: spacing.md },
  targetLabel: { ...typography.bodyStrong, color: colors.text },
  checkBox: { alignItems: 'center', borderColor: colors.lineStrong, borderRadius: radii.sm, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkBoxOn: { backgroundColor: colors.flare, borderColor: colors.flare },
  friendsBox: { gap: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.md },
  friendSearch: { ...typography.body, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, minHeight: 44, paddingHorizontal: spacing.md },
  policySummary: { alignItems: 'flex-start', backgroundColor: colors.greenSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  policyText: { ...typography.caption, color: colors.mint, flex: 1 },
  safetyNotice: { alignItems: 'flex-start', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  safetyTitle: { ...typography.bodyStrong, color: colors.text },
  safetyAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  warningText: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  footer: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
