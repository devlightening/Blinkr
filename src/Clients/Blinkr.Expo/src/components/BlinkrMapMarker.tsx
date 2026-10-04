import { memo, useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';

import { liveA11yLabel, pinTagParts } from '../live/liveLabels';
import type { LiveState } from '../live/liveState';
import type { ClusterMix } from '../mapClusters';
import { livePinAnchor } from '../markerGeometry';
import { clusterMixLabel, signalPinLabel } from '../markerA11y';
import type { BlinkrPlace, CoordinateSignal } from '../types';
import { ClusterRing } from './live/ClusterRing';
import { LivePin } from './live/LivePin';
import { SignalPin } from './live/SignalPin';

/**
 * A marker's view is snapshotted into a bitmap. It tracks changes only until its SVG has drawn (Android can snapshot an
 * empty frame otherwise), then stops: from there on nothing redraws it unless its `key` changes. The caller keys every
 * marker by what its picture shows (state, ring step, selection, tag), so the 60 s freshness tick redraws only the
 * markers whose picture actually changed.
 */
const SETTLE_MS = 700;
function useSettledTracking() {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);
  return tracks;
}

/* No `title` on any marker: on iOS it would open the system's white callout over our own sheet. */

export const BlinkrPlaceMarker = memo(function BlinkrPlaceMarker({ place, state, selected, showTag, onPlace }: {
  place: BlinkrPlace; state: LiveState; selected: boolean; showTag: boolean; onPlace: (place: BlinkrPlace) => void;
}) {
  const tracks = useSettledTracking();
  // Same rule as LivePin: a tag is drawn only when the state has a word, and the anchor must know it.
  const tag = (selected || showTag) && pinTagParts(state).state.length > 0;
  return (
    <Marker
      accessibilityLabel={liveA11yLabel(place.name, state)} accessibilityRole="button" anchor={livePinAnchor(state.source === 'none', selected, tag)}
      coordinate={{ latitude: place.latitude, longitude: place.longitude }} onPress={() => onPlace(place)}
      tracksViewChanges={tracks} zIndex={selected ? 45 : state.source === 'live' ? 25 : 20}
    >
      <LivePin category={place.category} selected={selected} showTag={tag} state={state} />
    </Marker>
  );
});

export const BlinkrSignalMarker = memo(function BlinkrSignalMarker({ signal, state, selected, onSignal }: {
  signal: CoordinateSignal; state: LiveState; selected: boolean; onSignal: (signal: CoordinateSignal) => void;
}) {
  const tracks = useSettledTracking();
  return (
    <Marker
      accessibilityLabel={signalPinLabel(signal)} accessibilityRole="button" anchor={livePinAnchor(false, selected, true)}
      coordinate={{ latitude: signal.latitude, longitude: signal.longitude }} onPress={() => onSignal(signal)}
      tracksViewChanges={tracks} zIndex={selected ? 45 : 30}
    >
      <SignalPin selected={selected} state={state} type={signal.signalType} />
    </Marker>
  );
});

export const BlinkrClusterMarker = memo(function BlinkrClusterMarker({ latitude, longitude, count, mix, onPress }: {
  latitude: number; longitude: number; count: number; mix: ClusterMix; onPress: () => void;
}) {
  const tracks = useSettledTracking();
  return (
    <Marker
      accessibilityLabel={clusterMixLabel(count, mix)} accessibilityRole="button" anchor={{ x: 0.5, y: 0.5 }}
      coordinate={{ latitude, longitude }} onPress={onPress} tracksViewChanges={tracks} zIndex={50}
    >
      <ClusterRing count={count} mix={mix} size={count >= 10 ? 58 : 52} />
    </Marker>
  );
});
