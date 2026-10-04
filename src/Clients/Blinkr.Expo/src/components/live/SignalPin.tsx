import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { signalTagParts } from '../../live/liveLabels';
import type { LiveState } from '../../live/liveState';
import { LIVE_PIN, livePinSize } from '../../markerGeometry';
import { colors, liveColors, typography, withAlpha } from '../../theme';
import type { SignalType } from '../../types';
import { SignalSymbol } from '../SignalSymbol';
import { LiveRing } from './LiveRing';

const { pad: PAD, tagGap: TAG_GAP, tagHeight: TAG_HEIGHT } = LIVE_PIN;

/**
 * A coordinate signal on the map ("Sinyaller" mode) in the same language as a place: ring (state colour, arc = freshness,
 * an event wears the brand-gradient ring) + the signal type's icon + a worded tag ("Kalabalık · 6 dk", "Gözlem · 2 sa").
 * Bitmap content of a native marker: nothing animates; the caller keys the marker by what is drawn.
 */
export const SignalPin = memo(function SignalPin({ state, type, selected }: { state: LiveState; type: SignalType; selected: boolean }) {
  const size = livePinSize(false, selected);
  const color = liveColors[state.kind];
  const { state: word, age } = signalTagParts(state);
  return (
    <View collapsable={false} style={styles.wrap}>
      <View style={{ height: size, width: size }}>
        <View style={[styles.glow, { backgroundColor: withAlpha(color, selected ? 0.3 : 0.18), borderRadius: size }]} />
        <LiveRing freshness={state.freshness} kind={state.kind} size={size}>
          <SignalSymbol color={color} size={Math.round(size * 0.42)} type={type} />
        </LiveRing>
      </View>
      <View style={[styles.tag, { borderColor: withAlpha(color, 0.75) }]}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.tagText, { color }]}>{word}</Text>
        {age ? <Text allowFontScaling={false} numberOfLines={1} style={styles.tagAge}>{age}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: PAD },
  glow: { bottom: -5, left: -5, position: 'absolute', right: -5, top: -5 },
  tag: {
    alignItems: 'center', backgroundColor: colors.surface, borderRadius: TAG_HEIGHT / 2, borderWidth: 1, flexDirection: 'row', gap: 4,
    height: TAG_HEIGHT, marginTop: TAG_GAP, paddingHorizontal: 7,
  },
  tagText: { ...typography.micro, fontWeight: '800' },
  tagAge: { ...typography.micro, color: colors.text, fontWeight: '700' },
});
