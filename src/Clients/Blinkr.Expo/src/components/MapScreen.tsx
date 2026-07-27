import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  CheckCircle2,
  Clock3,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import Supercluster from 'supercluster';

import { createSignal, getPostsInBounds } from '../api';
import { colors, shadow } from '../theme';
import type {
  AuthResponse,
  BlinkrPost,
  Bounds,
  ClusterPoint,
  ComposerArea,
  CreateSignalInput,
  LocationReadiness,
} from '../types';
import { ISTANBUL_REGION } from '../types';
import { PostDetailSheet } from './PostDetailSheet';
import { SignalComposer } from './SignalComposer';

type Props = {
  auth: AuthResponse;
  onLogout: () => void;
};

const getBounds = (region: Region): Bounds => ({
  minLat: region.latitude - region.latitudeDelta / 2,
  maxLat: region.latitude + region.latitudeDelta / 2,
  minLng: region.longitude - region.longitudeDelta / 2,
  maxLng: region.longitude + region.longitudeDelta / 2,
});

const getZoom = (longitudeDelta: number) =>
  Math.max(1, Math.min(22, Math.round(Math.log2(360 / longitudeDelta))));

const getSignalColor = (type?: string) => ({
  Crowd: colors.coral,
  Queue: '#A34D28',
  Event: '#4263A8',
  Offer: '#B53A6B',
  NewOpening: colors.green,
  TemporaryStatus: '#4F5A53',
  GeneralObservation: colors.green,
}[type ?? 'GeneralObservation'] ?? colors.green);

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function MapScreen({ auth, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const submissionInFlight = useRef(false);
  const [region, setRegion] = useState<Region>(ISTANBUL_REGION);
  const [posts, setPosts] = useState<BlinkrPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlinkrPost | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [locationReadiness, setLocationReadiness] = useState<LocationReadiness>('checking');
  const [canAskLocationAgain, setCanAskLocationAgain] = useState(true);
  const [mapDirty, setMapDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [composerArea, setComposerArea] = useState<ComposerArea | null>(null);

  const loadPosts = useCallback(async (targetRegion: Region, quiet = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      const items = await getPostsInBounds(
        getBounds(targetRegion),
        getZoom(targetRegion.longitudeDelta),
        controller.signal,
      );
      setPosts(items);
      setMapDirty(false);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Harita verisi alınamadı.');
    } finally {
      if (activeRequest.current === controller) setIsLoading(false);
    }
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

    setLocationReadiness('locating');
    let position: Location.LocationObject;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      setLocationReadiness('unavailable');
      throw new Error('Güncel konum alınamadı. Konum servisinin açık olduğunu kontrol edip tekrar dene.');
    }

    const target: Region = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
    setRegion(target);
    setLocationReadiness('ready');
    mapRef.current?.animateToRegion(target, 450);
    await loadPosts(target);
    return {
      accuracyMeters: Math.max(1, position.coords.accuracy ?? 25),
      region: target,
    };
  }, [loadPosts]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        setCanAskLocationAgain(permission.canAskAgain);
        if (permission.status === 'granted') {
          await moveToDeviceLocation(false);
          return;
        }

        setLocationReadiness('permission-required');
        await loadPosts(ISTANBUL_REGION);
      })
      .catch(() => {
        setLocationReadiness('unavailable');
        return loadPosts(ISTANBUL_REGION);
      });
    return () => activeRequest.current?.abort();
  }, [loadPosts, moveToDeviceLocation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      if (!isComposerOpen) {
        loadPosts(region, true);
        return;
      }

      Location.getForegroundPermissionsAsync()
        .then(async (permission) => {
          setCanAskLocationAgain(permission.canAskAgain);
          if (permission.status === 'granted') {
            setComposerError(null);
            await moveToDeviceLocation(false);
          } else {
            setLocationReadiness('permission-required');
          }
        })
        .catch(() => setLocationReadiness('unavailable'));
    });
    return () => subscription.remove();
  }, [isComposerOpen, loadPosts, moveToDeviceLocation, region]);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = setTimeout(() => setSuccess(null), 5500);
    return () => clearTimeout(timeout);
  }, [success]);

  const bounds = useMemo(() => getBounds(region), [region]);
  const zoom = useMemo(() => getZoom(region.longitudeDelta), [region.longitudeDelta]);

  const clusters = useMemo(() => {
    const points: ClusterPoint[] = posts.map((post) => ({
      type: 'Feature',
      properties: { cluster: false, post },
      geometry: { type: 'Point', coordinates: [post.longitude as number, post.latitude as number] },
    }));
    const index = new Supercluster<ClusterPoint['properties'], object>({ radius: 58, maxZoom: 20 });
    index.load(points);
    return index.getClusters(
      [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat],
      zoom,
    ) as ClusterPoint[];
  }, [bounds, posts, zoom]);

  const zoomIntoCluster = (cluster: ClusterPoint) => {
    const [longitude, latitude] = cluster.geometry.coordinates;
    const target = {
      latitude,
      longitude,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.004),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.004),
    };
    setRegion(target);
    mapRef.current?.animateToRegion(target, 320);
    loadPosts(target);
  };

  const resolveAreaName = useCallback(async (target: Region) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: target.latitude,
        longitude: target.longitude,
      });
      const primary = address?.district || address?.subregion || address?.city || address?.region;
      const secondary = address?.city && address.city !== primary ? address.city : address?.region;
      return [primary, secondary].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ')
        || 'Yaklaşık alan';
    } catch {
      return 'Yaklaşık alan';
    }
  }, []);

  const selectComposerArea = useCallback(async (source: 'device' | 'map') => {
    setComposerError(null);
    try {
      if (source === 'map') {
        if (region.latitudeDelta > 0.15 || region.longitudeDelta > 0.15) {
          throw new Error('Alan seçmek için haritayı biraz daha yakınlaştır.');
        }
        const name = await resolveAreaName(region);
        setComposerArea({
          accuracyMeters: Math.min(4999, Math.max(100, region.latitudeDelta * 27_750)),
          name,
          region,
          source,
        });
        setLocationReadiness('ready');
        return;
      }

      const location = await moveToDeviceLocation(true);
      const name = await resolveAreaName(location.region);
      setComposerArea({ ...location, name, source });
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Alan seçilemedi.');
    }
  }, [moveToDeviceLocation, region, resolveAreaName]);

  const openComposer = () => {
    setComposerError(null);
    setComposerArea(null);
    setComposerOpen(true);
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
      if (!composerArea) throw new Error('Önce sinyalin ait olduğu alanı seç.');
      const postId = await createSignal(auth.token, {
        ...input,
        accuracyMeters: composerArea.accuracyMeters,
        latitude: composerArea.region.latitude,
        longitude: composerArea.region.longitude,
        locationName: composerArea.name,
      });
      setLastPostId(postId);
      setComposerOpen(false);
      setSuccess('Sinyalin alındı. Haritaya yerleştiriliyor...');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let projected = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await wait(attempt === 0 ? 1200 : 1500);
        try {
          const items = await getPostsInBounds(
            getBounds(composerArea.region),
            getZoom(composerArea.region.longitudeDelta),
          );
          setPosts(items);
          setMapDirty(false);
          projected = items.some((post) => post.id === postId);
          if (projected) break;
        } catch {
          // The accepted post can still be recovered by the next map refresh.
        }
      }

      setSuccess(projected
        ? 'Sinyalin haritada yayında.'
        : 'Sinyalin kaydedildi. Haritada görünmesi biraz gecikebilir.');
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
        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          if (cluster.properties.cluster) {
            return (
              <Marker
                coordinate={{ latitude, longitude }}
                key={`cluster-${cluster.properties.cluster_id}`}
                onPress={() => zoomIntoCluster(cluster)}
              >
                <View style={styles.clusterMarker}>
                  <Text style={styles.clusterCount}>{cluster.properties.point_count ?? 0}</Text>
                </View>
              </Marker>
            );
          }

          const post = cluster.properties.post;
          if (!post) return null;
          return (
            <Marker
              coordinate={{ latitude, longitude }}
              key={post.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedPost(post);
              }}
            >
              <View style={styles.markerShadow}>
                <View style={[styles.postMarker, { backgroundColor: getSignalColor(post.signalType) }]}>
                  <MapPin color={colors.white} fill={colors.white} size={18} strokeWidth={2.8} />
                </View>
              </View>
            </Marker>
          );
        })}
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
              <Text style={styles.liveStatusText}>Son 3 saat · {posts.length} sinyal</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Profili aç" onPress={() => setProfileOpen(true)} style={styles.avatar}>
            <Text style={styles.avatarText}>{auth.userName.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>

        {mapDirty && (
          <Pressable onPress={() => loadPosts(region)} style={styles.searchAreaButton}>
            {isLoading ? <ActivityIndicator color={colors.white} size="small" /> : <RefreshCw color={colors.white} size={16} />}
            <Text style={styles.searchAreaText}>Bu alanı tara</Text>
          </Pressable>
        )}
      </SafeAreaView>

      <View pointerEvents="box-none" style={[styles.mapActions, { bottom: insets.bottom + 94 }]}>
        {!mapDirty && isLoading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator color={colors.green} size="small" />
            <Text style={styles.loadingText}>Taze sinyaller aranıyor</Text>
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
        <Pressable
          accessibilityLabel="Yeni sinyal oluştur"
          onPress={openComposer}
          style={styles.createButton}
        >
          <Plus color={colors.ink} size={26} strokeWidth={3} />
        </Pressable>
        <Pressable onPress={() => setProfileOpen(true)} style={styles.navItem}>
          <UserRound color={colors.muted} size={22} strokeWidth={2.3} />
          <Text style={styles.navLabel}>Profil</Text>
        </Pressable>
      </View>

      <SignalComposer
        area={composerArea}
        canAskLocationAgain={canAskLocationAgain}
        error={composerError}
        isSubmitting={isCreating}
        locationReadiness={locationReadiness}
        onClearError={() => setComposerError(null)}
        onClose={() => {
          if (!isCreating) setComposerOpen(false);
        }}
        onOpenSettings={() => {
          Linking.openSettings().catch(() => setComposerError('Cihaz ayarları açılamadı.'));
        }}
        onSelectArea={selectComposerArea}
        onSubmit={submitSignal}
        visible={isComposerOpen}
      />
      <PostDetailSheet onClose={() => setSelectedPost(null)} post={selectedPost} />

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
                  <Text style={styles.profileRowTitle}>Bağlantı hazır</Text>
                  <Text style={styles.profileRowText}>Harita ve sinyal servisi kullanılabilir</Text>
                </View>
              </View>
              <View style={styles.profileDivider} />
              <View style={styles.profileRow}>
                <View style={styles.profileRowIcon}>
                  <ShieldCheck color={colors.greenDark} size={19} />
                </View>
                <View style={styles.profileRowCopy}>
                  <Text style={styles.profileRowTitle}>Konum kontrolü sende</Text>
                  <Text style={styles.profileRowText}>Konum yalnız paylaştığın sinyali yerleştirmek için kullanılır</Text>
                </View>
              </View>
            </View>

            {lastPostId && (
              <View style={styles.lastSignal}>
                <Clock3 color={colors.coral} size={19} />
                <View style={styles.profileRowCopy}>
                  <Text style={styles.profileRowTitle}>Son sinyalin</Text>
                  <Text style={styles.lastSignalText}>Harita akışına gönderildi</Text>
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
  topBar: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 8,
    flexDirection: 'row', marginTop: 8, padding: 10, ...shadow,
  },
  brandMark: {
    alignItems: 'center', backgroundColor: colors.green, borderRadius: 8,
    height: 40, justifyContent: 'center', width: 40,
  },
  brandCopy: { flex: 1, marginLeft: 10 },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  liveStatus: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 2 },
  liveDot: { backgroundColor: colors.coral, borderRadius: 4, height: 7, width: 7 },
  liveStatusText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  avatar: {
    alignItems: 'center', backgroundColor: colors.greenSoft, borderColor: '#C9DDD0', borderRadius: 8,
    borderWidth: 1, height: 40, justifyContent: 'center', width: 40,
  },
  avatarText: { color: colors.greenDark, fontSize: 15, fontWeight: '900' },
  searchAreaButton: {
    alignItems: 'center', alignSelf: 'center', backgroundColor: colors.greenDark, borderRadius: 8,
    flexDirection: 'row', gap: 8, marginTop: 10, minHeight: 42, paddingHorizontal: 16, ...shadow,
  },
  searchAreaText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  mapActions: {
    alignItems: 'flex-end', left: 14, position: 'absolute', right: 14,
  },
  locateButton: {
    alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, height: 48,
    justifyContent: 'center', width: 48, ...shadow,
  },
  loadingBadge: {
    alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 8, flexDirection: 'row', gap: 8, marginBottom: -42, minHeight: 40,
    paddingHorizontal: 13, ...shadow,
  },
  loadingText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  clusterMarker: {
    alignItems: 'center', backgroundColor: colors.greenDark, borderColor: colors.white,
    borderRadius: 8, borderWidth: 3, height: 46, justifyContent: 'center', width: 46, ...shadow,
  },
  clusterCount: { color: colors.white, fontSize: 14, fontWeight: '900' },
  markerShadow: { ...shadow },
  postMarker: {
    alignItems: 'center', backgroundColor: colors.coral, borderColor: colors.white,
    borderRadius: 8, borderWidth: 3, height: 39, justifyContent: 'center', width: 39,
  },
  toast: {
    alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 9, left: 18,
    paddingHorizontal: 13, paddingVertical: 11, position: 'absolute', right: 18, ...shadow,
  },
  successToast: { backgroundColor: '#E8F5EC' },
  errorToast: { backgroundColor: colors.errorSoft },
  toastText: { color: colors.greenDark, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  errorToastText: { color: colors.error },
  bottomNav: {
    alignItems: 'flex-start', backgroundColor: colors.surface, borderTopColor: colors.line,
    borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around',
    left: 0, paddingTop: 10, position: 'absolute', right: 0,
  },
  navItem: { alignItems: 'center', minHeight: 50, minWidth: 76 },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 4 },
  navLabelActive: { color: colors.greenDark },
  createButton: {
    alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.surface,
    borderRadius: 8, borderWidth: 4, height: 58, justifyContent: 'center', marginTop: -28,
    width: 58, ...shadow,
  },
  profileScrim: { backgroundColor: colors.scrim, flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  profilePanel: {
    backgroundColor: colors.surface, height: '100%', paddingHorizontal: 20, width: '84%', ...shadow,
  },
  profileHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  profileEyebrow: { color: colors.green, fontSize: 11, fontWeight: '900' },
  profileClose: {
    alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8,
    height: 40, justifyContent: 'center', width: 40,
  },
  profileIdentity: { alignItems: 'center', flexDirection: 'row', marginTop: 24 },
  profileIdentityCopy: { flex: 1, marginLeft: 13 },
  profileAvatar: {
    alignItems: 'center', backgroundColor: colors.green, borderRadius: 8,
    height: 58, justifyContent: 'center', width: 58,
  },
  profileAvatarText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  profileName: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  profileEmail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  profileSection: {
    backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8,
    borderWidth: 1, marginTop: 28, paddingHorizontal: 14,
  },
  profileRow: { alignItems: 'flex-start', flexDirection: 'row', paddingVertical: 14 },
  profileRowIcon: {
    alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8,
    height: 36, justifyContent: 'center', marginRight: 11, width: 36,
  },
  connectionIcon: { backgroundColor: '#E7F4EA' },
  profileRowCopy: { flex: 1 },
  profileRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  profileRowText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  profileDivider: { backgroundColor: colors.line, height: 1 },
  lastSignal: {
    alignItems: 'center', backgroundColor: '#FFF2EC', borderRadius: 8,
    flexDirection: 'row', gap: 11, marginTop: 12, padding: 13,
  },
  lastSignalText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  logoutButton: {
    alignItems: 'center', borderColor: '#F0D0CD', borderRadius: 8, borderWidth: 1,
    flexDirection: 'row', gap: 9, marginTop: 'auto', marginBottom: 28, minHeight: 50,
    paddingHorizontal: 14,
  },
  logoutText: { color: colors.error, fontSize: 14, fontWeight: '900' },
});
