import * as Haptics from 'expo-haptics';
import { ArrowRight, Eye, EyeOff, Radio, ShieldCheck, X } from 'lucide-react-native';
import { BlinkrMark } from './BlinkrMark';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { checkBirthYear } from '../ageGate';
import type { LegalDocId } from '../legalContent';
import { LegalDocView } from './LegalDocView';
import { friendlyError } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { colors, motion, radii, typography } from '../theme';
import { passwordLongEnough } from '../authErrors';
import type { AuthResponse } from '../types';
import { tx } from '../i18n/tx';

type Props = {
  onAuthenticated: (auth: AuthResponse) => void;
};


export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  // The terms and guidelines open over the form (plan-devam F7: the EULA is accepted at sign-up, with the texts one tap away).
  const [legal, setLegal] = useState<LegalDocId | null>(null);
  const { t } = useTranslation('common');
  const age = checkBirthYear(birthYear);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const auth = await authenticate(mode, mode === 'register' ? { userName, email, password, birthYear: age.year } : { userName, email, password });
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
              <Text style={styles.eyebrow}>{tx('common:auth.eyebrow', 'Yakınında, şimdi')}</Text>
              <Text style={styles.title}>{tx('common:auth.title', 'Gitmeden önce bil.')}</Text>
              <Text style={styles.subtitle}>{tx('common:auth.subtitle', 'Çevrendeki yerlerin canlı durumunu haritadan keşfet.')}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(motion.sheet).delay(60)} style={styles.formPanel}>
            <View style={styles.segment}>
              <AnimatedPressable
                accessibilityRole="tab"
                aria-selected={mode === 'register'}
                onPress={() => setMode('register')}
                pressScale={0.98}
                style={[styles.segmentItem, mode === 'register' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  {tx('common:auth.newAccount', 'Yeni hesap')}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                accessibilityRole="tab"
                aria-selected={mode === 'login'}
                onPress={() => setMode('login')}
                pressScale={0.98}
                style={[styles.segmentItem, mode === 'login' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  {tx('common:auth.signIn', 'Giriş yap')}
                </Text>
              </AnimatedPressable>
            </View>

            {mode === 'register' && (
              <View style={styles.field}>
                <Text style={styles.label}>{tx('common:auth.username', 'Kullanıcı adı')}</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setUserName}
                  placeholder={tx('common:auth.usernamePlaceholder', 'ornek_kullanici')}
                  placeholderTextColor={colors.mutedSoft}
                  style={styles.input}
                  value={userName}
                />
              </View>
            )}

            {mode === 'register' && (
              <View style={styles.field}>
                <Text style={styles.label}>{t('auth.birthYear')}</Text>
                <TextInput
                  accessibilityLabel={t('auth.birthYear')}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => setBirthYear(value.replace(/[^0-9]/g, ''))}
                  placeholder="2000"
                  placeholderTextColor={colors.mutedSoft}
                  style={styles.input}
                  testID="birth-year"
                  value={birthYear}
                />
                <Text style={[styles.hint, age.problem && age.problem !== 'empty' && styles.hintError]} testID="birth-year-hint">
                  {age.problem === 'tooYoung' ? t('auth.tooYoung') : age.problem === 'invalid' ? t('auth.invalidYear') : age.minor ? t('auth.minorNote') : t('auth.birthYearHint')}
                </Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>{tx('common:auth.email', 'E-posta')}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={tx('common:auth.emailPlaceholder', 'sen@ornek.com')}
                placeholderTextColor={colors.mutedSoft}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{tx('common:auth.password', 'Şifre')}</Text>
              <View style={styles.passwordField}>
                <TextInput
                  onChangeText={setPassword}
                  placeholder={tx('common:auth.passwordPlaceholder', 'Şifren')}
                  placeholderTextColor={colors.mutedSoft}
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  testID="password-input"
                  value={password}
                />
                <AnimatedPressable
                  accessibilityLabel={showPassword ? tx('common:auth.hidePassword', 'Şifreyi gizle') : tx('common:auth.showPassword', 'Şifreyi göster')}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setShowPassword((value) => !value)}
                  pressScale={0.85}
                >
                  {showPassword
                    ? <EyeOff color={colors.muted} size={20} />
                    : <Eye color={colors.muted} size={20} />}
                </AnimatedPressable>
              </View>
              {mode === 'register' ? (
                <Text style={[styles.passwordHint, password.length > 0 && !passwordLongEnough(password) && styles.passwordHintShort]} testID="password-hint">
                  {tx('common:auth.passwordRule', 'En az 8 karakter')}
                </Text>
              ) : null}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            {mode === 'register' ? (
              <Text style={styles.terms} testID="auth-terms">
                {t('auth.termsBefore')}
                <Text accessibilityRole="link" onPress={() => setLegal('terms')} style={styles.termsLink}>{t('auth.termsLink')}</Text>
                {t('auth.termsMiddle')}
                <Text accessibilityRole="link" onPress={() => setLegal('community')} style={styles.termsLink}>{t('auth.communityLink')}</Text>
                {t('auth.termsAfter')}
              </Text>
            ) : null}

            <AnimatedPressable
              accessibilityLabel={mode === 'register' ? tx('common:auth.join', 'Blinkr’a katıl') : tx('common:auth.openMap', 'Haritayı aç')}
              accessibilityRole="button"
              aria-disabled={isLoading || !email || !password || (mode === 'register' && (!userName || age.problem !== null || !passwordLongEnough(password)))}
              disabled={isLoading || !email || !password || (mode === 'register' && (!userName || age.problem !== null || !passwordLongEnough(password)))}
              onPress={submit}
              pressScale={0.95}
              style={[
                styles.primaryButton,
                (isLoading || !email || !password || (mode === 'register' && (!userName || age.problem !== null || !passwordLongEnough(password)))) && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>{mode === 'register' ? tx('common:auth.join', 'Blinkr’a katıl') : tx('common:auth.openMap', 'Haritayı aç')}</Text>
                  <ArrowRight color={colors.ink} size={20} strokeWidth={2.5} />
                </>
              )}
            </AnimatedPressable>

            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.green} size={18} />
              <Text style={styles.privacyText}>{tx('common:auth.locationNote', 'Konumun yalnızca sen paylaşmayı seçtiğinde kullanılır.')}</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {legal ? (
        <View style={styles.legalLayer} testID="auth-legal">
          <View style={styles.legalBar}>
            <AnimatedPressable accessibilityLabel={t('auth.closeLegal')} accessibilityRole="button" onPress={() => setLegal(null)} pressScale={0.9} style={styles.legalClose}>
              <X color={colors.textPrimary} size={22} />
            </AnimatedPressable>
          </View>
          <ScrollView contentContainerStyle={styles.legalContent}>
            <LegalDocView id={legal} />
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  passwordHint: { ...typography.caption, color: colors.muted, marginTop: 4 },
  passwordHintShort: { color: colors.error },
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
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 6 },
  hintError: { color: colors.danger },
  terms: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 14 },
  termsLink: { color: colors.textPrimary, fontWeight: '700', textDecorationLine: 'underline' },
  legalLayer: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 10 },
  legalBar: { alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8 },
  legalClose: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  legalContent: { paddingBottom: 40, paddingHorizontal: 20 },
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
