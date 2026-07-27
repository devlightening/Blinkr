import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Supercluster from 'supercluster';

declare const process: { env?: Record<string, string | undefined> };

type Post = {
  id: string;
  title?: string;
  content?: string;
  authorName?: string;
  createdAtUtc?: string;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  likeCount?: number;
  commentCount?: number;
  freshnessSec?: number | null;
  isLive?: boolean;
};

type Bounds = {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
};

type ClusterPoint = {
  type: 'Feature';
  properties: {
    cluster: boolean;
    post?: Post;
    point_count?: number;
    cluster_id?: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

const ISTANBUL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const API_BASE_URL =
  process.env?.EXPO_PUBLIC_BLINKR_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5215' : 'http://localhost:5215');

const getBounds = (region: Region): Bounds => ({
  minLat: region.latitude - region.latitudeDelta / 2,
  maxLat: region.latitude + region.latitudeDelta / 2,
  minLon: region.longitude - region.longitudeDelta / 2,
  maxLon: region.longitude + region.longitudeDelta / 2,
});

const getZoom = (longitudeDelta: number) =>
  Math.max(1, Math.min(22, Math.round(Math.log2(360 / longitudeDelta))));

const formatAge = (seconds?: number | null) => {
  if (seconds == null) return 'simdi';
  if (seconds < 60) return `${Math.max(1, seconds)} sn`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} dk`;
  return `${Math.round(seconds / 3600)} sa`;
};

export default function App() {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(ISTANBUL_REGION);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVisiblePosts = useCallback(async (nextRegion: Region) => {
    const bounds = getBounds(nextRegion);
    const zoom = getZoom(nextRegion.longitudeDelta);
    const params = new URLSearchParams({
      minLat: bounds.minLat.toString(),
      minLon: bounds.minLon.toString(),
      maxLat: bounds.maxLat.toString(),
      maxLon: bounds.maxLon.toString(),
      zoom: zoom.toString(),
      sinceMinutes: '180',
      page: '1',
      pageSize: '200',
    });

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/posts-read/bounds?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rawItems: Post[] = Array.isArray(payload) ? payload : payload.items ?? [];
      const mappablePosts = rawItems.filter(
        (post) => typeof post.latitude === 'number' && typeof post.longitude === 'number',
      );

      setPosts(mappablePosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Harita verisi alinamadi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisiblePosts(ISTANBUL_REGION);
  }, [loadVisiblePosts]);

  useEffect(() => {
    let isMounted = true;

    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return null;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      })
      .then((position) => {
        if (!isMounted || !position) return;

        const nextRegion = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        };

        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 450);
        loadVisiblePosts(nextRegion);
      })
      .catch(() => {
        // Istanbul remains the deterministic fallback when location is unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, [loadVisiblePosts]);

  const visibleBounds = useMemo(() => getBounds(region), [region]);
  const zoom = useMemo(() => getZoom(region.longitudeDelta), [region.longitudeDelta]);

  const clusters = useMemo(() => {
    const points: ClusterPoint[] = posts.map((post) => ({
      type: 'Feature',
      properties: { cluster: false, post },
      geometry: {
        type: 'Point',
        coordinates: [post.longitude as number, post.latitude as number],
      },
    }));

    const index = new Supercluster<ClusterPoint['properties'], object>({
      radius: 56,
      maxZoom: 20,
    });

    index.load(points);

    return index.getClusters(
      [visibleBounds.minLon, visibleBounds.minLat, visibleBounds.maxLon, visibleBounds.maxLat],
      zoom,
    ) as ClusterPoint[];
  }, [posts, visibleBounds, zoom]);

  const handleRegionChangeComplete = (nextRegion: Region) => {
    setRegion(nextRegion);
    loadVisiblePosts(nextRegion);
  };

  const zoomIntoCluster = (cluster: ClusterPoint) => {
    const [longitude, latitude] = cluster.geometry.coordinates;
    const nextRegion = {
      latitude,
      longitude,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.004),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.004),
    };

    setSelectedPost(null);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 300);
    loadVisiblePosts(nextRegion);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={ISTANBUL_REGION}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton
        toolbarEnabled={false}
      >
        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const isCluster = cluster.properties.cluster;

          if (isCluster) {
            const count = cluster.properties.point_count ?? 0;
            return (
              <Marker
                key={`cluster-${cluster.properties.cluster_id}-${longitude}-${latitude}`}
                coordinate={{ latitude, longitude }}
                onPress={() => zoomIntoCluster(cluster)}
              >
                <View style={styles.clusterMarker}>
                  <Text style={styles.clusterText}>{count}</Text>
                </View>
              </Marker>
            );
          }

          const post = cluster.properties.post;
          if (!post) return null;

          return (
            <Marker
              key={post.id}
              coordinate={{ latitude, longitude }}
              onPress={() => setSelectedPost(post)}
            >
              <View style={[styles.postMarker, post.isLive && styles.liveMarker]}>
                <View style={styles.postMarkerDot} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>Blinkr</Text>
            <Text style={styles.meta}>{posts.length} post · zoom {zoom}</Text>
          </View>
          <Pressable style={styles.refreshButton} onPress={() => loadVisiblePosts(region)}>
            <Text style={styles.refreshText}>{isLoading ? '...' : 'Yenile'}</Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#111827" />
            <Text style={styles.loadingText}>Harita yukleniyor</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorPill}>
            <Text style={styles.errorText}>Backend baglantisi yok: {error}</Text>
          </View>
        )}
      </SafeAreaView>

      {selectedPost && (
        <SafeAreaView style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedPost.title || selectedPost.locationName || 'Blinkr post'}
              </Text>
              <Pressable onPress={() => setSelectedPost(null)}>
                <Text style={styles.closeText}>Kapat</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetContent} numberOfLines={3}>
              {selectedPost.content || 'Bu post icin icerik onizlemesi yok.'}
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{selectedPost.authorName || 'Anonim'}</Text>
              <Text style={styles.stat}>{formatAge(selectedPost.freshnessSec)}</Text>
              <Text style={styles.stat}>Like {selectedPost.likeCount ?? 0}</Text>
              <Text style={styles.stat}>Comment {selectedPost.commentCount ?? 0}</Text>
            </View>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#d7dee8',
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
  },
  topBar: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  brand: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  meta: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  errorPill: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginTop: 10,
    maxWidth: '94%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '700',
  },
  clusterMarker: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  clusterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  postMarker: {
    alignItems: 'center',
    backgroundColor: '#f97316',
    borderColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 3,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  liveMarker: {
    backgroundColor: '#10b981',
  },
  postMarkerDot: {
    backgroundColor: '#ffffff',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  sheetWrap: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    position: 'absolute',
    right: 0,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 10,
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  closeText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetContent: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  stat: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    color: '#374151',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
