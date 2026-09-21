import * as Haptics from 'expo-haptics';
import { ArrowRight, Eye, EyeOff, Radio, ShieldCheck } from 'lucide-react-native';
import { BlinkrMark } from './BlinkrMark';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { authenticate } from '../api';
import { friendlyError } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, motion, radii } from '../theme';
import type { AuthResponse } from '../types';

type Props = {
  onAuthenticated: (auth: AuthResponse) => void;
};


export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const auth = await authenticate(mode, { userName, email, password });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAuthenticated(auth);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(motion.sheet)} style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <BlinkrMark size={26} />
              </View>
              <Text style={styles.brand}>blinkr</Text>
              </View>

            <View style={styles.intro}>
              <Text style={styles.eyebrow}>Yakınında, şimdi</Text>
              <Text style={styles.title}>Gitmeden önce bil.</Text>
              <Text style={styles.subtitle}>Çevrendeki yerlerin canlı durumunu haritadan keşfet.</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(motion.sheet).delay(60)} style={styles.formPanel}>
            <View style={styles.segment}>
              <AnimatedPressable
                onPress={() => setMode('register')}
                pressScale={0.98}
                style={[styles.segmentItem, mode === 'register' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Yeni hesap
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setMode('login')}
                pressScale={0.98}
                style={[styles.segmentItem, mode === 'login' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  Giriş yap
                </Text>
              </AnimatedPressable>
            </View>

            {mode === 'register' && (
              <View style={styles.field}>
                <Text style={styles.label}>Kullanıcı adı</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setUserName}
                  placeholder="ornek_kullanici"
                  placeholderTextColor={colors.mutedSoft}
                  style={styles.input}
                  value={userName}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="sen@ornek.com"
                placeholderTextColor={colors.mutedSoft}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Şifre</Text>
              <View style={styles.passwordField}>
                <TextInput
                  onChangeText={setPassword}
                  placeholder="Şifren"
                  placeholderTextColor={colors.mutedSoft}
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <AnimatedPressable
                  accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  hitSlop={10}
                  onPress={() => setShowPassword((value) => !value)}
                  pressScale={0.85}
                >
                  {showPassword
                    ? <EyeOff color={colors.muted} size={20} />
                    : <Eye color={colors.muted} size={20} />}
                </AnimatedPressable>
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <AnimatedPressable
              disabled={isLoading || !email || !password || (mode === 'register' && !userName)}
              onPress={submit}
              pressScale={0.95}
              style={[
                styles.primaryButton,
                (isLoading || !email || !password || (mode === 'register' && !userName)) && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{mode === 'register' ? 'Blinkr’a katıl' : 'Haritayı aç'}</Text>
                  <ArrowRight color={colors.ink} size={20} strokeWidth={2.5} />
                </>
              )}
            </AnimatedPressable>

            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.green} size={18} />
              <Text style={styles.privacyText}>Konumun yalnızca sen paylaşmayı seçtiğinde kullanılır.</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1 },
  hero: { backgroundColor: colors.background, minHeight: 260, paddingBottom: 28, paddingHorizontal: 22, paddingTop: 18 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandMark: {
    alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.control, height: 38,
    justifyContent: 'center', width: 38,
  },
  brand: { color: colors.white, fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  intro: { marginTop: 40 },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  title: { color: colors.white, fontSize: 30, fontWeight: '700', letterSpacing: -0.3, lineHeight: 36, marginTop: 6 },
  subtitle: { color: colors.mutedOnDark, fontSize: 15, lineHeight: 21, marginTop: 8, maxWidth: 320 },
  formPanel: { backgroundColor: colors.surface, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, flex: 1, marginTop: -radii.panel / 3, paddingBottom: 24, paddingHorizontal: 22, paddingTop: 28 },
  segment: {
    backgroundColor: colors.surfaceSoft, borderRadius: radii.control, flexDirection: 'row', height: 44, padding: 3,
  },
  segmentItem: { alignItems: 'center', borderRadius: radii.control - 4, flex: 1, justifyContent: 'center' },
  segmentItemActive: { backgroundColor: colors.surfaceElevated },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  field: { marginTop: 18 },
  label: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radii.control, borderWidth: 1,
    color: colors.textPrimary, fontSize: 15, minHeight: 48, paddingHorizontal: 14,
  },
  passwordField: {
    alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line,
    borderRadius: radii.control, borderWidth: 1, flexDirection: 'row', minHeight: 48, paddingRight: 14,
  },
  passwordInput: { color: colors.textPrimary, flex: 1, fontSize: 15, paddingHorizontal: 14 },
  error: {
    backgroundColor: colors.errorSoft, borderRadius: radii.control, color: colors.error,
    fontSize: 13, lineHeight: 18, marginTop: 14, padding: 12,
  },
  primaryButton: {
    alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.control, flexDirection: 'row',
    gap: 10, justifyContent: 'center', marginTop: 20, minHeight: 50, paddingHorizontal: 18,
  },
  primaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  privacyRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  privacyText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
});
