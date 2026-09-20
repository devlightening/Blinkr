import { StatusBar } from 'expo-status-bar';
import { BlinkrMark } from './src/components/BlinkrMark';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

import { clearAuth, loadAuth, saveAuth } from './src/api';
import { AuthScreen } from './src/components/AuthScreen';
import { MapScreen } from './src/components/MapScreen';
import { ChatListScreen } from './src/components/chat/ChatListScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { BlinkrBottomBar, type BlinkrTab } from './src/components/ui/BlinkrBottomBar';
import { colors } from './src/theme';
import type { AuthResponse, BlinkrPlace } from './src/types';

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
  const [activeTab, setActiveTab] = useState<BlinkrTab>('map');
  const [cameraRequested, setCameraRequested] = useState(false);
  const [focusPlace, setFocusPlace] = useState<BlinkrPlace | null>(null);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);

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

  // Stable identities: screens list these as effect dependencies, so a fresh function on every
  // App render used to restart their polling and loading state.
  const acceptAuth = useCallback(async (nextAuth: AuthResponse) => {
    setAuth(nextAuth);
    await saveAuth(nextAuth);
  }, []);

  const logout = useCallback(async () => {
    setAuth(null);
    // Nothing of the previous user's session may survive into the next sign-in.
    setActiveTab('map');
    setCameraRequested(false);
    setFocusPlace(null);
    setMapOverlayOpen(false);
    setChatUnread(false);
    await clearAuth();
  }, []);

  const openCamera = useCallback(() => {
    setActiveTab('map');
    setCameraRequested(true);
  }, []);
  const clearCameraRequest = useCallback(() => setCameraRequested(false), []);
  const clearFocusPlace = useCallback(() => setFocusPlace(null), []);
  const openSavedPlace = useCallback((place: BlinkrPlace) => {
    setFocusPlace(place);
    setActiveTab('map');
  }, []);

  // Android back: leave Sohbet/Profil for the map before it would close the app. Sheets and the
  // open conversation register their own handlers later, so theirs run first.
  useEffect(() => {
    if (!auth || activeTab === 'map') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setActiveTab('map'); return true; });
    return () => subscription.remove();
  }, [auth, activeTab]);

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
            ? (
              <View style={styles.flex}>
                {/* The map stays mounted so viewport, layer and loaded markers survive tab changes. */}
                <View
                  accessibilityElementsHidden={activeTab !== 'map'}
                  importantForAccessibility={activeTab === 'map' ? 'auto' : 'no-hide-descendants'}
                  style={styles.flex}
                >
                  <MapScreen
                    auth={auth}
                    cameraRequested={cameraRequested}
                    focusPlace={focusPlace}
                    onAuthChange={acceptAuth}
                    onCameraHandled={clearCameraRequest}
                    onFocusHandled={clearFocusPlace}
                    onLogout={logout}
                    onOpenProfile={() => setActiveTab('profile')}
                    onOverlayOpenChange={setMapOverlayOpen}
                  />
                </View>
                {activeTab === 'chat' && (
                  <View style={styles.tabLayer}>
                    <ChatListScreen auth={auth} onAuthChange={acceptAuth} onSessionExpired={logout} />
                  </View>
                )}
                {activeTab === 'profile' && (
                  <View style={styles.tabLayer}>
                    <ProfileScreen auth={auth} onLogout={logout} onOpenPlace={openSavedPlace} />
                  </View>
                )}
                <BlinkrBottomBar
                  active={activeTab}
                  chatUnread={chatUnread}
                  hidden={activeTab === 'map' && mapOverlayOpen}
                  onCamera={openCamera}
                  onTab={setActiveTab}
                />
              </View>
            )
            : <AuthScreen onAuthenticated={acceptAuth} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabLayer: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 10 },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingMark: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, height: 52, justifyContent: 'center', width: 52 },
  loadingBrand: { color: colors.white, fontSize: 25, fontWeight: '900', marginTop: 12 },
  spinner: { marginTop: 22 },
});
