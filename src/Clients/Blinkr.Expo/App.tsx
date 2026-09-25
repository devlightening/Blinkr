import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { BlinkrMark } from './src/components/BlinkrMark';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

import { clearAuth, getMyProfile, getSignalDetail, listConversations, loadAuth, saveAuth } from './src/api';
import { parsePostLink } from './src/deepLinks';
import { AuthScreen } from './src/components/AuthScreen';
import { initI18n } from './src/i18n';

// Idempotent and synchronous-enough to use immediately (resources are inline, not fetched) - called once
// at module load so every component, including this file's own JSX below, can already translate.
initI18n();
import { MapScreen } from './src/components/MapScreen';
import { ChatListScreen } from './src/components/chat/ChatListScreen';
import { DiscoverScreen } from './src/components/feed/DiscoverScreen';
import { startRealtime, stopRealtime } from './src/realtime';
import { OnboardingScreen } from './src/components/OnboardingScreen';
import { PendingDeletionScreen } from './src/components/account/PendingDeletionScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { TabPager } from './src/components/TabPager';
import { ThemeProvider } from './src/components/ThemeProvider';
import { BlinkrBottomBar, type BlinkrTab } from './src/components/ui/BlinkrBottomBar';
import { hasSeenOnboarding, markOnboardingSeen } from './src/onboardingStore';
import { colors } from './src/theme';
import type { AuthResponse, BlinkrPlace, CoordinateSignal, ShareMode, UserSummary } from './src/types';
import { setSavedPlacesSession } from './src/savedPlaces';

// While Sohbet is not on screen the tab-bar dot is refreshed at this gentle interval, foreground only.
const UNREAD_POLL_MS = 30_000;
// Friend requests are slower news than messages.
const REQUESTS_POLL_MS = 60_000;

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
  // P1.3 (sinyal-mvp-plan): loading never blocks on this - `fontsSettled` is true whether the font
  // loaded or genuinely failed, so a slow/broken font file can never strand someone on the splash
  // screen. Text simply renders in the system font until (or unless) it settles true with `fontsLoaded`.
  const [fontsLoaded, fontError] = useFonts({ Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  const fontsSettled = fontsLoaded || Boolean(fontError);
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [activeTab, setActiveTab] = useState<BlinkrTab>('map');
  const [shareRequested, setShareRequested] = useState<ShareMode | null>(null);
  const [focusPlace, setFocusPlace] = useState<BlinkrPlace | null>(null);
  /** V2-4: a #tag from a map card, handed to Keşfet once. */
  const [hashtagRequest, setHashtagRequest] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState<CoordinateSignal | null>(null);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const [chatConversationOpen, setChatConversationOpen] = useState(false);
  const [profileOverlayOpen, setProfileOverlayOpen] = useState(false);
  const [discoverOverlayOpen, setDiscoverOverlayOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState<UserSummary | null>(null);
  const [requestsWaiting, setRequestsWaiting] = useState(false);
  // null while the flag is being read; the introduction is shown once per signed-in person.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

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

  const userId = auth?.userId ?? null;
  useEffect(() => {
    if (!userId) { setOnboardingSeen(null); return undefined; }
    let cancelled = false;
    setOnboardingSeen(null);
    void hasSeenOnboarding(userId).then((seen) => { if (!cancelled) setOnboardingSeen(seen); });
    return () => { cancelled = true; };
  }, [userId]);
  const finishOnboarding = useCallback(() => {
    setOnboardingSeen(true);
    if (userId) void markOnboardingSeen(userId);
  }, [userId]);

  // V2-5 (D-028): one realtime connection while someone is signed in; the token is read on every (re)connect.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = auth?.token ?? null;
  const signedInAs = auth?.userId ?? null;
  useEffect(() => {
    if (!signedInAs) { void stopRealtime(); return undefined; }
    startRealtime(() => tokenRef.current);
    return () => { void stopRealtime(); };
  }, [signedInAs]);

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
    setShareRequested(null);
    setFocusPlace(null);
    setFocusSignal(null);
    setMapOverlayOpen(false);
    setChatUnread(false);
    setChatConversationOpen(false);
    setChatTarget(null);
    setRequestsWaiting(false);
    setProfileOverlayOpen(false);
    setDiscoverOverlayOpen(false);
    await clearAuth();
  }, []);

  // Saved places sync with the account (P6.8); the module needs the current session and how to refresh it.
  useEffect(() => {
    setSavedPlacesSession(auth ? { auth, refresh: { onAuthRefresh: (next) => { void acceptAuth(next); }, onSessionExpired: () => { void logout(); } } } : null);
  }, [auth, acceptAuth, logout]);

  const openShare = useCallback((mode: ShareMode = 'camera') => {
    setActiveTab('map');
    setShareRequested(mode);
  }, []);
  const clearShareRequest = useCallback(() => setShareRequested(null), []);
  const openChatWith = useCallback((user: UserSummary) => {
    setChatTarget(user);
    setActiveTab('chat');
  }, []);
  const clearChatTarget = useCallback(() => setChatTarget(null), []);
  const onRequestsChange = useCallback((waiting: number) => setRequestsWaiting(waiting > 0), []);
  const clearFocusPlace = useCallback(() => setFocusPlace(null), []);
  const clearFocusSignal = useCallback(() => setFocusSignal(null), []);
  const openNearbySignal = useCallback((signal: CoordinateSignal) => {
    setFocusSignal(signal);
    setActiveTab('map');
  }, []);
  // V2-2: blinkr://post/{id} (a shared signal) opens it on the map, the same way a Keşfet row does.
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  useEffect(() => {
    void Linking.getInitialURL().then((url) => { const id = parsePostLink(url); if (id) setPendingLink(id); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => { const id = parsePostLink(url); if (id) setPendingLink(id); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!pendingLink || !auth) return undefined;
    const controller = new AbortController();
    const postId = pendingLink;
    getSignalDetail(auth, postId, controller.signal, { onAuthRefresh: (next) => { void acceptAuth(next); }, onSessionExpired: () => { void logout(); } })
      .then((dto) => {
        if (dto.latitude === null || dto.latitude === undefined || dto.longitude === null || dto.longitude === undefined) return;
        openNearbySignal({ postId, title: dto.title ?? '', textPreview: dto.content ?? '', latitude: dto.latitude, longitude: dto.longitude, signalType: (dto.signalType ?? 'GeneralObservation') as CoordinateSignal['signalType'], signalValue: dto.signalValue ?? null });
      })
      .catch(() => { /* a removed or hidden signal: the app simply stays where it is */ })
      // Cleared only when done: clearing first would re-run this effect and abort the request.
      .finally(() => { if (!controller.signal.aborted) setPendingLink(null); });
    return () => controller.abort();
  }, [pendingLink, auth, acceptAuth, logout, openNearbySignal]);
  const openSavedPlace = useCallback((place: BlinkrPlace) => {
    setFocusPlace(place);
    setActiveTab('map');
  }, []);

  // Sohbet reports its own unread state while it is open; otherwise check now and then so the
  // dot on the tab bar reflects real unread messages.
  useEffect(() => {
    if (!auth || activeTab === 'chat') return undefined;
    let cancelled = false;
    const check = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const items = await listConversations(auth, acceptAuth, logout);
        if (!cancelled) setChatUnread(items.some((item) => (item.unreadCount ?? 0) > 0));
      } catch {
        // A failed check keeps the previous dot state; the chat screen surfaces real errors.
      }
    };
    void check();
    const timer = setInterval(check, UNREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [auth, activeTab, acceptAuth, logout]);

  // Friend requests: while Profil is closed, look now and then so its dot shows a real waiting request.
  useEffect(() => {
    if (!auth || activeTab === 'profile') return undefined;
    let cancelled = false;
    const check = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const mine = await getMyProfile(auth, undefined, { onAuthRefresh: acceptAuth, onSessionExpired: logout });
        if (!cancelled) setRequestsWaiting(mine.incomingRequestCount > 0);
      } catch {
        // A failed check keeps the previous dot.
      }
    };
    void check();
    const timer = setInterval(check, REQUESTS_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [auth, activeTab, acceptAuth, logout]);

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
      <ThemeProvider>
        <StatusBar style="light" />
        {isRestoring || !fontsSettled || (auth && onboardingSeen === null)
          ? (
            <View style={styles.loading}>
              <PulsingMark />
              <Text style={styles.loadingBrand}>blinkr</Text>
              <ActivityIndicator color={colors.lime} size="small" style={styles.spinner} />
            </View>
          )
          : auth?.deletionScheduledForUtc
            ? <PendingDeletionScreen auth={auth} onCancelled={(next) => { void acceptAuth(next); }} onLogout={() => { void logout(); }} refresh={{ onAuthRefresh: (next) => { void acceptAuth(next); }, onSessionExpired: () => { void logout(); } }} />
          : auth && onboardingSeen === false
            ? <OnboardingScreen onDone={finishOnboarding} />
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
                    shareRequested={shareRequested}
                    focusPlace={focusPlace}
                    focusSignal={focusSignal}
                    onFocusSignalHandled={clearFocusSignal}
                    onAuthChange={acceptAuth}
                    onShareHandled={clearShareRequest}
                    onFocusHandled={clearFocusPlace}
                    onLogout={logout}
                    onMessageUser={openChatWith}
                    onOpenProfile={() => setActiveTab('profile')}
                    onShowList={() => setActiveTab('nearby')}
                    onOpenHashtag={(tag) => { setHashtagRequest(tag); setActiveTab('nearby'); }}
                    onOverlayOpenChange={setMapOverlayOpen}
                  />
                </View>
                {/* Swipe between tabs like Instagram; the map page is the map underneath (TabPager). */}
                <TabPager
                  active={activeTab}
                  onChange={setActiveTab}
                  renderPage={(tab) => tab === 'chat' ? (
                    <ChatListScreen
                      auth={auth}
                      onAuthChange={acceptAuth}
                      onConversationOpenChange={setChatConversationOpen}
                      onSessionExpired={logout}
                      onUnreadChange={setChatUnread}
                      onOpenWithHandled={clearChatTarget}
                      openWith={chatTarget}
                    />
                  ) : tab === 'nearby' ? (
                    <DiscoverScreen auth={auth} hashtagRequest={hashtagRequest} onHashtagHandled={() => setHashtagRequest(null)} onAuthChange={acceptAuth} onCreateSignal={() => openShare('camera')} onLogout={logout} onMessageUser={openChatWith} onOpenPlace={openSavedPlace} onOpenSignal={openNearbySignal} onOverlayOpenChange={setDiscoverOverlayOpen} />
                  ) : tab === 'profile' ? (
                    <ProfileScreen auth={auth} onAuthChange={acceptAuth} onCreateSignal={() => openShare('camera')} onLogout={logout} onMessageUser={openChatWith} onOpenPlace={openSavedPlace} onOverlayOpenChange={setProfileOverlayOpen} onRequestsChange={onRequestsChange} />
                  ) : null}
                  swipeEnabled={!((activeTab === 'chat' && chatConversationOpen) || (activeTab === 'profile' && profileOverlayOpen) || (activeTab === 'nearby' && discoverOverlayOpen))}
                />
                <BlinkrBottomBar
                  active={activeTab}
                  chatUnread={chatUnread}
                  profileDot={requestsWaiting}
                  hidden={(activeTab === 'map' && mapOverlayOpen) || (activeTab === 'chat' && chatConversationOpen) || (activeTab === 'profile' && profileOverlayOpen) || (activeTab === 'nearby' && discoverOverlayOpen)}
                  me={auth ? { userId: auth.userId, avatarKey: auth.avatarKey } : null}
                  onShare={openShare}
                  onTab={setActiveTab}
                />
              </View>
            )
            : <AuthScreen onAuthenticated={acceptAuth} />}
      </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
