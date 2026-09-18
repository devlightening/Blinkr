import { clusterMapPoints, regionToZoom } from '../src/mapClusters';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const points = [
  { id: 'place-a', kind: 'place' as const, latitude: 39.9208, longitude: 32.8541 },
  { id: 'signal-a', kind: 'signal' as const, latitude: 39.9209, longitude: 32.8542 },
  { id: 'place-b', kind: 'place' as const, latitude: 39.9210, longitude: 32.8543 },
];

const cityRegion = { latitude: 39.9209, longitude: 32.8542, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const streetRegion = { latitude: 39.9209, longitude: 32.8542, latitudeDelta: 0.001, longitudeDelta: 0.001 };

const cityItems = clusterMapPoints(points, cityRegion);
assert(cityItems.some((item) => item.type === 'cluster' && item.pointCount === 3), 'Nearby markers should cluster at city zoom.');

const streetItems = clusterMapPoints(points, streetRegion);
assert(streetItems.every((item) => item.type === 'point'), 'Markers should separate at street zoom.');
assert(regionToZoom(streetRegion) > regionToZoom(cityRegion), 'Smaller viewport delta must produce a higher zoom.');

console.log('map cluster tests passed');
