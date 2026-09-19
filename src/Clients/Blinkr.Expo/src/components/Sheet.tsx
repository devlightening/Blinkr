import { useEffect, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

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
      entering={SlideInDown.springify()
        .damping(springs.bouncy.damping)
        .stiffness(springs.bouncy.stiffness)
        .mass(springs.bouncy.mass)}
      exiting={SlideOutDown.duration(200)}
    >
      {children}
    </Animated.View>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
});
