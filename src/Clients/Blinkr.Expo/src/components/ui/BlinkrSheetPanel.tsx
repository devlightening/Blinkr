import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, spacing } from '../../theme';

type Props = {
  children: ReactNode;
  /**
   * Sheets grow with their content up to this share of the window height, then their content
   * scrolls. It is resolved to a number: a percentage max-height means nothing inside the
   * auto-height sheet host, which is how long sheets used to overflow the top of the screen.
   */
  maxHeightRatio?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The visual shell shared by every bottom sheet: dark surface, rounded top, drag handle and a
 * bottom padding that respects the home indicator. It is placed inside `<Sheet>`, which owns the
 * backdrop, back-button handling and the single-overlay lifecycle.
 */
export function BlinkrSheetPanel({ children, maxHeightRatio = 0.9, style }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = Math.round((height - insets.top) * maxHeightRatio);
  return (
    <View style={[styles.panel, { maxHeight, paddingBottom: Math.max(insets.bottom, spacing.lg) }, style]}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, ...shadow },
  handle: { alignSelf: 'center', backgroundColor: colors.lineStrong, borderRadius: 3, height: 5, marginBottom: spacing.md, width: 44 },
});
