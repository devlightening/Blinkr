import type { MapStyleElement } from 'react-native-maps';

import { palette as p } from './theme';

/**
 * Google Maps styles (Android + PROVIDER_GOOGLE; iOS Apple Maps follows `userInterfaceStyle`). plan-devam B9: a calm,
 * low-saturation map so the pastel pins carry the colour - warm paper in the light theme, coal in the dark one.
 * Base-map points of interest stay off: Blinkr's markers come only from Blinkr data (root CLAUDE.md §11).
 */
const shared = (c: { land: string; park: string; road: string; roadEdge: string; arterial: string; highway: string; water: string; label: string; labelStrong: string; labelStroke: string; admin: string }): MapStyleElement[] => [
  { elementType: 'geometry', stylers: [{ color: c.land }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: c.labelStroke }] },
  { elementType: 'labels.text.fill', stylers: [{ color: c.label }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: c.admin }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: c.labelStrong }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: c.land }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: c.park }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: c.road }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: c.roadEdge }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: c.label }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: c.arterial }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: c.highway }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: c.labelStrong }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: c.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: c.label }] },
];

export const mapLightStyle: MapStyleElement[] = shared({
  land: p.paper100, park: p.sage200, road: p.white, roadEdge: p.paper300, arterial: p.white, highway: p.paper50,
  water: '#D3E6EF', label: p.ink400, labelStrong: p.ink500, labelStroke: p.paper50, admin: p.paper300,
});

export const mapDarkStyle: MapStyleElement[] = shared({
  land: p.coal900, park: '#1B2A24', road: p.coal700, roadEdge: p.coal900, arterial: p.coal700, highway: p.coal600,
  water: '#0F1418', label: '#7C858D', labelStrong: p.chalk300, labelStroke: p.coal900, admin: p.coal600,
});
