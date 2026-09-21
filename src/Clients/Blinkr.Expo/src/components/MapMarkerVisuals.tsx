import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { freshnessOpacity } from '../productPresentation';
import {
  PLACE_PIN, PLACE_PIN_PATH, SIGNAL_BUBBLE, SIGNAL_BUBBLE_PATH, clusterHaloRadius, clusterLabel, lifetimeFraction, markerScale, ringDash, type MarkerGeometry,
} from '../markerGeometry';
import { categoryTone, colors, signalColors } from '../theme';
import type { BlinkrPlace, CoordinateSignal } from '../types';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';

/*
 * Pure visuals of the map markers. They contain no react-native-maps import so they can also be
 * rendered by the browser review harness; `BlinkrMapMarker` wraps them in a native <Marker>.
 *
 * Design (see markerGeometry.ts):
 *  - Place = teardrop pin whose sharp tip is the exact location. Three colours only: the category tone,
 *    the dark surface and the lime accent. A Place with live, server-verified activity is filled with its
 *    tone, has a soft glow and carries a small badge showing WHAT is happening (crowd, queue, ...).
 *    A catalogue Place without activity is smaller and quiet, so the map stays readable.
 *  - Signal = round speech bubble with a tail. A ring around it drains as the signal ages, so freshness is
 *    visible without opening it.
 *  - Cluster = dark disc with a lime ring inside a heat halo that grows with the count.
 */

const SURFACE = colors.surface;
const SURFACE_HIGH = colors.surfaceElevated;

function Frame({ geometry, scale, children }: { geometry: MarkerGeometry; scale: number; children: React.ReactNode }) {
  return (
    <Svg height={geometry.height * scale} viewBox={`${-geometry.pad} ${-geometry.pad} ${geometry.width} ${geometry.height}`} width={geometry.width * scale}>
      {children}
    </Svg>
  );
}

/** Glyph centred on the round head, drawn as a native view on top of the SVG. */
function HeadGlyph({ geometry, scale, size, children }: { geometry: MarkerGeometry; scale: number; size: number; children: React.ReactNode }) {
  const px = (value: number) => value * scale;
  return (
    <View pointerEvents="none" style={[styles.glyph, { height: px(size), left: px(geometry.headX + geometry.pad) - px(size) / 2, top: px(geometry.headY + geometry.pad) - px(size) / 2, width: px(size) }]}>
      {children}
    </View>
  );
}

function PlacePin({ place, selected }: { place: BlinkrPlace; selected: boolean }) {
  const g = PLACE_PIN;
  const tone = categoryTone(place.category);
  const state = place.currentState;
  const live = (state?.activeSignalCount ?? 0) > 0;
  const scale = markerScale(!live && !selected);
  const stateType = state?.signalType ?? null;
  const stateTone = stateType ? signalColors[stateType] ?? colors.primary : colors.primary;
  const stroke = selected ? colors.white : live ? colors.background : tone;
  const uid = `${tone.replace('#', '')}${selected ? 's' : ''}`;
  return (
    <View style={{ height: g.height * scale, width: g.width * scale }}>
      <Frame geometry={g} scale={scale}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={`glow-${uid}`} r="50%">
            <Stop offset="0%" stopColor={selected ? colors.primary : tone} stopOpacity={selected ? 0.3 : 0.16} />
            <Stop offset="100%" stopColor={tone} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`body-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor={tone} />
            <Stop offset="100%" stopColor={tone} stopOpacity={0.78} />
          </LinearGradient>
        </Defs>
        {live || selected ? <Circle cx={g.headX} cy={g.headY} fill={`url(#glow-${uid})`} r={g.headRadius + 9} /> : null}
        <Ellipse cx={g.tipX} cy={g.tipY} fill="#000000" opacity={0.35} rx={8} ry={2.6} />
        <Path d={PLACE_PIN_PATH} fill={live ? `url(#body-${uid})` : SURFACE} stroke={stroke} strokeLinejoin="round" strokeWidth={selected ? 3.2 : 2.6} />
        <Circle cx={g.headX} cy={g.headY} fill={live ? SURFACE : SURFACE_HIGH} r={live ? 15.5 : 15} />
      </Frame>
      <HeadGlyph geometry={g} scale={scale} size={22}><PlaceSymbol category={place.category} color={tone} size={22 * scale} /></HeadGlyph>
      {live && stateType ? (
        <View style={[styles.badge, { backgroundColor: stateTone, borderColor: colors.background, height: 22 * scale, left: (g.headX + g.pad + 13) * scale, top: (g.pad - 2) * scale, width: 22 * scale }]}>
          <SignalSymbol color={colors.ink} size={13 * scale} type={stateType} />
        </View>
      ) : live ? <View style={[styles.liveDot, { right: 9 * scale, top: 5 * scale }]} /> : null}
    </View>
  );
}

function SignalBubble({ signal, selected, now }: { signal: CoordinateSignal; selected: boolean; now: number }) {
  const g = SIGNAL_BUBBLE;
  const tone = signalColors[signal.signalType] ?? colors.coral;
  const remaining = lifetimeFraction(signal.createdAtUtc, signal.expiresAt, now);
  const ringRadius = g.headRadius + 3.5;
  const uid = `${tone.replace('#', '')}${selected ? 's' : ''}`;
  return (
    <View style={{ height: g.height, width: g.width }}>
      <Frame geometry={g} scale={1}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={`signal-glow-${uid}`} r="50%">
            <Stop offset="0%" stopColor={selected ? colors.primary : tone} stopOpacity={selected ? 0.3 : 0.14} />
            <Stop offset="100%" stopColor={tone} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={g.headX} cy={g.headY} fill={`url(#signal-glow-${uid})`} r={g.headRadius + 10} />
        <Ellipse cx={g.tipX} cy={g.tipY} fill="#000000" opacity={0.35} rx={7} ry={2.4} />
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={3} />
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} rotation={-90} origin={`${g.headX}, ${g.headY}`} stroke={tone} strokeDasharray={ringDash(remaining, ringRadius)} strokeLinecap="round" strokeWidth={3} />
        <Path d={SIGNAL_BUBBLE_PATH} fill={SURFACE} stroke={selected ? colors.white : tone} strokeLinejoin="round" strokeWidth={selected ? 3 : 2.2} />
        <Circle cx={g.headX} cy={g.headY} fill={SURFACE_HIGH} r={g.headRadius - 6} />
      </Frame>
      <HeadGlyph geometry={g} scale={1} size={24}><SignalSymbol color={tone} size={24} type={signal.signalType} /></HeadGlyph>
    </View>
  );
}

/** A Place pin or a signal bubble. Older information fades (freshnessOpacity); the tip is the location. */
export function MarkerVisual({ place, signal, selected, now }: { place?: BlinkrPlace; signal?: CoordinateSignal; selected: boolean; now: number }) {
  return (
    <View style={{ opacity: selected ? 1 : freshnessOpacity(place?.lastActivityUtc ?? signal?.createdAtUtc, now) }}>
      {place ? <PlacePin place={place} selected={selected} /> : signal ? <SignalBubble now={now} selected={selected} signal={signal} /> : null}
    </View>
  );
}

const CLUSTER_SIZE = 96;

export function ClusterVisual({ count }: { count: number }) {
  const halo = clusterHaloRadius(count);
  const center = CLUSTER_SIZE / 2;
  return (
    <View style={styles.clusterTarget}>
      <Svg height={CLUSTER_SIZE} width={CLUSTER_SIZE}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id="heat" r="50%">
            <Stop offset="35%" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={center} cy={center} fill="url(#heat)" r={halo + 8} />
        <Circle cx={center} cy={center} fill={colors.background} r={24} stroke={colors.primary} strokeWidth={3.2} />
        <Circle cx={center} cy={center} fill="none" r={29} stroke={colors.primary} strokeOpacity={0.3} strokeWidth={1.5} />
      </Svg>
      <View pointerEvents="none" style={styles.clusterCount}><Text style={styles.count}>{clusterLabel(count)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  badge: { alignItems: 'center', borderRadius: 999, borderWidth: 2, justifyContent: 'center', position: 'absolute' },
  liveDot: { backgroundColor: colors.primary, borderColor: colors.background, borderRadius: 7, borderWidth: 2, height: 14, position: 'absolute', width: 14 },
  clusterTarget: { alignItems: 'center', height: CLUSTER_SIZE, justifyContent: 'center', width: CLUSTER_SIZE },
  clusterCount: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  count: { color: colors.white, fontSize: 19, fontWeight: '800' },
});
