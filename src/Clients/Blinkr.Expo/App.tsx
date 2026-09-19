import { StatusBar } from 'expo-status-bar';
import { BlinkrMark } from './src/components/BlinkrMark';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

import { clearAuth, loadAuth, saveAuth } from './src/api';
import { AuthScreen } from './src/components/AuthScreen';
import { MapScreen } from './src/components/MapScreen';
import { ChatListScreen } from './src/components/chat/ChatListScreen';
import { colors } from './src/theme';
import type { AuthResponse } from './src/types';

const PulsingMark = () => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 620, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 620, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }), []);
  return (
    <Animated.View style={[styles.loadingMark, style]}>
      <BlinkrMark size={38} />
    </Animated.View>
  );
};

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'chat'>('map');

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
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {isRestoring
          ? (
            <View style={styles.loading}>
              <PulsingMark />
              <Text style={styles.loadingBrand}>blinkr</Text>
              <ActivityIndicator color={colors.lime} size="small" style={styles.spinner} />
            </View>
          )
          : auth
            ? (activeTab === 'map'
              ? <MapScreen auth={auth} onAuthChange={acceptAuth} onLogout={logout} onOpenChat={() => setActiveTab('chat')} />
              : <ChatListScreen auth={auth} onAuthChange={acceptAuth} onOpenMap={() => setActiveTab('map')} onSessionExpired={logout} />)
            : <AuthScreen onAuthenticated={acceptAuth} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
