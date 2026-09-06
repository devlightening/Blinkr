import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
      <StatusBar style="dark" />
      {isRestoring
        ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.green} size="large" />
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
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
  },
});
