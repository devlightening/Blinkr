import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import { lensAfterSwipe, lensById } from '../../cameraEffects';
import { colors, radii, spacing, typography } from '../../theme';

/** How long the lens name stays in the middle after a swipe (sinyal-mvp-plan 05 §1.2: "filtre adı 1 sn ortada"). */
const NAME_MS = 1000;

/**
 * Horizontal swipe over the picture to change lens, with the new lens's name shown briefly in the middle.
 * Returns a pan gesture to compose with others and the label element to render over the picture.
 */
export function useLensSwipe(lensId: string, onChange: (id: string) => void, disabled = false) {
  const [shownName, setShownName] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ lensId, onChange, disabled });
  latest.current = { lensId, onChange, disabled };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const gesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-24, 24])
    .onEnd((event) => {
      const { lensId: current, onChange: change, disabled: off } = latest.current;
      if (off) return;
      const next = lensAfterSwipe(current, event.translationX);
      if (next === current) return;
      change(next);
      void Haptics.selectionAsync().catch(() => {});
      setShownName(lensById(next).label);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShownName(null), NAME_MS);
    }), []);

  const label = shownName ? (
    <View pointerEvents="none" style={styles.wrap}>
      <Text accessibilityLiveRegion="polite" style={styles.name} testID="lens-name">{shownName}</Text>
    </View>
  ) : null;

  return { gesture, label };
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  name: { ...typography.title, backgroundColor: 'rgba(0, 0, 0, 0.35)', borderRadius: radii.pill, color: colors.text, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
