import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, gradientDirection, gradients } from '../../theme';

type Props = {
  /** Outer diameter, ring included. */
  size: number;
  /** Seen stories and inactive states get a flat grey ring instead of the brand gradient. */
  seen?: boolean;
  /** No ring at all (keeps the same footprint so rows line up). */
  hidden?: boolean;
  thickness?: number;
  /** The gap between ring and content, drawn in this colour (the surface behind it). */
  gapColor?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Instagram-style ring (V2 D-024): brand gradient for something new (unseen story, active profile tab), flat grey when
 * seen. The child (usually an Avatar) is inset by `thickness` + the same gap, so rings never touch the face.
 */
export function GradientRing({ size, seen = false, hidden = false, thickness = 2.5, gapColor = colors.background, children, style, testID }: Props) {
  const inner = size - thickness * 2;
  return (
    <View style={[{ height: size, width: size }, style]} testID={testID}>
      {hidden ? null : (
        <LinearGradient
          colors={seen ? gradients.storySeen : gradients.story}
          end={gradientDirection.end}
          pointerEvents="none"
          start={gradientDirection.start}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      )}
      <View style={[styles.gap, { backgroundColor: gapColor, borderRadius: inner / 2, height: inner, left: thickness, top: thickness, width: inner }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'absolute' },
});
