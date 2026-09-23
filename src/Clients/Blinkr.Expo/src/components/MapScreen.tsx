import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CheckCircle2, Plus, Wifi, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  InteractionManager,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n from 'i18next';
import { createSignal, getNearbyPlaces, getPlace, getUnifiedMapBounds, previewPresence, getSignalContent, sendReport, sendSnap, startConversation } from '../api';
import { COMPOSER_SNAP_SECONDS, summarizeSend } from '../snapPresentation';
import { friendlyError } from '../productPresentation';
import { BlinkrMapMarker, BlinkrClusterMarker } from './BlinkrMapMarker';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { MapTopChrome } from './map/MapTopChrome';
import { MapSearchOverlay } from './map/MapSearchOverlay';
import { UserProfileSheet } from './friends/UserProfileSheet';
import { selectMapData, filterBySignalTypes, type MapLayer } from '../mapSelection';
import { loadTypeFilter, saveTypeFilter } from '../mapTypeFilterStorage';
import { MapTypeFilterBar } from './map/MapTypeFilterBar';
import { clusterMapPoints, zoomToLongitudeDelta } from '../mapClusters';
import {
  NearbyRequestOwnership,
  type NearbyOrigin,
  type NearbyReason,
  type NearbySource,
  distanceMeters,
} from '../nearbyRequestOwnership';
import { colors, motion, radii, shadow, shadowSoft } from '../theme';
import { mapDarkStyle } from '../mapDarkStyle';
import { AnimatedPressable } from './AnimatedPressable';
import type {
  AuthResponse,
  BlinkrPlace,
  Bounds,
  ComposerArea,
  CoordinateSignal,
  CreateSignalInput,
  LocationReadiness,
  NearbyStatus,
  ShareMode,
  SignalType,
  UserSummary,
} from '../types';
import { ISTANBUL_REGION } from '../types';
import { PostDetailSheet } from './PostDetailSheet';
import { SignalCamera } from './camera/SignalCamera';
import type { CapturedMedia } from './camera/PhotoEditor';
import { SignalComposer, type ComposerExtras } from './SignalComposer';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  /** Set when (+) was pressed on any tab: `camera` (tap) or `text` (long press); cleared through `onShareHandled`. */
  shareRequested?: ShareMode | null;
  onShareHandled?: () => void;
  /** A saved Place to bring into view and open; cleared through `onFocusHandled`. */
  focusPlace?: BlinkrPlace | null;
  onFocusHandled?: () => void;
  /** A coordinate signal (from the Yakında list) to bring into view and open; cleared through `onFocusSignalHandled`. */
  focusSignal?: CoordinateSignal | null;
  onFocusSignalHandled?: () => void;
  /** Reports whether a sheet or the composer currently owns the screen (the app shell hides its tab bar). */
  onOverlayOpenChange?: (open: boolean) => void;
  /** "Kişiler" search result → "Mesaj gönder" (P3.13): the app shell switches to the Sohbet tab. */
  onMessageUser?: (user: UserSummary) => void;
};

const getBounds = (region: Region): Bounds => ({
  minLat: region.latitude - region.latitudeDelta / 2,
  maxLat: region.latitude + region.latitudeDelta / 2,
  minLng: region.longitude - region.longitudeDelta / 2,
  maxLng: region.longitude + region.longitudeDelta / 2,
});

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const NEARBY_PRIMARY_RADIUS_METERS = 600;
const NEARBY_EXTENDED_RADIUS_METERS = 1500;
const MAX_NEARBY_LOCATION_AGE_MS = 30_000;
const LOCATION_TIMEOUT_MS = 8_000;


export function MapScreen({ auth, onAuthChange, onLogout, onOpenProfile, shareRequested = null, onShareHandled, focusPlace = null, onFocusHandled, focusSignal = null, onFocusSignalHandled, onOverlayOpenChange, onMessageUser }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const nearbyRequest = useRef<AbortController | null>(null);
  const nearbyOwner = useRef(new NearbyRequestOwnership());
  const nearbyLoadingRequest = useRef<number | null>(null);
  const mapRequestSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const submissionInFlight = useRef(false);
  const composerGeneration = useRef(0);
  const overlayGeneration = useRef(0);
  const catalogLayerLoaded = useRef(false);
  const currentRegion = useRef<Region>(ISTANBUL_REGION);
  const deviceSnapshot = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const ignoreRegionChangeUntil = useRef(0);
  const [region, setRegion] = useState<Region>(ISTANBUL_REGION);
  const [places, setPlaces] = useState<BlinkrPlace[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<BlinkrPlace[]>([]);
  const [nearbyCoverageState, setNearbyCoverageState] = useState<string | null>(null);
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('EMPTY');
  const [signals, setSignals] = useState<CoordinateSignal[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<BlinkrPlace | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<BlinkrPlace | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<CoordinateSignal | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [locationReadiness, setLocationReadiness] = useState<LocationReadiness>('checking');
  const [canAskLocationAgain, setCanAskLocationAgain] = useState(true);
  const [mapDirty, setMapDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [composerArea, setComposerArea] = useState<ComposerArea | null>(null);
  const [pendingCapture, setPendingCapture] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchProfileUser, setSearchProfileUser] = useState<UserSummary | null>(null);
  const [searchOrigin, setSearchOrigin] = useState({ latitude: 0, longitude: 0 });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [composerInitialStep, setComposerInitialStep] = useState(0);
  const [composerInitialSignal, setComposerInitialSignal] = useState<{ type: SignalType; value: string | null } | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<Set<SignalType>>(new Set());
  useEffect(() => { loadTypeFilter().then(setActiveTypeFilter); }, []);
  const toggleTypeFilter = useCallback((type: SignalType) => {
    setActiveTypeFilter((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type); else next.add(type);
      void saveTypeFilter(next);
      return next;
    });
  }, []);
  // moveToDeviceLocation must not depend on the layer: the mount effect below depends on it, and a
  // changing dependency re-ran that effect (permission check + recentre) on every filter change.
  const mapLayerRef = useRef<MapLayer>('all');
  mapLayerRef.current = mapLayer;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const { places: visiblePlaces, signals: visibleSignals } = useMemo(
    () => filterBySignalTypes(mapLayer, selectMapData(mapLayer, places, signals, now), activeTypeFilter),
    [mapLayer, places, signals, now, activeTypeFilter],
  );

  const markerLookup = useMemo(() => ({
    places: new Map(visiblePlaces.map((place) => [`place:${place.id}`, place])),
    signals: new Map(visibleSignals.map((signal) => [`signal:${signal.postId}`, signal])),
  }), [visiblePlaces, visibleSignals]);

  const mapItems = useMemo(() => clusterMapPoints([
    ...visiblePlaces.map((place) => ({
      id: `place:${place.id}`,
      kind: 'place' as const,
      latitude: place.latitude,
      longitude: place.longitude,
    })),
    ...visibleSignals.map((signal) => ({
      id: `signal:${signal.postId}`,
      kind: 'signal' as const,
      latitude: signal.latitude,
      longitude: signal.longitude,
    })),
  ], region), [region, visiblePlaces, visibleSignals]);

  const visibleItemCount = visiblePlaces.length + visibleSignals.length;

  const getFreshDeviceLocation = useCallback(async () => {
    setLocationReadiness('locating');
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Güncel konum alınamadı. Lütfen tekrar dene.')), LOCATION_TIMEOUT_MS)),
    ]);
    const ageMs = Date.now() - current.timestamp;
    if (ageMs > MAX_NEARBY_LOCATION_AGE_MS || (current.coords.accuracy ?? 9999) > 150) {
      const refreshed = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Güncel konum alınamadı. Tekrar dene.')), LOCATION_TIMEOUT_MS)),
      ]);
      if (Date.now() - refreshed.timestamp > MAX_NEARBY_LOCATION_AGE_MS || (refreshed.coords.accuracy ?? 9999) > 150)
        throw new Error('Konum yeterince net değil. Açık bir alanda tekrar dene.');
      setLocationReadiness('ready');
      deviceSnapshot.current = { latitude: refreshed.coords.latitude, longitude: refreshed.coords.longitude, timestamp: refreshed.timestamp };
      return refreshed;
    }
    setLocationReadiness('ready');
    deviceSnapshot.current = { latitude: current.coords.latitude, longitude: current.coords.longitude, timestamp: current.timestamp };
    return current;
  }, []);

  const loadNearbyPlaces = useCallback(async (
    targetRegion: Region,
    source: NearbySource,
    reason: NearbyReason,
    quality?: { accuracyMeters?: number | null; timestamp?: number | null },
  ) => {
    const origin: NearbyOrigin = {
      accuracyMeters: quality?.accuracyMeters ?? null,
      latitude: targetRegion.latitude,
      longitude: targetRegion.longitude,
      source,
      timestamp: quality?.timestamp ?? null,
    };
    const decision = nearbyOwner.current.begin(origin, reason);
    if (decision.status !== 'start') return nearbyPlaces;

    if (decision.shouldAbortActive) nearbyRequest.current?.abort();
    const controller = new AbortController();
    const requestId = decision.requestId;
    nearbyRequest.current = controller;
    nearbyLoadingRequest.current = requestId;
    setNearbyStatus('LOADING');
    console.log('[Blinkr NearbyRequest]', {
      id: requestId,
      reason,
      source,
      accuracyMeters: typeof quality?.accuracyMeters === 'number' ? Math.round(quality.accuracyMeters) : null,
    });
    try {
      const items = await getNearbyPlaces(targetRegion.latitude, targetRegion.longitude, NEARBY_EXTENDED_RADIUS_METERS, controller.signal);
      const coverageState = items.coverageState;
      const ranked = items
        .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        .map((item) => ({
          ...item,
          distanceMeters: Number.isFinite(item.distanceMeters) ? item.distanceMeters : distanceMeters(targetRegion, item),
        }))
        .filter((item) => Number.isFinite(item.distanceMeters) && (item.distanceMeters ?? -1) >= 0)
        .sort((a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY));
      if (nearbyRequest.current !== controller || !nearbyOwner.current.isActive(requestId)) {
        console.log('[Blinkr NearbyResult]', { id: requestId, status: 'stale-discarded', primary: 0, extended: 0, nearestMeters: null });
        return [];
      }
      nearbyOwner.current.apply(requestId);
      setNearbyCoverageState(coverageState);
      setNearbyStatus(coverageState === 'not_loaded' ? 'NOT_LOADED' : ranked.length > 0 ? 'READY' : 'EMPTY');
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
      if (nearbyRequest.current !== controller || !nearbyOwner.current.isActive(requestId)) return [];
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Blinkr NearbyResult]', { id: requestId, status: 'stale-discarded', primary: 0, extended: 0, nearestMeters: null });
        return [];
      }
      nearbyOwner.current.fail(requestId);
      setNearbyStatus('FAILED');
      console.log('[Blinkr NearbyResult]', {
        id: requestId,
        status: 'failed',
        primary: 0,
        extended: 0,
        nearestMeters: null,
        reason: err instanceof Error ? err.message : String(err),
      });
      setComposerError('Yakındaki yerler şu an yenilenemedi. Tekrar dene.');
      return [];
    } finally {
      if (nearbyLoadingRequest.current === requestId) {
        nearbyLoadingRequest.current = null;
        setNearbyStatus((current) => current === 'LOADING' ? 'EMPTY' : current);
      }
    }
  }, [nearbyPlaces]);

  const loadPlaces = useCallback(async (targetRegion: Region, quiet = false, includeCatalogPlaces = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    const requestId = mapRequestSeq.current + 1;
    mapRequestSeq.current = requestId;
    activeRequest.current = controller;
    if (!quiet) setIsLoading(true);
    setError(null);

    try {
      const map = await getUnifiedMapBounds(getBounds(targetRegion), controller.signal, includeCatalogPlaces);
      if (activeRequest.current !== controller || mapRequestSeq.current !== requestId) return;
      setPlaces(map.places);
      setSignals(map.signals);
      setMapDirty(distanceMeters(currentRegion.current, targetRegion) > 40 || Math.abs(currentRegion.current.longitudeDelta - targetRegion.longitudeDelta) > 0.002);
      return map;
    } catch (err) {
      if (activeRequest.current !== controller) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(friendlyError(err));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  const scanVisibleArea = useCallback(async () => {
    await loadPlaces(region, false, mapLayer === 'places');
  }, [loadPlaces, mapLayer, region]);

  const handleRegionChangeComplete = useCallback((nextRegion: Region) => {
    const moved = distanceMeters(currentRegion.current, nextRegion) > 40 || Math.abs(currentRegion.current.longitudeDelta - nextRegion.longitudeDelta) > 0.002;
    currentRegion.current = nextRegion;
    setRegion(nextRegion);
    if (moved && Date.now() > ignoreRegionChangeUntil.current) setMapDirty(true);
  }, []);

  // Auto-load the viewport once it settles (sinyal-mvp-plan 04 §1.2: "Bu alanı tara" is no longer a
  // required tap). Debounced so a long pan/zoom gesture does not fire a request per intermediate
  // frame; only a genuinely settled, moved viewport (mapDirty) triggers it, and a request already in
  // flight is left alone rather than piled on top of.
  useEffect(() => {
    if (!mapDirty || isLoading) return undefined;
    const timer = setTimeout(() => { void loadPlaces(region, true, mapLayer === 'places'); }, 400);
    return () => clearTimeout(timer);
  }, [mapDirty, isLoading, region, mapLayer, loadPlaces]);

  const expandCluster = useCallback((item: { latitude: number; longitude: number; expansionZoom: number }) => {
    const longitudeDelta = zoomToLongitudeDelta(item.expansionZoom);
    const target: Region = {
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: Math.max(0.0015, longitudeDelta * 0.72),
      longitudeDelta,
    };
    ignoreRegionChangeUntil.current = Date.now() + 900;
    currentRegion.current = target;
    setRegion(target);
    mapRef.current?.animateToRegion(target, 420);
    void loadPlaces(target, true, mapLayer === 'places');
    Haptics.selectionAsync();
  }, [loadPlaces, mapLayer]);

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
      const origin = deviceSnapshot.current;
      setSelectedDetail({ ...detail, distanceMeters: origin && Date.now() - origin.timestamp < MAX_NEARBY_LOCATION_AGE_MS ? distanceMeters(origin, detail) : place.distanceMeters });
    } catch (err) {
      if (detailRequest.current !== controller) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(friendlyError(err));
    } finally {
      if (detailRequest.current === controller) setIsDetailLoading(false);
    }
  }, []);

  const openPlaceDetailAfterTouch = useCallback((place: BlinkrPlace) => {
    const generation = ++overlayGeneration.current;
    InteractionManager.runAfterInteractions(() => {
      if (overlayGeneration.current !== generation) return;
      setSelectedSignal(null);
      loadPlaceDetail(place);
    });
  }, [loadPlaceDetail]);

  const openSignalDetailAfterTouch = useCallback((signal: CoordinateSignal) => {
    const generation = ++overlayGeneration.current;
    detailRequest.current?.abort();
    detailRequestSeq.current += 1;
    InteractionManager.runAfterInteractions(() => {
      if (overlayGeneration.current !== generation) return;
      setIsDetailLoading(false);
      setSelectedPlace(null);
      setSelectedDetail(null);
      setSelectedSignal(signal);
      const controller = new AbortController();
      detailRequest.current = controller;
      setIsDetailLoading(true);
      getSignalContent(signal.postId, controller.signal).then(content => {
        if (detailRequest.current === controller && overlayGeneration.current === generation)
          setSelectedSignal({ ...signal, ...content });
      }).catch(err => {
        if (detailRequest.current === controller && !controller.signal.aborted) setError(friendlyError(err));
      }).finally(() => {
        if (detailRequest.current === controller) setIsDetailLoading(false);
      });
    });
  }, []);

  const closeDetailSheet = useCallback(() => {
    overlayGeneration.current += 1;
    detailRequest.current?.abort();
    detailRequestSeq.current += 1;
    setSelectedPlace(null);
    setSelectedDetail(null);
    setSelectedSignal(null);
    setIsDetailLoading(false);
  }, []);

  const closeComposer = useCallback(() => {
    if (isCreating) return;
    composerGeneration.current += 1;
    nearbyRequest.current?.abort();
    nearbyOwner.current.reset();
    nearbyLoadingRequest.current = null;
    setNearbyCoverageState(null);
    setNearbyStatus('EMPTY');
    setComposerOpen(false);
    setComposerArea(null);
    setPendingCapture(null);
    setComposerInitialStep(0);
  }, [isCreating]);

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
    currentRegion.current = target;
    setRegion(target);
    setLocationReadiness('ready');
    ignoreRegionChangeUntil.current = Date.now() + 900;
    mapRef.current?.animateToRegion(target, 450);
    await loadPlaces(target, false, mapLayerRef.current === 'places');
    return {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationAccuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationLatitude: position.coords.latitude,
      observationLongitude: position.coords.longitude,
      region: target,
    };
  }, [getFreshDeviceLocation, loadPlaces]);

  useEffect(() => {
    // A saved Place opened from the profile brings its own viewport; do not recentre on the device.
    if (focusPlace) return undefined;
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
      nearbyOwner.current.reset();
      nearbyLoadingRequest.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPlaces, moveToDeviceLocation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadPlaces(region, true, mapLayer === 'places');
    });
    return () => subscription.remove();
  }, [loadPlaces, mapLayer, region]);

  useEffect(() => {
    if (mapLayer !== 'places') {
      catalogLayerLoaded.current = false;
      return;
    }
    if (catalogLayerLoaded.current) return;
    catalogLayerLoaded.current = true;
    void loadPlaces(currentRegion.current, true, true);
  }, [loadPlaces, mapLayer]);

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

  const selectComposerArea = useCallback(async (
    source: 'device' | 'map',
    place?: BlinkrPlace | null,
    reason: NearbyReason = 'MANUAL_REFRESH',
  ) => {
    const generation = ++composerGeneration.current;
    setComposerError(null);

    if (place) {
      const permission = await Location.requestForegroundPermissionsAsync();
      let observationLatitude: number | null = null;
      let observationLongitude: number | null = null;
      let observationAccuracyMeters: number | null = null;
      let effectiveDistance = place.distanceMeters ?? null;

      if (permission.status === 'granted') {
        const position = await getFreshDeviceLocation();
        observationLatitude = position.coords.latitude;
        observationLongitude = position.coords.longitude;
        observationAccuracyMeters = Math.max(1, position.coords.accuracy ?? 25);
        effectiveDistance = distanceMeters(
          { latitude: place.latitude, longitude: place.longitude },
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
        );
      }

      const presence = observationLatitude != null && observationLongitude != null && observationAccuracyMeters != null
        ? await previewPresence(auth, { placeId: place.id, latitude: observationLatitude, longitude: observationLongitude, accuracyMeters: observationAccuracyMeters }, onAuthChange, onLogout)
        : null;
      if (generation !== composerGeneration.current) return;
      console.log('[Blinkr PlaceSelect]', {
        placeId: place.id,
        distanceMeters: effectiveDistance == null ? null : Math.round(effectiveDistance),
        source: 'DEVICE',
      });
      setComposerArea({
        accuracyMeters: 25,
        name: place.name,
        observationAccuracyMeters,
        observationLatitude,
        observationLongitude,
        place,
        proximity: {
          allowed: presence?.isAllowed ?? false,
          trustLevel: presence?.trustLevel,
          distanceMeters: presence?.distanceMeters,
          effectiveDistanceMeters: presence?.effectiveDistanceMeters,
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
      const name = await resolveAreaName(region);
      if (generation !== composerGeneration.current) return;
      setComposerArea({
        accuracyMeters: Math.min(4999, Math.max(100, region.latitudeDelta * 27_750)),
        name,
        observationAccuracyMeters: null,
        observationLatitude: null,
        observationLongitude: null,
        region,
        source,
      });
      setLocationReadiness('ready');
      void loadNearbyPlaces(region, 'MAP_CENTER', source === 'map' ? reason : 'SOURCE_CHANGE');
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    setCanAskLocationAgain(permission.canAskAgain);
    if (permission.status !== 'granted') {
      setLocationReadiness('permission-required');
      throw new Error('Yakındaki yerleri görmek için konum izni gerekiyor.');
    }
    const position = await getFreshDeviceLocation();
    if (generation !== composerGeneration.current) return;
    const target: Region = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
    currentRegion.current = target;
    setRegion(target);
    ignoreRegionChangeUntil.current = Date.now() + 900;
    mapRef.current?.animateToRegion(target, 450);
    const location = {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationAccuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationLatitude: position.coords.latitude,
      observationLongitude: position.coords.longitude,
      region: target,
    };
    setComposerArea({ ...location, name: 'Yaklaşık alan', source });
    void loadNearbyPlaces(location.region, 'DEVICE', reason, { accuracyMeters: position.coords.accuracy, timestamp: position.timestamp });
    const name = await resolveAreaName(location.region);
    if (generation === composerGeneration.current) setComposerArea({ ...location, name, source });
  }, [auth, onAuthChange, onLogout, getFreshDeviceLocation, loadNearbyPlaces, region, resolveAreaName]);

  const openComposer = (place?: BlinkrPlace | null, initialStep = 0, initialSignal: { type: SignalType; value: string | null } | null = null) => {
    const opening = ++composerGeneration.current;
    closeDetailSheet();
    setComposerArea(null);
    setComposerInitialStep(initialStep);
    setComposerInitialSignal(initialSignal);
    nearbyOwner.current.reset();
    setComposerError(null);
    setComposerOpen(true);
    if (place) {
      selectComposerArea('map', place, 'COMPOSER_OPEN').catch((err) => setComposerError(friendlyError(err)));
      return;
    }

    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (composerGeneration.current !== opening) return;
        setCanAskLocationAgain(permission.canAskAgain);
        if (permission.status !== 'granted') {
          setLocationReadiness('permission-required');
          return;
        }
        await selectComposerArea('device', null, 'COMPOSER_OPEN');
      })
      .catch(() => setLocationReadiness('unavailable'));
  };

  // (+) tap: camera (own UI with lenses and a gallery button); long press: a signal without media. Both end in the same composer.
  const startCamera = () => {
    setCameraOpen(true);
  };

  const handleCaptured = (asset: CapturedMedia) => {
    setCameraOpen(false);
    setPendingCapture(asset);
    if (!isComposerOpen) openComposer(selectedPlace, 1, asset.signalHint ?? null);
  };

  const startSignalOnly = () => {
    openComposer(selectedPlace, 0);
  };

  // P5.9: the published photo also goes to the chosen friends as a snap, one conversation at a time. It runs after
  // the signal is safely published; a failed snap never undoes the signal, it is only reported.
  const sendComposerSnaps = async (extras: ComposerExtras) => {
    if (!extras.snapAsset || extras.snapFriendIds.length === 0) return;
    const results: Array<{ conversationId: string; ok: boolean }> = [];
    for (const friendId of extras.snapFriendIds) {
      try {
        const conversation = await startConversation(auth, friendId, onAuthChange, onLogout);
        await sendSnap(auth, conversation.id, extras.snapAsset, { durationSeconds: COMPOSER_SNAP_SECONDS }, onAuthChange, onLogout);
        results.push({ conversationId: friendId, ok: true });
      } catch (err) {
        console.log('[Blinkr Snap]', { failedStage: 'composer-send', errorCode: err instanceof Error ? err.name : 'Unknown' });
        results.push({ conversationId: friendId, ok: false });
      }
    }
    const summary = summarizeSend(results);
    setSuccess(summary.allSent
      ? i18n.t('create:snap.sentAll', { count: summary.sent })
      : i18n.t('create:snap.sentSome', { sent: summary.sent, failed: summary.failed.length }));
  };

  const submitSignal = async (
    input: Omit<CreateSignalInput, 'latitude' | 'longitude' | 'accuracyMeters' | 'locationName'>,
    extras?: ComposerExtras,
  ) => {
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setIsCreating(true);
    setComposerError(null);
    try {
      if (!composerArea) throw new Error('Önce sinyalin ait olduğu yeri veya alanı seç.');
      const position = composerArea.place ? await getFreshDeviceLocation() : null;
      const postId = await createSignal(auth, {
        ...input,
        accuracyMeters: composerArea.accuracyMeters,
        latitude: composerArea.region.latitude,
        longitude: composerArea.region.longitude,
        observationAccuracyMeters: position?.coords.accuracy ?? composerArea.observationAccuracyMeters,
        observationLatitude: position?.coords.latitude ?? composerArea.observationLatitude,
        observationLongitude: position?.coords.longitude ?? composerArea.observationLongitude,
        proximityAllowed: composerArea.proximity?.allowed ?? null,
        proximityDistanceMeters: composerArea.proximity?.distanceMeters ?? null,
        locationName: composerArea.name,
      }, onAuthChange, onLogout);
      setComposerOpen(false);
      composerGeneration.current += 1;
      nearbyRequest.current?.abort();
      nearbyOwner.current.reset();
      setSuccess('Yayınlandı. Haritaya ekleniyor.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (extras) void sendComposerSnaps(extras);

      const target = { ...composerArea.region, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      currentRegion.current = target;
      setRegion(target);
      mapRef.current?.animateToRegion(target, 350);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await wait(1200);
        const map = await loadPlaces(currentRegion.current, true, mapLayer === 'places');
        if (map?.signals.some(s => s.postId === postId) || map?.places.some(p => p.id === composerArea.place?.id)) break;
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setComposerError(friendlyError(err, 'Paylaşım tamamlanamadı. Tekrar dene.'));
    } finally {
      submissionInFlight.current = false;
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!shareRequested) return;
    const mode = shareRequested;
    onShareHandled?.();
    if (isCreating) return;
    if (mode === 'text') startSignalOnly();
    else startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareRequested]);

  // "Nereye gidiyorsun?" results: fly to the Place and open its detail, or just move the map to an address.
  const flyToPlace = useCallback((place: BlinkrPlace) => {
    const target: Region = { latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setSearchOpen(false);
    currentRegion.current = target;
    setRegion(target);
    ignoreRegionChangeUntil.current = Date.now() + 1200;
    setTimeout(() => mapRef.current?.animateToRegion(target, 450), 250);
    void loadPlaces(target, true, mapLayerRef.current === 'places');
    openPlaceDetailAfterTouch(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPlaceDetailAfterTouch]);

  const flyToLocation = useCallback((target: { latitude: number; longitude: number }) => {
    const next: Region = { latitude: target.latitude, longitude: target.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    setSearchOpen(false);
    currentRegion.current = next;
    setRegion(next);
    ignoreRegionChangeUntil.current = Date.now() + 1200;
    setTimeout(() => mapRef.current?.animateToRegion(next, 450), 250);
    void loadPlaces(next, true, mapLayerRef.current === 'places');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusPlace) return undefined;
    const target: Region = { latitude: focusPlace.latitude, longitude: focusPlace.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    const place = focusPlace;
    onFocusHandled?.();
    currentRegion.current = target;
    setRegion(target);
    ignoreRegionChangeUntil.current = Date.now() + 1200;
    // The native map is not always ready to animate on the very first frame after mount.
    const timer = setTimeout(() => mapRef.current?.animateToRegion(target, 450), 350);
    void loadPlaces(target, true, mapLayerRef.current === 'places');
    openPlaceDetailAfterTouch(place);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPlace]);

  useEffect(() => {
    if (!focusSignal) return undefined;
    const target: Region = { latitude: focusSignal.latitude, longitude: focusSignal.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    const signal = focusSignal;
    onFocusSignalHandled?.();
    currentRegion.current = target;
    setRegion(target);
    ignoreRegionChangeUntil.current = Date.now() + 1200;
    const timer = setTimeout(() => mapRef.current?.animateToRegion(target, 450), 350);
    void loadPlaces(target, true, mapLayerRef.current === 'places');
    openSignalDetailAfterTouch(signal);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  const overlayOpen = isComposerOpen || searchOpen || cameraOpen || Boolean(selectedPlace) || Boolean(selectedSignal) || Boolean(searchProfileUser);
  useEffect(() => { onOverlayOpenChange?.(overlayOpen); }, [overlayOpen, onOverlayOpenChange]);

  const chromeTop = insets.top + 140;

  return (
    <View style={styles.screen}>
      <MapView
        customMapStyle={Platform.OS === 'android' ? mapDarkStyle : undefined}
        initialRegion={focusPlace ? { latitude: focusPlace.latitude, longitude: focusPlace.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 } : ISTANBUL_REGION}
        mapPadding={{ top: chromeTop, right: 14, bottom: bottomBarClearance(insets.bottom), left: 14 }}
        onRegionChangeComplete={handleRegionChangeComplete}
        pitchEnabled={false}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        ref={mapRef}
        rotateEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterests
        showsScale={false}
        showsUserLocation={locationReadiness === 'ready'}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
      >
        {mapItems.map(item => item.type === 'cluster'
          ? <BlinkrClusterMarker key={item.id} latitude={item.latitude} longitude={item.longitude} count={item.pointCount} onPress={() => expandCluster(item)} />
          : <BlinkrMapMarker key={item.id} place={markerLookup.places.get(item.id)} signal={markerLookup.signals.get(item.id)} now={now}
              selected={item.id === `place:${selectedPlace?.id}` || item.id === `signal:${selectedSignal?.postId}`} onPlace={openPlaceDetailAfterTouch} onSignal={openSignalDetailAfterTouch} />)}
      </MapView>

      {!isLoading && !error && visibleItemCount === 0 && !isComposerOpen && !selectedPlace && !selectedSignal && (
        <Animated.View entering={FadeIn.duration(motion.base)} style={[styles.emptyMap, { bottom: bottomBarClearance(insets.bottom) + 12 }]}>
          <Text style={styles.emptyMapText}>Bu bölgede henüz taze sinyal yok.</Text>
          <AnimatedPressable onPress={() => openComposer()} pressScale={0.94} style={styles.emptyMapAction}><Plus color={colors.mint} size={18} /><Text style={styles.emptyMapLink}>İlk sinyali bırak</Text></AnimatedPressable>
        </Animated.View>
      )}

      <MapTopChrome
        activeTypeFilter={activeTypeFilter}
        onToggleTypeFilter={(type) => { toggleTypeFilter(type); Haptics.selectionAsync(); }}
        isLoading={isLoading}
        layer={mapLayer}
        onLayerChange={(layer) => { setMapLayer(layer); Haptics.selectionAsync(); }}
        onLocate={() => moveToDeviceLocation(true).catch((err) => setError(friendlyError(err)))}
        onOpenProfile={onOpenProfile}
        onScan={scanVisibleArea}
        scanAvailable={Boolean(error) && mapDirty}
        avatarKey={auth.avatarKey}
        onOpenSearch={() => { setSearchOrigin({ latitude: currentRegion.current.latitude, longitude: currentRegion.current.longitude }); setSearchOpen(true); }}
        topInset={insets.top}
        userId={auth.userId}
        userName={auth.userName}
      />

      {(success || error) && (
        <Animated.View entering={FadeIn.duration(motion.base)} style={[styles.toast, error ? styles.errorToast : styles.successToast, { bottom: bottomBarClearance(insets.bottom) + 8 }]}>
          {error ? <Wifi color={colors.danger} size={18} /> : <CheckCircle2 color={colors.mint} size={18} />}
          <Text style={[styles.toastText, error && styles.errorToastText]} numberOfLines={3}>
            {error || success}
          </Text>
          <AnimatedPressable accessibilityLabel="Bildirimi kapat" hitSlop={10} onPress={() => { setError(null); setSuccess(null); }} pressScale={0.85}>
            <X color={error ? colors.danger : colors.mint} size={18} />
          </AnimatedPressable>
        </Animated.View>
      )}

      {isComposerOpen && <SignalComposer
        area={composerArea}
        auth={auth}
        canAskLocationAgain={canAskLocationAgain}
        error={composerError}
        initialStep={composerInitialStep}
        initialSignal={composerInitialSignal}
        isSubmitting={isCreating}
        locationReadiness={locationReadiness}
        nearbyCoverageState={nearbyCoverageState}
        nearbyPlaces={nearbyPlaces}
        nearbyStatus={nearbyStatus}
        onAuthChange={onAuthChange}
        onClearError={() => setComposerError(null)}
        onClose={closeComposer}
        onOpenSettings={() => {
          Linking.openSettings().catch(() => setComposerError('Cihaz ayarları açılamadı.'));
        }}
        onRequestCamera={() => setCameraOpen(true)}
        onSelectArea={selectComposerArea}
        onSessionExpired={onLogout}
        onSubmit={submitSignal}
        pendingCapture={pendingCapture}
        visible={isComposerOpen}
      />}
      {searchOpen && (
        <MapSearchOverlay
          auth={auth}
          onClose={() => setSearchOpen(false)}
          onSelectLocation={flyToLocation}
          onSelectPerson={(user) => { setSearchOpen(false); setSearchProfileUser(user); }}
          onSelectPlace={flyToPlace}
          origin={searchOrigin}
        />
      )}

      {searchProfileUser ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setSearchProfileUser(null)}
          onMessage={(user) => { setSearchProfileUser(null); onMessageUser?.(user); }}
          onSessionExpired={onLogout}
          user={searchProfileUser}
        />
      ) : null}
      {cameraOpen && <View style={styles.cameraLayer}><SignalCamera onCapture={handleCaptured} onClose={() => setCameraOpen(false)} onTextOnly={() => { setCameraOpen(false); startSignalOnly(); }} /></View>}
      {!isComposerOpen && <PostDetailSheet
        isLoading={isDetailLoading}
        onClose={closeDetailSheet}
        onCreateSignal={() => openComposer(selectedDetail ?? selectedPlace)}
        // Confirming goes straight to the last step with the same value; "changed" asks for the new value.
        onRecheck={(mode, current) => openComposer(selectedDetail ?? selectedPlace, mode === 'confirm' ? 3 : 1, { type: current.type, value: mode === 'confirm' ? current.value : null })}
        auth={auth}
        refresh={{ onAuthRefresh: onAuthChange, onSessionExpired: onLogout }}
        onReportSignal={async (postId, reason, note) => { await sendReport(auth, { targetType: 'signal', targetId: postId, reason, note }, { onAuthRefresh: onAuthChange, onSessionExpired: onLogout }); }}
        onReportUser={async (userId, reason, note) => { await sendReport(auth, { targetType: 'user', targetId: userId, reason, note }, { onAuthRefresh: onAuthChange, onSessionExpired: onLogout }); }}
        place={selectedDetail ?? selectedPlace}
        signal={selectedSignal}
        userId={auth.userId}
      />}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.mapCanvas, flex: 1 },
  cameraLayer: { ...StyleSheet.absoluteFill, backgroundColor: '#000000', zIndex: 200 },
  emptyMap: { position: 'absolute', left: 28, right: 28, backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card, padding: 16, ...shadowSoft },
  emptyMapText: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyMapAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyMapLink: { fontSize: 15, color: colors.mint, fontWeight: '700' },
  toast: { alignItems: 'center', borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', gap: 10, left: 16, paddingHorizontal: 14, paddingVertical: 12, position: 'absolute', right: 16, zIndex: 15, ...shadow },
  successToast: { backgroundColor: colors.glass, borderColor: colors.greenLine },
  errorToast: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine },
  toastText: { color: colors.mint, flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  errorToastText: { color: colors.danger },
});
