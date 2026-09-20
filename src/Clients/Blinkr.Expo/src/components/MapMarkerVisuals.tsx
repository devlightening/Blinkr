import { View, Text, StyleSheet } from 'react-native';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';
import { categoryTone, colors, signalColors, shadowSoft } from '../theme';
import { freshnessOpacity } from '../productPresentation';
import type { BlinkrPlace, CoordinateSignal } from '../types';

/*
 * Pure visuals of the map markers. They contain no react-native-maps import so they can also be
 * rendered by the browser review harness; `BlinkrMapMarker` wraps them in a native <Marker>.
 */

/** Rounded-square Place tile (category tone) or round signal (signal tone). Lime dot = fresh, verified activity. */
export function MarkerVisual({ place, signal, selected, now }: { place?: BlinkrPlace; signal?: CoordinateSignal; selected: boolean; now: number }) {
  const verified = (place?.currentState?.activeSignalCount ?? 0) > 0;
  const tone = place ? categoryTone(place.category) : signal ? signalColors[signal.signalType] ?? colors.coral : colors.mint;
  return (
    <View style={[styles.target, { opacity: freshnessOpacity(place?.lastActivityUtc ?? signal?.createdAtUtc, now) }]}>
      <View style={[styles.mark, place ? styles.place : styles.signal, { borderColor: selected ? colors.white : tone }, selected && styles.selected]}>
        {place ? <PlaceSymbol category={place.category} color={tone} size={23} /> : <SignalSymbol type={signal?.signalType} color={tone} size={22} />}
      </View>
      {selected && place && <View style={[styles.tail, { borderColor: colors.white }]} />}
      {(verified || signal) && <View style={styles.liveDot} />}
    </View>
  );
}

export function ClusterVisual({ count }: { count: number }) {
  return (
    <View style={styles.clusterTarget}>
      <View style={styles.cluster}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text><View style={styles.clusterDot} /></View>
      <View style={styles.clusterLive} />
    </View>
  );
}

const styles = StyleSheet.create({
  target: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 46, height: 46, backgroundColor: colors.surface, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', ...shadowSoft },
  place: { borderRadius: 14 }, signal: { borderRadius: 23 }, selected: { backgroundColor: colors.darkGreen, transform: [{ scale: 1.1 }] },
  tail: { borderRightWidth: 2.5, borderBottomWidth: 2.5, backgroundColor: colors.darkGreen, height: 11, width: 11, marginTop: -6, transform: [{ rotate: '45deg' }] },
  liveDot: { backgroundColor: colors.lime, borderColor: colors.background, borderWidth: 2, borderRadius: 7, width: 14, height: 14, position: 'absolute', right: 5, top: 5 },
  clusterTarget: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  cluster: { height: 54, minWidth: 54, borderRadius: 27, borderColor: colors.lime, borderWidth: 3, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, ...shadowSoft },
  count: { color: colors.white, fontSize: 19, fontWeight: '800' },
  clusterDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, marginTop: 1 },
  clusterLive: { backgroundColor: colors.lime, borderColor: colors.background, borderWidth: 2, borderRadius: 7, width: 14, height: 14, position: 'absolute', right: 6, top: 6 },
});
