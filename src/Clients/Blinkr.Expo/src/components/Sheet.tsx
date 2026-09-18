import { useEffect, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

// In-tree host: no native Modal window can retain the map's gesture responder.
export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => back.remove();
  }, [onClose]);
  return <KeyboardAvoidingView accessibilityViewIsModal behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.host}>
    <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.backdrop} />
    {children}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
});
