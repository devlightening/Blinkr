import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  CheckCircle2,
  Crosshair,
  LocateFixed,
  LogOut,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSignal, getNearbyPlaces, getPlace, getUnifiedMapBounds } from '../api';
import { colors, shadow } from '../theme';
import type {
  AuthResponse,
  BlinkrPlace,
  Bounds,
  ComposerArea,
  CoordinateSignal,
  CreateSignalInput,
  LocationReadiness,
} from '../types';
import { ISTANBUL_REGION } from '../types';
import { PostDetailSheet } from './PostDetailSheet';
import { SignalComposer } from './SignalComposer';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
};

const getBounds = (region: Region): Bounds => ({
  minLat: region.latitude - region.latitudeDelta / 2,
  maxLat: region.latitude + region.latitudeDelta / 2,
  minLng: region.longitude - region.longitudeDelta / 2,
  maxLng: region.longitude + region.longitudeDelta / 2,
});

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const REALTIME_PLACE_THRESHOLD_METERS = 200;
const NEARBY_PRIMARY_RADIUS_METERS = 350;
const NEARBY_EXTENDED_RADIUS_METERS = 900;
const MAX_NEARBY_LOCATION_AGE_MS = 30_000;
const LOCATION_TIMEOUT_MS = 8_000;

type NearbySource = 'DEVICE' | 'MAP_CENTER';

const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getStateColor = (place: BlinkrPlace) => {
  const freshness = place.currentState?.freshness;
  if (freshness === 'Stale') return '#707871';
  if (freshness === 'Expired') return '#A83E38';
  return colors.green;
};

export function MapScreen({ auth, onAuthChange, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const nearbyRequest = useRef<AbortController | null>(null);
  const mapRequestSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const nearbyRequestSeq = useRef(0);
  const submissionInFlight = useRef(false);
  const [region, setRegion] = useState<Region>(ISTANBUL_REGION);
  const [places, setPlaces] = useState<BlinkrPlace[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<BlinkrPlace[]>([]);
  const [signals, setSignals] = useState<CoordinateSignal[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<BlinkrPlace | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<BlinkrPlace | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<CoordinateSignal | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [locationReadiness, setLocationReadiness] = useState<LocationReadiness>('checking');
  const [canAskLocationAgain, setCanAskLocationAgain] = useState(true);
  const [mapDirty, setMapDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [composerArea, setComposerArea] = useState<ComposerArea | null>(null);

  const getFreshDeviceLocation = useCallback(async () => {
    setLocationReadiness('locating');
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Güncel konum alınamadı. Lütfen tekrar dene.')), LOCATION_TIMEOUT_MS)),
    ]);
    const ageMs = Date.now() - current.timestamp;
    if (ageMs > MAX_NEARBY_LOCATION_AGE_MS || (current.coords.accuracy ?? 9999) > 150) {
      const refreshed = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocationReadiness('ready');
      return refreshed;
    }
    setLocationReadiness('ready');
    return current;
  }, []);

  const loadNearbyPlaces = useCallback(async (
    targetRegion: Region,
    source: NearbySource,
    quality?: { accuracyMeters?: number | null; timestamp?: number | null },
  ) => {
    nearbyRequest.current?.abort();
    const controller = new AbortController();
    const requestId = nearbyRequestSeq.current + 1;
    nearbyRequestSeq.current = requestId;
    nearbyRequest.current = controller;
    setNearbyPlaces([]);
    console.log('[Blinkr NearbyRequest]', {
      id: requestId,
      source,
      locationAgeMs: quality?.timestamp ? Math.max(0, Date.now() - quality.timestamp) : null,
      accuracyMeters: typeof quality?.accuracyMeters === 'number' ? Math.round(quality.accuracyMeters) : null,
    });
    try {
      const items = await getNearbyPlaces(targetRegion.latitude, targetRegion.longitude, NEARBY_EXTENDED_RADIUS_METERS, controller.signal);
      const ranked = items
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        .map((item) => ({
          ...item,
          distanceMeters: Number.isFinite(item.distanceMeters) ? item.distanceMeters : distanceMeters(targetRegion, item),
        }))
        .filter((item) => Number.isFinite(item.distanceMeters) && (item.distanceMeters ?? -1) >= 0)
        .sort((a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY));
      if (nearbyRequest.current !== controller || nearbyRequestSeq.current !== requestId) {
        console.log('[Blinkr NearbyResult]', { id: requestId, status: 'stale-discarded' });
        return [];
      }
      const nearest = ranked[0]?.distanceMeters;
      console.log('[Blinkr NearbyResult]', {
        id: requestId,
        status: 'applied',
        primary: ranked.filter((item) => (item.distanceMeters ?? Number.POSITIVE_INFINITY) <= NEARBY_PRIMARY_RADIUS_METERS).length,
        extended: ranked.filter((item) => (item.distanceMeters ?? Number.POSITIVE_INFINITY) > NEARBY_PRIMARY_RADIUS_METERS).length,
        nearestMeters: typeof nearest === 'number' ? Math.round(nearest) : null,
      });
      setNearbyPlaces(ranked);
      return ranked;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Blinkr NearbyResult]', { id: requestId, status: 'stale-discarded' });
        return [];
      }
      setNearbyPlaces([]);
      setComposerError(err instanceof Error
        ? `Yakındaki yerler şu an yüklenemedi. ${err.message}`
        : 'Yakındaki yerler şu an yüklenemedi.');
      return [];
    }
  }, []);

  const loadPlaces = useCallback(async (targetRegion: Region, quiet = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    const requestId = mapRequestSeq.current + 1;
    mapRequestSeq.current = requestId;
    activeRequest.current = controller;
    if (!quiet) setIsLoading(true);
    setError(null);

    try {
      const map = await getUnifiedMapBounds(getBounds(targetRegion), controller.signal);
      if (activeRequest.current !== controller || mapRequestSeq.current !== requestId) return;
      setPlaces(map.places);
      setSignals(map.signals);
      setMapDirty(false);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Yerler alınamadı.');
    } finally {
      if (activeRequest.current === controller) setIsLoading(false);
    }
  }, []);

  const loadPlaceDetail = useCallback(async (place: BlinkrPlace, quiet = false) => {
    detailRequest.current?.abort();
    const controller = new AbortController();
    const requestId = detailRequestSeq.current + 1;
    detailRequestSeq.current = requestId;
    detailRequest.current = controller;
    setSelectedPlace(place);
    setSelectedDetail(place);
    if (!quiet) setIsDetailLoading(true);
    try {
      const detail = await getPlace(place.id, controller.signal);
      if (detailRequest.current !== controller || detailRequestSeq.current !== requestId) return;
      setSelectedDetail(detail);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Yer detayı alınamadı.');
    } finally {
      if (detailRequest.current === controller) setIsDetailLoading(false);
    }
  }, []);

  const openPlaceDetailAfterTouch = useCallback((place: BlinkrPlace) => {
    setSelectedSignal(null);
    InteractionManager.runAfterInteractions(() => {
      loadPlaceDetail(place);
    });
  }, [loadPlaceDetail]);

  const openSignalDetailAfterTouch = useCallback((signal: CoordinateSignal) => {
    InteractionManager.runAfterInteractions(() => {
      setSelectedPlace(null);
      setSelectedDetail(null);
      setSelectedSignal(signal);
    });
  }, []);

  const closeDetailSheet = useCallback(() => {
    detailRequest.current?.abort();
    detailRequestSeq.current += 1;
    setSelectedPlace(null);
    setSelectedDetail(null);
    setSelectedSignal(null);
    setIsDetailLoading(false);
  }, []);

  const moveToDeviceLocation = useCallback(async (requestPermission = true) => {
    const permission = requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    setCanAskLocationAgain(permission.canAskAgain);
    if (permission.status !== 'granted') {
      setLocationReadiness('permission-required');
      throw new Error('Haritada konumunu göstermek için konum izni gerekiyor.');
    }

    const position = await getFreshDeviceLocation();
    const target: Region = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
    setRegion(target);
    setLocationReadiness('ready');
    mapRef.current?.animateToRegion(target, 450);
    await loadPlaces(target);
    return {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationAccuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationLatitude: position.coords.latitude,
      observationLongitude: position.coords.longitude,
      region: target,
    };
  }, [getFreshDeviceLocation, loadPlaces]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        setCanAskLocationAgain(permission.canAskAgain);
        if (permission.status === 'granted') {
          await moveToDeviceLocation(false);
        } else {
          setLocationReadiness('permission-required');
          await loadPlaces(ISTANBUL_REGION);
        }
      })
      .catch(() => {
        setLocationReadiness('unavailable');
        return loadPlaces(ISTANBUL_REGION);
      });
    return () => {
      activeRequest.current?.abort();
      detailRequest.current?.abort();
      nearbyRequest.current?.abort();
    };
  }, [loadPlaces, moveToDeviceLocation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadPlaces(region, true);
    });
    return () => subscription.remove();
  }, [loadPlaces, region]);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = setTimeout(() => setSuccess(null), 5500);
    return () => clearTimeout(timeout);
  }, [success]);

  const resolveAreaName = useCallback(async (target: Region) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: target.latitude,
        longitude: target.longitude,
      });
      const primary = address?.district || address?.subregion || address?.city || address?.region;
      const secondary = address?.city && address.city !== primary ? address.city : address?.region;
      return [primary, secondary].filter(Boolean).join(', ') || 'Yaklaşık alan';
    } catch {
      return 'Yaklaşık alan';
    }
  }, []);

  const selectComposerArea = useCallback(async (source: 'device' | 'map', place?: BlinkrPlace | null) => {
    setComposerError(null);

    if (place) {
      const permission = await Location.getForegroundPermissionsAsync();
      let observationLatitude: number | null = null;
      let observationLongitude: number | null = null;
      let observationAccuracyMeters: number | null = null;
      let effectiveDistance = place.distanceMeters ?? null;

      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        observationLatitude = position.coords.latitude;
        observationLongitude = position.coords.longitude;
        observationAccuracyMeters = Math.max(1, position.coords.accuracy ?? 25);
        effectiveDistance = distanceMeters(
          { latitude: place.latitude, longitude: place.longitude },
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
        );
      }

      const accuracy = Math.min(observationAccuracyMeters ?? 0, 500);
      const trustedDistance = effectiveDistance == null ? null : Math.max(0, effectiveDistance - accuracy);
      setComposerArea({
        accuracyMeters: 25,
        name: place.name,
        observationAccuracyMeters,
        observationLatitude,
        observationLongitude,
        place,
        proximity: {
          allowed: trustedDistance != null && trustedDistance <= REALTIME_PLACE_THRESHOLD_METERS,
          distanceMeters: effectiveDistance,
          effectiveDistanceMeters: trustedDistance,
          thresholdMeters: REALTIME_PLACE_THRESHOLD_METERS,
        },
        region: {
          latitude: place.latitude,
          longitude: place.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        source: 'place',
      });
      setLocationReadiness('ready');
      return;
    }

    if (source === 'map') {
      if (region.latitudeDelta > 0.15 || region.longitudeDelta > 0.15) {
        throw new Error('Alan seçmek için haritayı biraz daha yakınlaştır.');
      }
      setComposerArea({
        accuracyMeters: Math.min(4999, Math.max(100, region.latitudeDelta * 27_750)),
        name: await resolveAreaName(region),
        observationAccuracyMeters: null,
        observationLatitude: null,
        observationLongitude: null,
        region,
        source,
      });
      setLocationReadiness('ready');
      await loadNearbyPlaces(region, 'MAP_CENTER');
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    setCanAskLocationAgain(permission.canAskAgain);
    if (permission.status !== 'granted') {
      setLocationReadiness('permission-required');
      throw new Error('Yakındaki yerleri görmek için konum izni gerekiyor.');
    }
    const position = await getFreshDeviceLocation();
    const target: Region = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
    setRegion(target);
    mapRef.current?.animateToRegion(target, 450);
    await loadPlaces(target, true);
    const location = {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationAccuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationLatitude: position.coords.latitude,
      observationLongitude: position.coords.longitude,
      region: target,
    };
    setComposerArea({ ...location, name: await resolveAreaName(location.region), source });
    await loadNearbyPlaces(location.region, 'DEVICE', { accuracyMeters: position.coords.accuracy, timestamp: position.timestamp });
  }, [getFreshDeviceLocation, loadNearbyPlaces, loadPlaces, region, resolveAreaName]);

  const openComposer = (place?: BlinkrPlace | null) => {
    setComposerError(null);
    setComposerOpen(true);
    if (place) {
      selectComposerArea('map', place).catch((err) => setComposerError(err.message));
      return;
    }

    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        setCanAskLocationAgain(permission.canAskAgain);
        if (permission.status !== 'granted') {
          setLocationReadiness('permission-required');
          return;
        }
        await selectComposerArea('device');
      })
      .catch(() => setLocationReadiness('unavailable'));
  };

  const submitSignal = async (
    input: Omit<CreateSignalInput, 'latitude' | 'longitude' | 'accuracyMeters' | 'locationName'>,
  ) => {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setIsCreating(true);
    setComposerError(null);
    try {
      if (!composerArea) throw new Error('Önce sinyalin ait olduğu yeri veya alanı seç.');
      const postId = await createSignal(auth, {
        ...input,
        accuracyMeters: composerArea.accuracyMeters,
        latitude: composerArea.region.latitude,
        longitude: composerArea.region.longitude,
        observationAccuracyMeters: composerArea.observationAccuracyMeters,
        observationLatitude: composerArea.observationLatitude,
        observationLongitude: composerArea.observationLongitude,
        proximityAllowed: composerArea.proximity?.allowed ?? null,
        proximityDistanceMeters: composerArea.proximity?.distanceMeters ?? null,
        locationName: composerArea.name,
      }, onAuthChange, onLogout);
      setLastPostId(postId);
      setComposerOpen(false);
      setSuccess('Sinyalin alındı. Yer detayına işleniyor...');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await wait(attempt === 0 ? 1200 : 1500);
        await loadPlaces(region, true);
        if (composerArea.place) await loadPlaceDetail(composerArea.place, true);
      }

      setSuccess('Sinyalin yayınlandı. Harita ve yer detayı yenilendi.');
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setComposerError(err instanceof Error ? err.message : 'Sinyal yayınlanamadı.');
    } finally {
      submissionInFlight.current = false;
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <MapView
        mapPadding={{ top: 130, right: 18, bottom: 150, left: 18 }}
        onPanDrag={() => setMapDirty(true)}
        onRegionChangeComplete={setRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        ref={mapRef}
        region={region}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest
        showsUserLocation
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
      >
        {places.map((place) => (
          <Marker
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            key={place.id}
            zIndex={selectedPlace?.id === place.id ? 30 : 10}
            onPress={() => {
              Haptics.selectionAsync();
              openPlaceDetailAfterTouch(place);
            }}
          >
            <View style={styles.markerShadow}>
              <View style={[styles.placeMarker, selectedPlace?.id === place.id && styles.markerSelected, { backgroundColor: getStateColor(place) }]}>
                <MapPin color={colors.white} fill={colors.white} size={18} strokeWidth={2.8} />
              </View>
              {(place.currentState?.activeSignalCount ?? 0) > 0 && <View style={styles.liveMarkerDot} />}
            </View>
          </Marker>
        ))}
        {signals.map((signal) => (
          <Marker
            coordinate={{ latitude: signal.latitude, longitude: signal.longitude }}
            key={signal.postId}
            zIndex={selectedSignal?.postId === signal.postId ? 40 : 20}
            onPress={() => {
              Haptics.selectionAsync();
              openSignalDetailAfterTouch(signal);
            }}
          >
            <View style={styles.markerShadow}>
              <View style={[styles.signalMarker, selectedSignal?.postId === signal.postId && styles.signalMarkerSelected]}>
                <Crosshair color={colors.white} size={16} strokeWidth={2.8} />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topOverlay}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <MapPin color={colors.ink} fill={colors.lime} size={20} strokeWidth={2.5} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>blinkr</Text>
            <View style={styles.liveStatus}>
              <View style={styles.liveDot} />
              <Text style={styles.liveStatusText}>Son 3 saat · {places.length} yer · {signals.length} sinyal</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Profili aç" onPress={() => setProfileOpen(true)} style={styles.avatar}>
            <Text style={styles.avatarText}>{auth.userName.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>

        {mapDirty && (
          <Pressable onPress={() => loadPlaces(region)} style={styles.searchAreaButton}>
            {isLoading ? <ActivityIndicator color={colors.white} size="small" /> : <RefreshCw color={colors.white} size={16} />}
            <Text style={styles.searchAreaText}>Bu alanı tara</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <View pointerEvents="box-none" style={[styles.mapActions, { bottom: insets.bottom + 94 }]}>
        {!mapDirty && isLoading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.green} size="small" />
            <Text style={styles.loadingText}>Yer sinyalleri aranıyor</Text>
          </View>
        )}
        <Pressable accessibilityLabel="Konumuma git" onPress={() => moveToDeviceLocation(true).catch((err) => setError(err.message))} style={styles.locateButton}>
          <LocateFixed color={colors.ink} size={22} strokeWidth={2.3} />
        </Pressable>
      </View>

      {(success || error) && (
        <View style={[styles.toast, error ? styles.errorToast : styles.successToast, { top: insets.top + 86 }]}>
          {error ? <Wifi color={colors.error} size={18} /> : <Crosshair color={colors.greenDark} size={18} />}
          <Text style={[styles.toastText, error && styles.errorToastText]} numberOfLines={3}>
            {error || success}
          </Text>
          <Pressable accessibilityLabel="Bildirimi kapat" hitSlop={8} onPress={() => { setError(null); setSuccess(null); }}>
            <X color={error ? colors.error : colors.greenDark} size={18} />
          </Pressable>
        </View>
      )}

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.navItem}>
          <MapIcon color={colors.green} fill={colors.greenSoft} size={22} strokeWidth={2.5} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Harita</Text>
        </Pressable>
        <Pressable accessibilityLabel="Yeni sinyal oluştur" onPress={() => openComposer(selectedPlace)} style={styles.createButton}>
          <Plus color={colors.ink} size={26} strokeWidth={3} />
        </Pressable>
        <Pressable onPress={() => setProfileOpen(true)} style={styles.navItem}>
          <UserRound color={colors.muted} size={22} strokeWidth={2.3} />
          <Text style={styles.navLabel}>Profil</Text>
        </Pressable>
      </View>

      <SignalComposer
        area={composerArea}
        auth={auth}
        canAskLocationAgain={canAskLocationAgain}
        error={composerError}
        isSubmitting={isCreating}
        locationReadiness={locationReadiness}
        nearbyPlaces={nearbyPlaces}
        onAuthChange={onAuthChange}
        onClearError={() => setComposerError(null)}
        onClose={() => {
          if (!isCreating) setComposerOpen(false);
        }}
        onOpenSettings={() => {
          Linking.openSettings().catch(() => setComposerError('Cihaz ayarları açılamadı.'));
        }}
        onSelectArea={selectComposerArea}
        onSessionExpired={onLogout}
        onSubmit={submitSignal}
        visible={isComposerOpen}
      />
      <PostDetailSheet
        isLoading={isDetailLoading}
        onClose={closeDetailSheet}
        onCreateSignal={() => openComposer(selectedDetail ?? selectedPlace)}
        place={selectedDetail ?? selectedPlace}
        signal={selectedSignal}
      />

      <Modal animationType="fade" onRequestClose={() => setProfileOpen(false)} transparent visible={isProfileOpen}>
        <Pressable onPress={() => setProfileOpen(false)} style={styles.profileScrim}>
          <Pressable onPress={() => undefined} style={[styles.profilePanel, { paddingTop: insets.top + 20 }]}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileEyebrow}>HESABIN</Text>
              <Pressable accessibilityLabel="Profili kapat" onPress={() => setProfileOpen(false)} style={styles.profileClose}>
                <X color={colors.ink} size={20} />
              </Pressable>
            </View>
            <View style={styles.profileIdentity}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{auth.userName.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.profileIdentityCopy}>
                <Text numberOfLines={1} style={styles.profileName}>{auth.userName}</Text>
                <Text numberOfLines={1} style={styles.profileEmail}>{auth.email}</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.profileRow}>
                <View style={[styles.profileRowIcon, styles.connectionIcon]}>
                  <CheckCircle2 color={colors.green} size={19} />
                </View>
                <View style={styles.profileRowCopy}>
                  <Text style={styles.profileRowTitle}>Gateway bağlantısı</Text>
                  <Text style={styles.profileRowText}>Mobil istemci yalnız Gateway üzerinden çalışıyor</Text>
                </View>
              </View>
              <View style={styles.profileDivider} />
              <View style={styles.profileRow}>
                <View style={styles.profileRowIcon}>
                  <ShieldCheck color={colors.greenDark} size={19} />
                </View>
                <View style={styles.profileRowCopy}>
                  <Text style={styles.profileRowTitle}>Yer kararı odağı</Text>
                  <Text style={styles.profileRowText}>Paylaşımlar bir yer hakkında güncel karar vermeyi destekler</Text>
                </View>
              </View>
            </View>

            {lastPostId && (
              <View style={styles.lastSignal}>
                <MapPin color={colors.coral} size={19} />
                <View style={styles.profileRowCopy}>
                  <Text style={styles.profileRowTitle}>Son sinyalin</Text>
                  <Text style={styles.lastSignalText}>{lastPostId}</Text>
                </View>
              </View>
            )}
            <Pressable onPress={onLogout} style={styles.logoutButton}>
              <LogOut color={colors.error} size={19} />
              <Text style={styles.logoutText}>Oturumu kapat</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#D9E0DA', flex: 1 },
  topOverlay: { left: 0, paddingHorizontal: 14, position: 'absolute', right: 0, top: 0 },
  topBar: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8, flexDirection: 'row', marginTop: 8, padding: 10, ...shadow },
  brandMark: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  brandCopy: { flex: 1, marginLeft: 10 },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  liveStatus: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  liveDot: { backgroundColor: colors.coral, borderRadius: 4, height: 7, width: 7 },
  liveStatusText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  avatar: { alignItems: 'center', backgroundColor: colors.greenSoft, borderColor: '#C9DDD0', borderRadius: 8, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { color: colors.greenDark, fontSize: 15, fontWeight: '900' },
  searchAreaButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.greenDark, borderRadius: 8, flexDirection: 'row', gap: 8, marginTop: 10, minHeight: 42, paddingHorizontal: 16, ...shadow },
  searchAreaText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  mapActions: { alignItems: 'flex-end', left: 14, position: 'absolute', right: 14 },
  locateButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, height: 48, justifyContent: 'center', width: 48, ...shadow },
  loadingBadge: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8, flexDirection: 'row', gap: 8, marginBottom: -42, minHeight: 40, paddingHorizontal: 13, ...shadow },
  loadingText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  markerShadow: { ...shadow },
  placeMarker: { alignItems: 'center', borderColor: colors.white, borderRadius: 8, borderWidth: 3, height: 38, justifyContent: 'center', width: 38 },
  markerSelected: { borderColor: colors.lime, borderWidth: 4 },
  liveMarkerDot: { backgroundColor: colors.lime, borderColor: colors.white, borderRadius: 5, borderWidth: 2, height: 10, position: 'absolute', right: -2, top: -2, width: 10 },
  signalMarker: { alignItems: 'center', backgroundColor: colors.coral, borderColor: colors.white, borderRadius: 18, borderWidth: 2.5, height: 36, justifyContent: 'center', width: 36 },
  signalMarkerSelected: { borderColor: colors.lime, borderWidth: 4 },
  toast: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 9, left: 18, paddingHorizontal: 13, paddingVertical: 11, position: 'absolute', right: 18, ...shadow },
  successToast: { backgroundColor: '#E8F5EC' },
  errorToast: { backgroundColor: colors.errorSoft },
  toastText: { color: colors.greenDark, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  errorToastText: { color: colors.error },
  bottomNav: { alignItems: 'flex-start', backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, paddingTop: 10, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', minHeight: 50, minWidth: 76 },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 4 },
  navLabelActive: { color: colors.greenDark },
  createButton: { alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.surface, borderRadius: 8, borderWidth: 4, height: 58, justifyContent: 'center', marginTop: -28, width: 58, ...shadow },
  profileScrim: { backgroundColor: colors.scrim, flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  profilePanel: { backgroundColor: colors.surface, height: '100%', paddingHorizontal: 20, width: '84%', ...shadow },
  profileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileEyebrow: { color: colors.green, fontSize: 11, fontWeight: '900' },
  profileClose: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 40, justifyContent: 'center', width: 40 },
  profileIdentity: { alignItems: 'center', flexDirection: 'row', marginTop: 24 },
  profileIdentityCopy: { flex: 1, marginLeft: 13 },
  profileAvatar: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, height: 58, justifyContent: 'center', width: 58 },
  profileAvatarText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  profileName: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  profileEmail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  profileSection: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginTop: 28, paddingHorizontal: 14 },
  profileRow: { alignItems: 'flex-start', flexDirection: 'row', paddingVertical: 14 },
  profileRowIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 36, justifyContent: 'center', marginRight: 11, width: 36 },
  connectionIcon: { backgroundColor: '#E7F4EA' },
  profileRowCopy: { flex: 1 },
  profileRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  profileRowText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  profileDivider: { backgroundColor: colors.line, height: 1 },
  lastSignal: { alignItems: 'center', backgroundColor: '#FFF2EC', borderRadius: 8, flexDirection: 'row', gap: 11, marginTop: 12, padding: 13 },
  lastSignalText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  logoutButton: { alignItems: 'center', borderColor: '#F0D0CD', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 'auto', marginBottom: 28, minHeight: 50, paddingHorizontal: 14 },
  logoutText: { color: colors.error, fontSize: 14, fontWeight: '900' },
});
