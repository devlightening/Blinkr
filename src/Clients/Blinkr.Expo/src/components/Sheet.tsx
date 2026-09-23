import { useEffect, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ReduceMotion } from 'react-native-reanimated';

import { colors, springs } from '../theme';

// In-tree host: no native Modal window can retain the map's gesture responder.
export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => back.remove();
  }, [onClose]);
  return <KeyboardAvoidingView accessibilityViewIsModal behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.host}>
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.backdrop} />
    </Animated.View>
    <Animated.View
      // Calm spring: a sheet that overshoots upwards would flash a gap under itself. Reduce motion is respected.
      entering={SlideInDown.springify()
        .damping(springs.gentle.damping)
        .stiffness(springs.gentle.stiffness)
        .mass(springs.gentle.mass)
        .reduceMotion(ReduceMotion.System)}
      exiting={SlideOutDown.duration(200).reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
});
