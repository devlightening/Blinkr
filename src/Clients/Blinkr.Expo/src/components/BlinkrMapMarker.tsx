import { memo } from 'react';
import { Marker } from 'react-native-maps';
import { PLACE_PIN, SIGNAL_BUBBLE, anchorOf } from '../markerGeometry';
import { ClusterVisual, MarkerVisual } from './MapMarkerVisuals';
import type { BlinkrPlace, CoordinateSignal } from '../types';

const PLACE_ANCHOR = anchorOf(PLACE_PIN);
const SIGNAL_ANCHOR = anchorOf(SIGNAL_BUBBLE);

/**
 * Native marker wrappers. There is deliberately no `title`: on iOS it would open the system's white
 * callout bubble over our own detail sheet. See `MapMarkerVisuals` for the look. Pins and bubbles are
 * anchored by their tip, so the tip sits exactly on the coordinate; clusters are centred.
 */
export const BlinkrMapMarker = memo(function BlinkrMapMarker({ place, signal, selected, now, onPlace, onSignal }: {
  place?: BlinkrPlace; signal?: CoordinateSignal; selected: boolean; now: number;
  onPlace: (place: BlinkrPlace) => void; onSignal: (signal: CoordinateSignal) => void;
}) {
  const anchor = place ?? signal;
  if (!anchor) return null;
  return <Marker anchor={place ? PLACE_ANCHOR : SIGNAL_ANCHOR} coordinate={{ latitude: anchor.latitude, longitude: anchor.longitude }}
    onPress={() => place ? onPlace(place) : signal && onSignal(signal)} zIndex={selected ? 45 : place ? 20 : 30}>
    <MarkerVisual now={now} place={place} selected={selected} signal={signal} />
  </Marker>;
});

export const BlinkrClusterMarker = memo(function BlinkrClusterMarker({ latitude, longitude, count, onPress }: { latitude: number; longitude: number; count: number; onPress: () => void }) {
  return <Marker anchor={{ x: 0.5, y: 0.5 }} coordinate={{ latitude, longitude }} onPress={onPress} zIndex={50}>
    <ClusterVisual count={count} />
  </Marker>;
});
