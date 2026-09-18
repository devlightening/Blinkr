import Supercluster from 'supercluster';
import type { Region } from 'react-native-maps';

export type MapPointKind = 'place' | 'signal';

export type MapPoint = {
  id: string;
  kind: MapPointKind;
  latitude: number;
  longitude: number;
};

type MapPointProperties = {
  id: string;
  kind: MapPointKind;
};

export type RenderableMapPoint = MapPoint & {
  type: 'point';
};

export type RenderableMapCluster = {
  clusterId: number;
  expansionZoom: number;
  id: string;
  latitude: number;
  longitude: number;
  pointCount: number;
  type: 'cluster';
};

export type RenderableMapItem = RenderableMapPoint | RenderableMapCluster;

export const regionToZoom = (region: Region) => {
  const safeDelta = Math.max(0.0001, Math.min(360, region.longitudeDelta));
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / safeDelta))));
};

export const zoomToLongitudeDelta = (zoom: number) =>
  Math.max(0.0015, Math.min(180, 360 / Math.pow(2, Math.max(1, zoom))));

export const clusterMapPoints = (points: MapPoint[], region: Region): RenderableMapItem[] => {
  if (points.length === 0) return [];

  const index = new Supercluster<MapPointProperties>({
    maxZoom: 17,
    minPoints: 2,
    radius: 48,
  });
  index.load(points.map((point) => ({
    type: 'Feature',
    properties: { id: point.id, kind: point.kind },
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
  })));

  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;

  return index.getClusters([west, south, east, north], regionToZoom(region)).map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    if ('cluster' in feature.properties && feature.properties.cluster) {
      return {
        clusterId: feature.properties.cluster_id,
        expansionZoom: index.getClusterExpansionZoom(feature.properties.cluster_id),
        id: `cluster-${feature.properties.cluster_id}`,
        latitude,
        longitude,
        pointCount: feature.properties.point_count,
        type: 'cluster' as const,
      };
    }

    return {
      id: feature.properties.id,
      kind: feature.properties.kind,
      latitude,
      longitude,
      type: 'point' as const,
    };
  });
};
