import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isEstimated, type LiveState } from '../../live/liveState';
import { pinTagParts } from '../../live/liveLabels';
import { LIVE_PIN, livePinSize } from '../../markerGeometry';
import { colors, liveColors, typography, withAlpha } from '../../theme';
import { PlaceSymbol } from '../PlaceSymbol';
import { LiveRing } from './LiveRing';

const { pad: PAD, tagGap: TAG_GAP, tagHeight: TAG_HEIGHT } = LIVE_PIN;

/**
 * A place on the map (v4 brief §3.1): ring + category icon, and "Sakin · 4 dk" under it. Rendered into a native marker
 * bitmap (tracksViewChanges={false}), so nothing here animates; the caller changes the marker `key` when the state,
 * the ring step, the selection or the tag changes.
 */
export const LivePin = memo(function LivePin({ state, category, selected, showTag }: {
  state: LiveState; category?: string | null; selected: boolean; showTag: boolean;
}) {
  const quiet = state.source === 'none';
  const size = livePinSize(quiet, selected);
  const color = quiet ? colors.textSecondary : liveColors[state.kind];
  const estimated = isEstimated(state);
  const { state: word, age } = pinTagParts(state);
  const tag = showTag && word.length > 0;
  return (
    <View collapsable={false} style={[styles.wrap, { opacity: quiet && !selected ? 0.85 : 1 }]}>
      <View style={{ height: size, width: size }}>
        {!quiet ? <View style={[styles.glow, { backgroundColor: withAlpha(liveColors[state.kind], selected ? 0.3 : 0.18), borderRadius: size }]} /> : null}
        <LiveRing estimated={estimated} freshness={state.freshness} kind={state.kind} size={size}>
          <PlaceSymbol category={category} color={color} size={Math.round(size * 0.42)} />
        </LiveRing>
      </View>
      {tag ? (
        <View style={[styles.tag, { borderColor: withAlpha(liveColors[state.kind], estimated ? 0.45 : 0.75), borderStyle: estimated ? 'dashed' : 'solid' }]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.tagText, { color: liveColors[state.kind] }]}>{word}</Text>
          {age ? <Text allowFontScaling={false} numberOfLines={1} style={styles.tagAge}>{age}</Text> : null}
        </View>
      ) : null}
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
