import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { freshnessOpacity } from '../productPresentation';
import {
  PLACE_PIN, PLACE_PIN_PATH, SIGNAL_BUBBLE, SIGNAL_BUBBLE_PATH, clusterHaloRadius, clusterLabel, lifetimeFraction, markerScale, ringDash, type MarkerGeometry,
} from '../markerGeometry';
import { categoryTone, colors, palette, signalInks, signalTints, typography } from '../theme';
import type { BlinkrPlace, CoordinateSignal } from '../types';
import { PlaceSymbol } from './PlaceSymbol';
import { SignalSymbol } from './SignalSymbol';

/*
 * Pure visuals of the map markers. They contain no react-native-maps import so they can also be
 * rendered by the browser review harness; `BlinkrMapMarker` wraps them in a native <Marker>.
 *
 * Design (see markerGeometry.ts):
 *  - plan-devam B9: pastel pins must not disappear on a light map, so every active pin has a 2 px outline in
 *    `pinBorder` (ink on light, chalk on dark) and a soft shadow; its fill is the signal type's tint and its icon
 *    the type's ink. A selected pin gets a white halo and grows to 1.2x.
 *  - Place = teardrop pin whose sharp tip is the exact location. With live, server-verified activity it is filled
 *    with the live signal type's tint and shows the place's category icon in the type's ink. A catalogue Place
 *    without activity is smaller and quiet (surface fill, soft outline), so the map stays readable.
 *  - Signal = round speech bubble with a tail. A ring around it drains as the signal ages, so freshness is
 *    visible without opening it.
 *  - Cluster = surface disc with an accent ring inside a halo that grows with the count.
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

const SELECTED_SCALE = 1.2;

function PlacePin({ place, selected }: { place: BlinkrPlace; selected: boolean }) {
  const g = PLACE_PIN;
  const tone = categoryTone(place.category);
  const state = place.currentState;
  const live = (state?.activeSignalCount ?? 0) > 0;
  const scale = markerScale(!live && !selected) * (selected ? SELECTED_SCALE : 1);
  const stateType = state?.signalType ?? null;
  const fill = live && stateType ? signalTints[stateType] ?? palette.sage300 : live ? palette.sage300 : SURFACE;
  const glyph = live && stateType ? signalInks[stateType] ?? colors.text : tone;
  const stroke = live || selected ? colors.pinBorder : colors.border;
  const uid = `${fill.replace('#', '')}${selected ? 's' : ''}`;
  return (
    <View style={{ height: g.height * scale, width: g.width * scale }}>
      <Frame geometry={g} scale={scale}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={`glow-${uid}`} r="50%">
            <Stop offset="0%" stopColor={colors.white} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={colors.white} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`body-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor={fill} />
            <Stop offset="100%" stopColor={fill} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        {selected ? <Circle cx={g.headX} cy={g.headY} fill={`url(#glow-${uid})`} r={g.headRadius + 9} /> : null}
        <Ellipse cx={g.tipX} cy={g.tipY} fill={palette.ink900} opacity={0.18} rx={8} ry={2.6} />
        <Path d={PLACE_PIN_PATH} fill={`url(#body-${uid})`} stroke={stroke} strokeLinejoin="round" strokeWidth={live || selected ? 2 : 1.5} />
        {live ? null : <Circle cx={g.headX} cy={g.headY} fill={SURFACE_HIGH} r={15} />}
      </Frame>
      <HeadGlyph geometry={g} scale={scale} size={22}><PlaceSymbol category={place.category} color={glyph} size={22 * scale} /></HeadGlyph>
      {live && stateType ? (
        <View style={[styles.badge, { backgroundColor: SURFACE, borderColor: colors.pinBorder, height: 22 * scale, left: (g.headX + g.pad + 13) * scale, top: (g.pad - 2) * scale, width: 22 * scale }]}>
          <SignalSymbol color={glyph} size={13 * scale} type={stateType} />
        </View>
      ) : null}
    </View>
  );
}

function SignalBubble({ signal, selected, now }: { signal: CoordinateSignal; selected: boolean; now: number }) {
  const g = SIGNAL_BUBBLE;
  const tint = signalTints[signal.signalType] ?? palette.stone;
  const ink = signalInks[signal.signalType] ?? palette.stoneInk;
  const remaining = lifetimeFraction(signal.createdAtUtc, signal.expiresAt, now);
  const ringRadius = g.headRadius + 3.5;
  const scale = selected ? SELECTED_SCALE : 1;
  const uid = `${tint.replace('#', '')}${selected ? 's' : ''}`;
  return (
    <View style={{ height: g.height * scale, width: g.width * scale }}>
      <Frame geometry={g} scale={scale}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={`signal-glow-${uid}`} r="50%">
            <Stop offset="0%" stopColor={colors.white} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={colors.white} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {selected ? <Circle cx={g.headX} cy={g.headY} fill={`url(#signal-glow-${uid})`} r={g.headRadius + 10} /> : null}
        <Ellipse cx={g.tipX} cy={g.tipY} fill={palette.ink900} opacity={0.18} rx={7} ry={2.4} />
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} stroke={colors.pinBorder} strokeOpacity={0.12} strokeWidth={3} />
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} rotation={-90} origin={`${g.headX}, ${g.headY}`} stroke={ink} strokeDasharray={ringDash(remaining, ringRadius)} strokeLinecap="round" strokeWidth={3} />
        <Path d={SIGNAL_BUBBLE_PATH} fill={tint} stroke={colors.pinBorder} strokeLinejoin="round" strokeWidth={2} />
      </Frame>
      <HeadGlyph geometry={g} scale={scale} size={24}><SignalSymbol color={ink} size={24 * scale} type={signal.signalType} /></HeadGlyph>
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
        <Circle cx={center} cy={center} fill={colors.surface} r={24} stroke={colors.pinBorder} strokeWidth={2} />
        <Circle cx={center} cy={center} fill="none" r={21} stroke={colors.primary} strokeWidth={2.4} />
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
  count: { ...typography.title, color: colors.text, fontVariant: ['tabular-nums'] },
});
