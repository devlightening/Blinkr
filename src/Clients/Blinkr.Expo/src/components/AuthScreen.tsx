import * as Haptics from 'expo-haptics';
import { ArrowRight, Eye, EyeOff, Radio, ShieldCheck } from 'lucide-react-native';
import { BlinkrMark } from './BlinkrMark';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticate } from '../api';
import { friendlyError } from '../productPresentation';
import { colors, shadowSoft } from '../theme';
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
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <BlinkrMark size={32} />
              </View>
              <Text style={styles.brand}>blinkr</Text>
              <View style={styles.livePill}>
                <Radio color={colors.lime} size={13} strokeWidth={2.8} />
                <Text style={styles.livePillText}>CANLI</Text>
              </View>
            </View>

            <View style={styles.intro}>
              <Text style={styles.eyebrow}>YAKININDA · ŞİMDİ</Text>
              <Text style={styles.title}>Gitmeden önce bil.</Text>
              <Text style={styles.subtitle}>Çevrendeki yerlerin canlı durumunu haritadan keşfet.</Text>
            </View>
          </View>

          <View style={styles.formPanel}>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setMode('register')}
                style={[styles.segmentItem, mode === 'register' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Yeni hesap
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('login')}
                style={[styles.segmentItem, mode === 'login' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  Giriş yap
                </Text>
              </Pressable>
            </View>

            {mode === 'register' && (
              <View style={styles.field}>
                <Text style={styles.label}>Kullanıcı adı</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setUserName}
                  placeholder="ornek_kullanici"
                  placeholderTextColor="#919A94"
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
                placeholderTextColor="#919A94"
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
                  placeholderTextColor="#919A94"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  hitSlop={10}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  {showPassword
                    ? <EyeOff color={colors.muted} size={20} />
                    : <Eye color={colors.muted} size={20} />}
                </Pressable>
              </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              disabled={isLoading || !email || !password || (mode === 'register' && !userName)}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
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
            </Pressable>

            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.green} size={18} />
              <Text style={styles.privacyText}>Konumun yalnızca sen paylaşmayı seçtiğinde kullanılır.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.ink, flex: 1 },
  content: { flexGrow: 1 },
  hero: { backgroundColor: colors.ink, minHeight: 300, paddingBottom: 30, paddingHorizontal: 22, paddingTop: 18 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandMark: {
    alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 42,
    justifyContent: 'center', width: 42,
  },
  brand: { color: colors.white, fontSize: 25, fontWeight: '600', letterSpacing: 0 },
  livePill: { alignItems: 'center', borderColor: '#3B4941', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, marginLeft: 'auto', paddingHorizontal: 9, paddingVertical: 6 },
  livePillText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  intro: { marginTop: 48 },
  eyebrow: { color: colors.lime, fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  title: { color: colors.white, fontSize: 38, fontWeight: '600', lineHeight: 43, marginTop: 9 },
  subtitle: { color: '#BCC7C0', fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 320 },
  formPanel: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, flex: 1, marginTop: -8, paddingBottom: 24, paddingHorizontal: 22, paddingTop: 24 },
  segment: {
    backgroundColor: colors.surfaceSoft, borderRadius: 8, flexDirection: 'row', height: 48, padding: 4,
  },
  segmentItem: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center' },
  segmentItemActive: { backgroundColor: colors.surface, ...shadowSoft },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: colors.ink },
  field: { marginTop: 18 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 8, borderWidth: 1,
    color: colors.ink, fontSize: 15, minHeight: 52, paddingHorizontal: 15,
  },
  passwordField: {
    alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.line,
    borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingRight: 15,
  },
  passwordInput: { color: colors.ink, flex: 1, fontSize: 15, paddingHorizontal: 15 },
  error: {
    backgroundColor: colors.errorSoft, borderRadius: 8, color: colors.error,
    fontSize: 13, lineHeight: 18, marginTop: 14, padding: 12,
  },
  primaryButton: {
    alignItems: 'center', backgroundColor: colors.lime, borderColor: colors.ink, borderRadius: 8, borderWidth: 2, flexDirection: 'row',
    gap: 10, justifyContent: 'center', marginTop: 20, minHeight: 54, paddingHorizontal: 18, ...shadowSoft,
  },
  primaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.6 },
  privacyRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  privacyText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
});
