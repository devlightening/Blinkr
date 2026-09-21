import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { lensChangesPicture, type CameraLens } from '../../cameraEffects';

/**
 * The colour treatment of a lens, drawn over the camera preview and over the captured photo.
 * It never blocks touches, and the same component is used for both so what you see is what is saved.
 */
export function FilterOverlay({ lens }: { lens: CameraLens }) {
  if (!lensChangesPicture(lens)) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lens.layers.map((layer, index) => (
        <View key={`${layer.color}-${index}`} style={[StyleSheet.absoluteFill, { backgroundColor: layer.color, opacity: layer.opacity }]} />
      ))}
      {lens.vignette ? (
        <Svg height="100%" width="100%">
          <Defs>
            <RadialGradient cx="50%" cy="50%" id={`vignette-${lens.id}`} r="75%">
              <Stop offset="55%" stopColor="#000000" stopOpacity={0} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={lens.vignette} />
            </RadialGradient>
          </Defs>
          <Rect fill={`url(#vignette-${lens.id})`} height="100%" width="100%" x="0" y="0" />
        </Svg>
      ) : null}
    </View>
  );
}
