import { memo } from 'react';
import { Marker } from 'react-native-maps';
import { ClusterVisual, MarkerVisual } from './MapMarkerVisuals';
import type { BlinkrPlace, CoordinateSignal } from '../types';

/**
 * Native marker wrappers. There is deliberately no `title`: on iOS it would open the system's white
 * callout bubble over our own detail sheet. See `MapMarkerVisuals` for the look.
 */
export const BlinkrMapMarker = memo(function BlinkrMapMarker({ place, signal, selected, now, onPlace, onSignal }: {
  place?: BlinkrPlace; signal?: CoordinateSignal; selected: boolean; now: number;
  onPlace: (place: BlinkrPlace) => void; onSignal: (signal: CoordinateSignal) => void;
}) {
  const anchor = place ?? signal;
  if (!anchor) return null;
  return <Marker coordinate={{ latitude: anchor.latitude, longitude: anchor.longitude }}
    onPress={() => place ? onPlace(place) : signal && onSignal(signal)} zIndex={selected ? 45 : place ? 20 : 30}>
    <MarkerVisual now={now} place={place} selected={selected} signal={signal} />
  </Marker>;
});

export const BlinkrClusterMarker = memo(function BlinkrClusterMarker({ latitude, longitude, count, onPress }: { latitude: number; longitude: number; count: number; onPress: () => void }) {
  return <Marker coordinate={{ latitude, longitude }} onPress={onPress} zIndex={50}>
    <ClusterVisual count={count} />
  </Marker>;
});
