import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { freshnessOpacity } from '../productPresentation';
import { SIGNAL_BUBBLE, SIGNAL_BUBBLE_PATH, lifetimeFraction, ringDash, type MarkerGeometry } from '../markerGeometry';
import { colors, palette, signalInks, signalTints } from '../theme';
import type { CoordinateSignal } from '../types';
import { signalEmoji } from '../signalEmoji';

/*
 * The coordinate-signal bubble (places are drawn by live/LivePin, clusters by live/ClusterRing). No react-native-maps
 * import, so the browser review harness can render it; `BlinkrMapMarker` wraps it in a native <Marker>. Round speech
 * bubble with a tail and the signal's emote; a ring around it drains as the signal ages; white outline + soft shadow
 * so pastel bubbles stay visible on a light map (plan-devam B9). A selected bubble gets a white halo and grows to 1.2x.
 */

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
/** Pin and cluster outline: white in both themes - it reads as a soft sticker on any map colour. */
const PIN_OUTLINE = palette.white;

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
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} stroke={PIN_OUTLINE} strokeOpacity={0.9} strokeWidth={3} />
        <Circle cx={g.headX} cy={g.headY} fill="none" r={ringRadius} rotation={-90} origin={`${g.headX}, ${g.headY}`} stroke={ink} strokeDasharray={ringDash(remaining, ringRadius)} strokeLinecap="round" strokeWidth={3} />
        <G opacity={0.16} transform="translate(0, 2)"><Path d={SIGNAL_BUBBLE_PATH} fill={palette.ink900} /></G>
        <Path d={SIGNAL_BUBBLE_PATH} fill={tint} stroke={PIN_OUTLINE} strokeLinejoin="round" strokeWidth={2.5} />
      </Frame>
      <HeadGlyph geometry={g} scale={scale} size={26}><Text allowFontScaling={false} style={{ fontSize: 21 * scale, lineHeight: 26 * scale }}>{signalEmoji(signal.signalType, signal.signalValue)}</Text></HeadGlyph>
    </View>
  );
}

/** A coordinate signal's bubble (places use LivePin). Older information fades (freshnessOpacity); the tip is the location. */
export function MarkerVisual({ signal, selected, now }: { signal: CoordinateSignal; selected: boolean; now: number }) {
  return (
    <View style={{ opacity: selected ? 1 : freshnessOpacity(signal.createdAtUtc, now) }}>
      <SignalBubble now={now} selected={selected} signal={signal} />
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
});
