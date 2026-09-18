import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';
import { colors, shadowSoft } from '../theme';
import { freshnessOpacity } from '../productPresentation';
import type { BlinkrPlace, CoordinateSignal, SignalType } from '../types';
const signalColors: Partial<Record<SignalType, string>> = { Crowd: '#C75039', Queue: '#98620C', Event: '#147B76', Offer: '#7451AA', TemporaryStatus: '#AF3F3C', GeneralObservation: '#2878B0' };

export const BlinkrMapMarker = memo(function BlinkrMapMarker({ place, signal, selected, now, onPlace, onSignal }: {
  place?: BlinkrPlace; signal?: CoordinateSignal; selected: boolean; now: number;
  onPlace: (place: BlinkrPlace) => void; onSignal: (signal: CoordinateSignal) => void;
}) {
  const anchor = place ?? signal;
  if (!anchor) return null;
  const verified = (place?.currentState?.activeSignalCount ?? 0) > 0;
  return <Marker coordinate={{ latitude: anchor.latitude, longitude: anchor.longitude }}
    title={place?.name ?? signal?.title} onPress={() => place ? onPlace(place) : signal && onSignal(signal)} zIndex={selected ? 45 : place ? 20 : 30}>
    <View style={[styles.target, { opacity: freshnessOpacity(place?.lastActivityUtc ?? signal?.createdAtUtc, now) }]}>
      <View style={[styles.mark, place ? styles.place : styles.signal, { backgroundColor: place ? colors.green : signalColors[signal!.signalType] ?? colors.coral }, selected && styles.selected]}>
        {place ? <PlaceSymbol category={place.category} color={colors.white} size={22} /> : <SignalSymbol type={signal!.signalType} color={colors.white} size={21} />}
      </View>
      {verified && <View style={styles.liveDot} />}
    </View>
  </Marker>;
});

export const BlinkrClusterMarker = memo(function BlinkrClusterMarker({ latitude, longitude, count, onPress }: { latitude: number; longitude: number; count: number; onPress: () => void }) {
  return <Marker coordinate={{ latitude, longitude }} onPress={onPress} zIndex={50} title={`${count} taze paylaşım`}>
    <View style={styles.cluster}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text><View style={styles.clusterDot} /></View>
  </Marker>;
});
const styles = StyleSheet.create({
  target: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 40, height: 40, borderColor: colors.white, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', ...shadowSoft },
  place: { borderRadius: 8 }, signal: { borderRadius: 22 }, selected: { borderColor: colors.lime, transform: [{ scale: 1.12 }] },
  liveDot: { backgroundColor: colors.lime, borderColor: colors.greenDark, borderWidth: 2, borderRadius: 6, width: 11, height: 11, position: 'absolute', right: 3, top: 3 },
  cluster: { height: 50, minWidth: 50, borderRadius: 25, borderColor: colors.lime, borderWidth: 3, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  count: { color: colors.white, fontSize: 15, fontWeight: '600' }, clusterDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.lime, marginTop: 2 },
});
