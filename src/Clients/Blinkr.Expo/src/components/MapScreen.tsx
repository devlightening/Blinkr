import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  Camera,
  CheckCircle2,
  Layers3,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  Navigation2,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Wifi,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  InteractionManager,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSignal, getNearbyPlaces, getPlace, getUnifiedMapBounds, previewPresence, getSignalContent } from '../api';
import { friendlyError, isFresh } from '../productPresentation';
import { Sheet } from './Sheet';
import { BlinkrMark } from './BlinkrMark';
import { BlinkrMapMarker, BlinkrClusterMarker } from './BlinkrMapMarker';
import { clusterMapPoints, zoomToLongitudeDelta } from '../mapClusters';
import {
  NearbyRequestOwnership,
  type NearbyOrigin,
  type NearbyReason,
  type NearbySource,
  distanceMeters,
} from '../nearbyRequestOwnership';
import { colors, radii, shadow, shadowSoft } from '../theme';
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
} from '../types';
import { ISTANBUL_REGION } from '../types';
import { PostDetailSheet } from './PostDetailSheet';
import { SignalComposer } from './SignalComposer';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onLogout: () => void;
  onOpenChat: () => void;
};

type MapLayer = 'all' | 'live' | 'places' | 'signals';

const mapLayers: Array<{ key: MapLayer; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'live', label: 'Canlı' },
  { key: 'places', label: 'Yerler' },
  { key: 'signals', label: 'Sinyaller' },
];

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


export function MapScreen({ auth, onAuthChange, onLogout, onOpenChat }: Props) {
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
  const [composerArea, setComposerArea] = useState<ComposerArea | null>(null);
  const [pendingCapture, setPendingCapture] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [composerInitialStep, setComposerInitialStep] = useState(0);
  const [mapLayer, setMapLayer] = useState<MapLayer>('all');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const visiblePlaces = useMemo(() => {
    if (mapLayer === 'signals') return [];
    if (mapLayer === 'live') {
      return places.filter((place) => (place.currentState?.activeSignalCount ?? 0) > 0 && isFresh(place.currentState?.observedAtUtc, place.currentState?.expiresAtUtc, now));
    }
    if (mapLayer === 'places') return places;
    return places.filter(place => isFresh(place.lastActivityUtc ?? place.currentState?.observedAtUtc, null, now));
  }, [mapLayer, places, now]);

  const visibleSignals = useMemo(
    () => mapLayer === 'places' ? [] : signals.filter(signal => isFresh(signal.createdAtUtc, signal.expiresAt, now)),
    [mapLayer, signals, now],
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
    await loadPlaces(target, false, mapLayer === 'places');
    return {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationAccuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      observationLatitude: position.coords.latitude,
      observationLongitude: position.coords.longitude,
      region: target,
    };
  }, [getFreshDeviceLocation, loadPlaces, mapLayer]);

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
      nearbyOwner.current.reset();
      nearbyLoadingRequest.current = null;
    };
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

  const openComposer = (place?: BlinkrPlace | null, initialStep = 0) => {
    const opening = ++composerGeneration.current;
    closeDetailSheet();
    setProfileOpen(false);
    setComposerArea(null);
    setComposerInitialStep(initialStep);
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

  const openCameraSignal = async () => {
    if (isCreating) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      setComposerError('Kamera izni gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: 45 });
    if (result.canceled || !result.assets[0]) return;
    setPendingCapture(result.assets[0]);
    openComposer(selectedPlace, 1);
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

  return (
    <View style={styles.screen}>
      <MapView
        customMapStyle={Platform.OS === 'android' ? mapDarkStyle : undefined}
        initialRegion={ISTANBUL_REGION}
        mapPadding={{ top: 158, right: 14, bottom: 126, left: 14 }}
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

      {!isLoading && !error && visibleItemCount === 0 && !isComposerOpen && !isProfileOpen && !selectedPlace && !selectedSignal && (
        <Animated.View entering={FadeInDown.duration(320).springify().damping(15)} style={[styles.emptyMap, { bottom: insets.bottom + 148 }]}>
          <Text style={styles.emptyMapText}>Bu bölgede henüz taze sinyal yok.</Text>
          <AnimatedPressable onPress={() => openComposer()} pressScale={0.94} style={styles.emptyMapAction}><Plus color={colors.green} size={18} /><Text style={styles.emptyMapLink}>İlk sinyali bırak</Text></AnimatedPressable>
        </Animated.View>
      )}

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topOverlay}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <BlinkrMark size={30} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>blinkr</Text>
            <View style={styles.liveStatus}>
              <View style={styles.liveDot} />
              <Text style={styles.liveStatusText}>CANLI ÇEVRE</Text>
              <Text style={styles.visibleCount}>· {visibleItemCount} görünür</Text>
            </View>
          </View>
          <AnimatedPressable accessibilityLabel="Profili aç" onPress={() => setProfileOpen(true)} pressScale={0.9} style={styles.avatar}>
            <Text style={styles.avatarText}>{auth.userName.slice(0, 1).toUpperCase()}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.layerControl}>
          <Layers3 color={colors.muted} size={15} />
          {mapLayers.map((layer) => (
            <AnimatedPressable
              accessibilityRole="button"
              key={layer.key}
              onPress={() => {
                setMapLayer(layer.key);
                Haptics.selectionAsync();
              }}
              pressScale={0.92}
              style={[styles.layerOption, mapLayer === layer.key && styles.layerOptionActive]}
            >
              <Text style={[styles.layerText, mapLayer === layer.key && styles.layerTextActive]}>{layer.label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {mapDirty && (
          <Animated.View entering={FadeInDown.duration(220).springify().damping(16)}>
            <AnimatedPressable disabled={isLoading} onPress={scanVisibleArea} pressScale={0.94} style={styles.searchAreaButton}>
              {isLoading ? <ActivityIndicator color={colors.white} size="small" /> : <RefreshCw color={colors.white} size={16} />}
              <Text style={styles.searchAreaText}>{isLoading ? 'Taranıyor' : 'Bu alanı tara'}</Text>
            </AnimatedPressable>
          </Animated.View>
        )}
      </SafeAreaView>

      <View pointerEvents="box-none" style={[styles.mapActions, { bottom: insets.bottom + 88 }]}>
        {!mapDirty && isLoading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.green} size="small" />
            <Text style={styles.loadingText}>Çevre güncelleniyor</Text>
          </View>
        )}
        <AnimatedPressable
          accessibilityLabel="Konumuma git"
          onPress={() => moveToDeviceLocation(true).catch((err) => setError(friendlyError(err)))}
          pressScale={0.88}
          style={styles.locateButton}
        >
          <Navigation2 color={colors.ink} fill={colors.blueSoft} size={21} strokeWidth={2.4} />
        </AnimatedPressable>
      </View>

      {(success || error) && (
        <Animated.View entering={FadeInDown.duration(260).springify().damping(15)} style={[styles.toast, error ? styles.errorToast : styles.successToast, { top: insets.top + 145 }]}>
          {error ? <Wifi color={colors.error} size={18} /> : <CheckCircle2 color={colors.greenDark} size={18} />}
          <Text style={[styles.toastText, error && styles.errorToastText]} numberOfLines={3}>
            {error || success}
          </Text>
          <AnimatedPressable accessibilityLabel="Bildirimi kapat" hitSlop={10} onPress={() => { setError(null); setSuccess(null); }} pressScale={0.85}>
            <X color={error ? colors.error : colors.greenDark} size={18} />
          </AnimatedPressable>
        </Animated.View>
      )}

      <View pointerEvents="box-none" style={[styles.bottomNavWrap, { bottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.bottomNav}>
          <AnimatedPressable accessibilityLabel="Sohbet" onPress={onOpenChat} pressScale={0.92} style={styles.navItem}>
            <MessageCircle color={colors.muted} size={21} strokeWidth={2.3} />
            <Text style={styles.navLabel}>Sohbet</Text>
          </AnimatedPressable>
          <AnimatedPressable accessibilityLabel="Harita" pressScale={0.92} style={styles.navItem}>
            <View style={styles.navIconActive}><MapIcon color={colors.greenDark} size={20} strokeWidth={2.6} /></View>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Harita</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel="Kamerayla sinyal paylaş"
            disabled={isCreating}
            onPress={openCameraSignal}
            pressScale={0.88}
            style={styles.createButton}
          >
            <Camera color={colors.ink} size={24} strokeWidth={2.6} />
          </AnimatedPressable>
          <AnimatedPressable accessibilityLabel="Profil" onPress={() => setProfileOpen(true)} pressScale={0.92} style={styles.navItem}>
            <UserRound color={colors.muted} size={21} strokeWidth={2.3} />
            <Text style={styles.navLabel}>Profil</Text>
          </AnimatedPressable>
        </View>
      </View>

      {isComposerOpen && <SignalComposer
        area={composerArea}
        auth={auth}
        canAskLocationAgain={canAskLocationAgain}
        error={composerError}
        initialStep={composerInitialStep}
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
        onSelectArea={selectComposerArea}
        onSessionExpired={onLogout}
        onSubmit={submitSignal}
        pendingCapture={pendingCapture}
        visible={isComposerOpen}
      />}
      {!isComposerOpen && !isProfileOpen && <PostDetailSheet
        isLoading={isDetailLoading}
        onClose={closeDetailSheet}
        onCreateSignal={() => openComposer(selectedDetail ?? selectedPlace)}
        place={selectedDetail ?? selectedPlace}
        signal={selectedSignal}
      />}

      {isProfileOpen && !isComposerOpen && <Sheet onClose={() => setProfileOpen(false)}>
          <View style={[styles.profilePanel, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.profileHandle} />
            <View style={styles.profileHeader}>
              <View>
                <Text style={styles.profileEyebrow}>BLINKR PROFİLİ</Text>
                <Text style={styles.profileTitle}>Senin çevren</Text>
              </View>
              <AnimatedPressable accessibilityLabel="Profili kapat" onPress={() => setProfileOpen(false)} pressScale={0.88} style={styles.profileClose}>
                <X color={colors.textPrimary} size={20} />
              </AnimatedPressable>
            </View>

            <View style={styles.profileIdentity}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{auth.userName.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.profileIdentityCopy}>
                <Text numberOfLines={1} style={styles.profileName}>{auth.userName}</Text>
                <Text numberOfLines={1} style={styles.profileEmail}>{auth.email}</Text>
              </View>
              <View style={styles.verifiedPill}><ShieldCheck color={colors.greenDark} size={14} /><Text style={styles.verifiedText}>Aktif</Text></View>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.profileRow}>
                <ShieldCheck color={colors.green} size={22} />
                <View style={styles.profileIdentityCopy}>
                  <Text style={styles.profileRowTitle}>Gizlilik</Text>
                  <Text style={styles.profileRowText}>Kesin cihaz konumun diğer kullanıcılara gösterilmez.</Text>
                </View>
              </View>
            </View>

            <AnimatedPressable onPress={onLogout} pressScale={0.95} style={styles.logoutButton}>
              <LogOut color={colors.error} size={18} />
              <Text style={styles.logoutText}>Oturumu kapat</Text>
            </AnimatedPressable>
          </View>
      </Sheet>}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyMap: { position: 'absolute', left: 36, right: 36, backgroundColor: colors.surface, borderRadius: radii.control, padding: 16, ...shadowSoft },
  emptyMapText: { color: colors.textPrimary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyMapAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyMapLink: { fontSize: 14, color: colors.green, fontWeight: '600' },
  screen: { backgroundColor: colors.mapCanvas, flex: 1 },
  topOverlay: { left: 0, paddingHorizontal: 12, position: 'absolute', right: 0, top: 0 },
  topBar: { alignItems: 'center', backgroundColor: 'rgba(15,20,16,0.92)', borderColor: 'rgba(244,247,241,0.08)', borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', marginTop: 7, minHeight: 58, paddingHorizontal: 10, ...shadow },
  brandMark: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.control, height: 38, justifyContent: 'center', width: 38 },
  brandCopy: { flex: 1, marginLeft: 10 },
  brand: { color: colors.textPrimary, fontSize: 19, fontWeight: '600', letterSpacing: 0 },
  liveStatus: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  liveDot: { backgroundColor: colors.coral, borderRadius: 4, height: 7, marginRight: 5, width: 7 },
  liveStatusText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  visibleCount: { color: colors.muted, fontSize: 12, fontWeight: '700', marginLeft: 3 },
  avatar: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 38 },
  avatarText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  layerControl: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(15,20,16,0.92)', borderRadius: radii.control, flexDirection: 'row', gap: 3, marginTop: 7, minHeight: 40, paddingHorizontal: 6, ...shadowSoft },
  layerOption: { alignItems: 'center', borderRadius: 6, justifyContent: 'center', minHeight: 44, paddingHorizontal: 9 },
  layerOptionActive: { backgroundColor: colors.lime },
  layerText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  layerTextActive: { color: colors.ink },
  searchAreaButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.ink, borderRadius: radii.control, flexDirection: 'row', gap: 8, marginTop: 8, minHeight: 44, paddingHorizontal: 15, ...shadow },
  searchAreaText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  mapActions: { alignItems: 'flex-end', left: 12, position: 'absolute', right: 12 },
  locateButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.control, borderWidth: 1, height: 48, justifyContent: 'center', width: 48, ...shadow },
  controlPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  loadingBadge: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(15,20,16,0.92)', borderRadius: radii.control, flexDirection: 'row', gap: 8, marginBottom: -42, minHeight: 38, paddingHorizontal: 12, ...shadowSoft },
  loadingText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  toast: { alignItems: 'center', borderRadius: radii.control, flexDirection: 'row', gap: 9, left: 16, paddingHorizontal: 13, paddingVertical: 11, position: 'absolute', right: 16, ...shadow },
  successToast: { backgroundColor: colors.greenSoft },
  errorToast: { backgroundColor: colors.errorSoft },
  toastText: { color: colors.greenDark, flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  errorToastText: { color: colors.error },
  bottomNavWrap: { alignItems: 'center', left: 12, position: 'absolute', right: 12 },
  bottomNav: { alignItems: 'center', backgroundColor: 'rgba(15,20,16,0.94)', borderColor: 'rgba(244,247,241,0.08)', borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', height: 68, justifyContent: 'space-around', maxWidth: 420, paddingHorizontal: 12, width: '100%', ...shadow },
  navItem: { alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 72 },
  navIconActive: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 6, height: 27, justifyContent: 'center', width: 34 },
  navLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  navLabelActive: { color: colors.greenDark },
  createButton: { alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.ink, borderRadius: radii.control, borderWidth: 2, height: 52, justifyContent: 'center', width: 58, ...shadowSoft },
  createButtonPressed: { opacity: 0.86, transform: [{ scale: 0.96 }] },
  profilePanel: { backgroundColor: colors.surface, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, maxHeight: '88%', paddingHorizontal: 20, paddingTop: 9, ...shadow },
  profileHandle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 2, height: 4, marginBottom: 16, width: 38 },
  profileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileEyebrow: { color: colors.green, fontSize: 12, fontWeight: '600' },
  profileTitle: { color: colors.textPrimary, fontSize: 23, fontWeight: '600', marginTop: 3 },
  profileClose: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 40 },
  profileIdentity: { alignItems: 'center', flexDirection: 'row', marginTop: 20 },
  profileIdentityCopy: { flex: 1, marginLeft: 13 },
  profileAvatar: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.control, height: 56, justifyContent: 'center', width: 56 },
  profileAvatarText: { color: colors.white, fontSize: 22, fontWeight: '600' },
  profileName: { color: colors.textPrimary, fontSize: 19, fontWeight: '600' },
  profileEmail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  verifiedPill: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  verifiedText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
  profileSection: { borderBottomColor: colors.line, borderBottomWidth: 1, borderTopColor: colors.line, borderTopWidth: 1, marginTop: 20 },
  profileRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 13 },
  profileRowTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  profileRowText: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 3 },
  logoutButton: { alignItems: 'center', borderColor: colors.coralLine, borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', gap: 9, marginTop: 18, minHeight: 48, paddingHorizontal: 14 },
  logoutText: { color: colors.error, fontSize: 14, fontWeight: '600' },
});
