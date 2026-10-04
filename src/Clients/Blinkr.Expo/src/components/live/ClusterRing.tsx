import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { ClusterMix } from '../../mapClusters';
import { clusterLabel } from '../../markerGeometry';
import { colors, liveColors, liveRingStroke, typography, withAlpha } from '../../theme';

/**
 * A map cluster (v4 brief §1): slices of calm / busy / crowded / other in proportion to the real counts, the count in
 * the middle. A neighbourhood's mood reads without zooming. Drawn inside a native marker (bitmap): no animation.
 */
export const ClusterRing = memo(function ClusterRing({ mix, count, size = 52 }: { mix: ClusterMix; count: number; size?: number }) {
  const total = Math.max(1, mix.calm + mix.busy + mix.crowded + mix.other);
  const stroke = liveRingStroke + 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = [
    { n: mix.calm, color: liveColors.calm },
    { n: mix.busy, color: liveColors.busy },
    { n: mix.crowded, color: liveColors.crowded },
    { n: mix.other, color: withAlpha(liveColors.unknown, 0.55) },
  ].filter((p) => p.n > 0);
  const gap = parts.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View style={[styles.wrap, { height: size, width: size }]}>
      <View style={[styles.core, { backgroundColor: colors.surface, borderRadius: size / 2 }]} />
      <Svg height={size} style={[StyleSheet.absoluteFill, styles.startAtTop]} width={size}>
        {parts.map((p, i) => {
          const len = (p.n / total) * c;
          const el = (
            <Circle
              cx={size / 2} cy={size / 2} fill="none" key={i} r={r}
              stroke={p.color} strokeDasharray={`${Math.max(0.5, len - gap)} ${c}`} strokeDashoffset={-offset} strokeWidth={stroke}
            />
          );
          offset += len;
          return el;
        })}
      </Svg>
      <Text allowFontScaling={false} style={styles.count}>{clusterLabel(count)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  core: { ...StyleSheet.absoluteFill, margin: 2 },
  // Arcs start at 3 o'clock; turning the drawing starts the first slice at 12.
  startAtTop: { transform: [{ rotate: '-90deg' }] },
  count: { ...typography.heading, color: colors.text, fontVariant: ['tabular-nums'] },
});
