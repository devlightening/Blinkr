import * as Haptics from 'expo-haptics';
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck } from 'lucide-react-native';
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

import { API_BASE_URL, authenticate } from '../api';
import { colors } from '../theme';
import type { AuthResponse } from '../types';

type Props = {
  onAuthenticated: (auth: AuthResponse) => void;
};

const makeSeed = () => Math.floor(Math.random() * 1_000_000);

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [seed] = useState(makeSeed);
  const [userName, setUserName] = useState(`gezgin_${seed}`);
  const [email, setEmail] = useState(`cihaz_${seed}@blinkr.local`);
  const [password, setPassword] = useState('Passw0rd!CoreLoop');
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
      setError(err instanceof Error ? err.message : 'Oturum açılamadı.');
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
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MapPin color={colors.ink} fill={colors.lime} size={23} strokeWidth={2.5} />
            </View>
            <Text style={styles.brand}>blinkr</Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>YAKININDA, ŞİMDİ</Text>
            <Text style={styles.title}>Bir yere gitmeden önce, orada ne olduğunu gör.</Text>
            <Text style={styles.subtitle}>
              Çevrendeki taze sinyalleri keşfet, kararını gerçek insanlardan gelen güncel bilgiyle ver.
            </Text>
          </View>

          <View style={styles.form}>
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
                isLoading && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {mode === 'register' ? 'Hesabı oluştur' : 'Haritayı aç'}
                  </Text>
                  <ArrowRight color={colors.white} size={20} strokeWidth={2.5} />
                </>
              )}
            </Pressable>

            <View style={styles.privacyRow}>
              <ShieldCheck color={colors.green} size={18} />
              <Text style={styles.privacyText}>Konumun yalnızca sen paylaşmayı seçtiğinde kullanılır.</Text>
            </View>
          </View>

          <Text style={styles.connection} numberOfLines={1}>Gateway · {API_BASE_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.surfaceSoft, flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 18 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandMark: {
    alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, height: 42,
    justifyContent: 'center', width: 42,
  },
  brand: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: 0 },
  intro: { marginTop: 44 },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: '900', letterSpacing: 0 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', lineHeight: 39, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 14 },
  form: { marginTop: 34 },
  segment: {
    backgroundColor: '#E8ECE9', borderRadius: 8, flexDirection: 'row', height: 48, padding: 4,
  },
  segmentItem: { alignItems: 'center', borderRadius: 6, flex: 1, justifyContent: 'center' },
  segmentItemActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: colors.ink },
  field: { marginTop: 18 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: {
    backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1,
    color: colors.ink, fontSize: 15, minHeight: 52, paddingHorizontal: 15,
  },
  passwordField: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line,
    borderRadius: 8, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingRight: 15,
  },
  passwordInput: { color: colors.ink, flex: 1, fontSize: 15, paddingHorizontal: 15 },
  error: {
    backgroundColor: colors.errorSoft, borderRadius: 8, color: colors.error,
    fontSize: 13, lineHeight: 18, marginTop: 14, padding: 12,
  },
  primaryButton: {
    alignItems: 'center', backgroundColor: colors.green, borderRadius: 8, flexDirection: 'row',
    gap: 10, justifyContent: 'center', marginTop: 20, minHeight: 54, paddingHorizontal: 18,
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.6 },
  privacyRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  privacyText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
  connection: { color: '#8A938D', fontSize: 10, marginTop: 30, textAlign: 'center' },
});

