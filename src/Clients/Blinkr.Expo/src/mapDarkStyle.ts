import type { MapStyleElement } from 'react-native-maps';

/** Google Maps dark/night style, tuned to sit near Blinkr's near-black chrome palette. Android + PROVIDER_GOOGLE only. */
export const mapDarkStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#0F1316' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F11' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7C878D' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#262C31' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8E999F' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#121619' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14211D' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E2428' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#121619' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5D686E' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#232A2F' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A3136' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8E999F' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#1B2125' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070A0C' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4B555B' }] },
];
