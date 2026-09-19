import type { MapStyleElement } from 'react-native-maps';

/** Google Maps dark/night style, tuned to sit near Blinkr's near-black chrome palette. Android + PROVIDER_GOOGLE only. */
export const mapDarkStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#0F1512' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F0C' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7A857D' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#262C26' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8A968D' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#12170F' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#132019' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E2420' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#12170F' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5C665F' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#232A25' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A322C' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8A968D' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#1B211D' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070B09' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A544D' }] },
];
