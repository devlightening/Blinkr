import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { qrMatrix, qrRuns } from '../../qr';
import { colors } from '../../theme';

/** Quiet zone in modules around the code; scanners need it. */
const QUIET = 2;

/**
 * A QR code for a short text. Always dark modules on white in both themes (`onCreate` is dark in both): a light-on-dark
 * code is not read by many phone cameras.
 */
export function QrCode({ value, size, accessibilityLabel }: { value: string; size: number; accessibilityLabel?: string }) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const runs = useMemo(() => qrRuns(matrix), [matrix]);
  const modules = matrix.length + QUIET * 2;
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="image" style={{ height: size, width: size }}>
      <Svg height={size} viewBox={`0 0 ${modules} ${modules}`} width={size}>
        <Rect fill={colors.white} height={modules} width={modules} x={0} y={0} />
        {runs.map((run) => (
          <Rect fill={colors.onCreate} height={1} key={`${run.x}-${run.y}`} width={run.length} x={run.x + QUIET} y={run.y + QUIET} />
        ))}
      </Svg>
    </View>
  );
}
