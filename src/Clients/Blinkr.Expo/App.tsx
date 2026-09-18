import { StatusBar } from 'expo-status-bar';
import { BlinkrMark } from './src/components/BlinkrMark';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { clearAuth, loadAuth, saveAuth } from './src/api';
import { AuthScreen } from './src/components/AuthScreen';
import { MapScreen } from './src/components/MapScreen';
import { colors } from './src/theme';
import type { AuthResponse } from './src/types';

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadAuth()
      .then((storedAuth) => {
        if (mounted) setAuth(storedAuth);
      })
      .catch(() => { if (mounted) setAuth(null); })
      .finally(() => {
        if (mounted) setIsRestoring(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const acceptAuth = async (nextAuth: AuthResponse) => {
    setAuth(nextAuth);
    await saveAuth(nextAuth);
  };

  const logout = async () => {
    setAuth(null);
    await clearAuth();
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={auth ? 'dark' : 'light'} />
      {isRestoring
        ? (
          <View style={styles.loading}>
            <View style={styles.loadingMark}>
              <BlinkrMark size={38} />
            </View>
            <Text style={styles.loadingBrand}>blinkr</Text>
            <ActivityIndicator color={colors.lime} size="small" style={styles.spinner} />
          </View>
        )
        : auth
          ? <MapScreen auth={auth} onAuthChange={acceptAuth} onLogout={logout} />
          : <AuthScreen onAuthenticated={acceptAuth} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    flex: 1,
    justifyContent: 'center',
  },
  loadingMark: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 52, justifyContent: 'center', width: 52 },
  loadingBrand: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 12 },
  spinner: { marginTop: 22 },
});
