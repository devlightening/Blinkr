import { useState } from 'react';
import { Coffee, Layers3, MessageCircle, Radio, Users } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BlinkrBottomBar, type BlinkrTab } from '../src/components/ui/BlinkrBottomBar';
import { BlinkrButton } from '../src/components/ui/BlinkrButton';
import { BlinkrCard } from '../src/components/ui/BlinkrCard';
import { BlinkrChip } from '../src/components/ui/BlinkrChip';
import { BlinkrEmptyState } from '../src/components/ui/BlinkrEmptyState';
import { BlinkrHeader, HeaderAvatar } from '../src/components/ui/BlinkrHeader';
import { BlinkrSignalCard } from '../src/components/ui/BlinkrSignalCard';
import { PostDetailSheet } from '../src/components/PostDetailSheet';
import { ProfileScreen } from '../src/components/ProfileScreen';
import { ChatListScreen } from '../src/components/chat/ChatListScreen';
import { Avatar } from '../src/components/Avatar';
import { avatarKeyOf } from '../src/avatars';
import { NearbyScreen } from '../src/components/NearbyScreen';
import { MapSearchOverlay } from '../src/components/map/MapSearchOverlay';
import { ShareHubSheet } from '../src/components/ShareHubSheet';
import { SignalCamera } from '../src/components/camera/SignalCamera';
import { ConversationScreen } from '../src/components/chat/ConversationScreen';
import { UserSearchSheet } from '../src/components/chat/UserSearchSheet';
import { BlinkrSheetPanel } from '../src/components/ui/BlinkrSheetPanel';
import { conversations, nearby, area as composerArea } from './ui-fixtures';
import { SignalComposer } from '../src/components/SignalComposer';
import { AuthScreen } from '../src/components/AuthScreen';
import { ClusterVisual, MarkerVisual } from '../src/components/MapMarkerVisuals';
import { MapTopChrome } from '../src/components/map/MapTopChrome';
import type { MapLayer } from '../src/mapSelection';
import { colors, signalColors, typography } from '../src/theme';
import type { AuthResponse, BlinkrPlace, SignalType } from '../src/types';

/** Browser-only scenes for visual review against the design package. Never shipped in the app bundle. */
function Kit() {
  const [tab, setTab] = useState<BlinkrTab>('map');
  const [layer, setLayer] = useState('all');
  const [taps, setTaps] = useState(0);
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 140 }}>
        <BlinkrHeader
          right={<HeaderAvatar userId="scene" userName="alper" />}
          subtitle={<Text style={{ ...typography.caption, color: colors.mint }}>CANLI ÇEVRE · 4 görünür</Text>}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['all', 'Tümü', (c: string) => <Layers3 color={c} size={18} />],
            ['live', 'Canlı', (c: string) => <Radio color={c} size={18} />],
            ['places', 'Yerler', (c: string) => <Coffee color={c} size={18} />],
            ['signals', 'Sinyaller', (c: string) => <MessageCircle color={c} size={18} />],
          ].map(([key, label, icon]) => (
            <BlinkrChip icon={icon as (c: string) => React.ReactNode} key={key as string} label={label as string} onPress={() => setLayer(key as string)} selected={layer === key} />
          ))}
        </View>
        <BlinkrButton icon={<Users color={colors.ink} size={22} />} label="Sinyal bırak" onPress={() => setTaps(taps + 1)} size="lg" subtitle="Burada neler oluyor?" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BlinkrButton label="İkincil" onPress={() => {}} style={{ flex: 1 }} variant="secondary" />
          <BlinkrButton label="Ghost" onPress={() => {}} style={{ flex: 1 }} variant="ghost" />
          <BlinkrButton label="Sil" onPress={() => {}} style={{ flex: 1 }} variant="danger" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BlinkrButton label="Yükleniyor" loading onPress={() => {}} style={{ flex: 1 }} />
          <BlinkrButton disabled label="Kapalı" onPress={() => {}} style={{ flex: 1 }} />
        </View>
        <Text accessibilityLabel="Tap count" style={{ color: colors.textSecondary }}>{taps}</Text>
        <BlinkrCard variant="elevated"><Text style={{ ...typography.body, color: colors.text }}>Yükseltilmiş kart</Text></BlinkrCard>
        <BlinkrSignalCard
          ageLabel="2 dk önce"
          authorLabel="deniz"
          signalType="Crowd"
          text="Hafta sonu gibi, yer bulmak zor."
          title="Çok kalabalık"
          tone={signalColors.Crowd}
          trustLabel="Konum doğrulandı"
          typeLabel="Doluluk"
        />
        <BlinkrEmptyState
          action={{ label: 'Yeni mesaj', onPress: () => {} }}
          description="Bir kullanıcı bul ve konuşmaya başla."
          icon={<MessageCircle color={colors.textSecondary} size={34} />}
          title="Henüz mesajın yok"
        />
      </ScrollView>
      <BlinkrBottomBar active={tab} chatUnread onShare={() => setTaps(taps + 10)} onTab={setTab} />
    </View>
  );
}

// Test-only artwork: flat SVG tiles standing in for uploaded photos so the rail layout can be reviewed.
const tile = (hue: number) => `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="hsl(${hue},35%,28%)"/><circle cx="300" cy="90" r="60" fill="hsl(${hue},45%,42%)"/></svg>`)}`;
const mediaOf = (hue: number, id: string) => ({ mediaId: id, mediaType: 'Image', url: tile(hue), thumbnailUrl: tile(hue) });
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const detailPlace: BlinkrPlace = {
  id: 'scene-place', name: 'Örnek Lokanta', category: 'RESTAURANT', latitude: 37.07, longitude: 36.25, distanceMeters: 120,
  currentState: { signalType: 'Crowd', signalValue: 'Busy', freshness: 'FRESH', confidence: 'MEDIUM', activeSignalCount: 2 },
  recentSignals: [
    { postId: 's1', title: 'Çok kalabalık', text: 'Hafta sonu gibi, yer bulmak zor.', signalType: 'Crowd', createdAtUtc: iso(2), publicationTrust: 'VERIFIED_LIVE', authorName: 'deniz', media: [mediaOf(150, 'm1'), mediaOf(30, 'm2'), mediaOf(260, 'm3'), mediaOf(200, 'm4'), mediaOf(340, 'm5')] },
    { postId: 's2', title: 'Müzik var', text: 'Atmosfer şahane.', signalType: 'Event', createdAtUtc: iso(8), publicationTrust: 'NEARBY_PLACE_POST', authorName: null },
  ],
};
function Detail() {
  const [answer, setAnswer] = useState('');
  const stale = typeof location !== 'undefined' && location.search.includes('stale');
  const place = stale ? { ...detailPlace, currentState: { ...detailPlace.currentState, freshness: 'STALE' } } : detailPlace;
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1 }}>
      <PostDetailSheet isLoading={false} onClose={() => {}} onCreateSignal={() => {}} onRecheck={(mode, signal) => setAnswer(`${mode}:${signal.type}:${signal.value}`)} place={place} userId="scene" />
      <Text accessibilityLabel="answer" style={{ height: 0, opacity: 0, position: 'absolute' }}>{answer}</Text>
    </View>
  );
}

// --- Map chrome + markers over a flat stand-in for the base map (react-native-maps has no web build) ---
const at = (place: Partial<BlinkrPlace> & { category: string }, left: number, top: number, extra: { selected?: boolean; live?: boolean; type?: SignalType } = {}) => (
  <View key={`${place.category}-${left}-${top}`} style={{ left, position: 'absolute', top }}>
    <MarkerVisual
      now={Date.now()}
      place={{ id: place.category + left, name: place.category, latitude: 0, longitude: 0, category: place.category, lastActivityUtc: iso(3), currentState: extra.live ? { activeSignalCount: 2, signalType: extra.type ?? 'Crowd', signalValue: 'Busy', freshness: 'FRESH' } : null }}
      selected={Boolean(extra.selected)}
    />
  </View>
);
const bubble = (type: SignalType, left: number, top: number, ageMinutes: number, selected = false) => (
  <View key={`sig-${type}-${left}-${top}`} style={{ left, position: 'absolute', top }}>
    <MarkerVisual
      now={Date.now()}
      selected={selected}
      signal={{ postId: `s${left}`, title: 'Sinyal', textPreview: '', latitude: 0, longitude: 0, signalType: type, createdAtUtc: iso(ageMinutes), expiresAt: new Date(Date.now() + (180 - ageMinutes) * 60_000).toISOString() }}
    />
  </View>
);
function MapChrome() {
  const [layer, setLayer] = useState<MapLayer>('all');
  const [tab, setTab] = useState<BlinkrTab>('map');
  return (
    <View style={{ backgroundColor: '#1B2521', flex: 1, overflow: 'hidden' }}>
      <View style={{ backgroundColor: '#22302B', height: 26, left: -40, position: 'absolute', right: -40, top: 330, transform: [{ rotate: '-18deg' }] }} />
      <View style={{ backgroundColor: '#22302B', bottom: -40, left: 190, position: 'absolute', top: -40, transform: [{ rotate: '14deg' }], width: 22 }} />
      <View style={{ backgroundColor: '#0E2A3A', bottom: 120, height: 110, left: -20, position: 'absolute', right: -20, transform: [{ rotate: '-6deg' }] }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none">
        {[
          <View key="c12" style={{ left: 120, position: 'absolute', top: 250 }}><ClusterVisual count={12} /></View>,
          <View key="c5" style={{ left: 280, position: 'absolute', top: 290 }}><ClusterVisual count={5} /></View>,
          <View key="c3" style={{ left: 30, position: 'absolute', top: 520 }}><ClusterVisual count={3} /></View>,
          <View key="c120" style={{ left: 250, position: 'absolute', top: 560 }}><ClusterVisual count={120} /></View>,
          at({ category: 'RESTAURANT' }, 190, 320, { live: true, type: 'Crowd' }),
          at({ category: 'RESTAURANT' }, 165, 430, { selected: true, live: true, type: 'Queue' }),
          at({ category: 'CAFE' }, 230, 440),
          at({ category: 'PHARMACY' }, 95, 470, { live: true, type: 'Queue' }),
          at({ category: 'BAR' }, 30, 380, { live: true, type: 'Event' }),
          at({ category: 'SPORT' }, 130, 590),
          at({ category: 'SHOP' }, 20, 330),
          at({ category: 'TOURISM' }, 290, 200),
          at({ category: 'PARK' }, 90, 230, { live: true, type: 'TemporaryStatus' }),
          bubble('GeneralObservation', 300, 400, 6),
          bubble('Offer', 320, 470, 80),
          bubble('Event', 200, 520, 165),
        ]}
      </View>
      <MapTopChrome
        isLoading={false}
        layer={layer}
        onLayerChange={setLayer}
        onLocate={() => {}}
        onOpenProfile={() => {}}
        onScan={() => {}}
        scanAvailable
        onOpenSearch={() => {}}
        userId="scene"
        userName="alper"
        visibleCount={80}
      />
      <BlinkrBottomBar active={tab} chatUnread onShare={() => {}} onTab={setTab} />
    </View>
  );
}

// --- Profile with a few places saved on this (test) device ---
function Profile() {
  const saved = [
    { id: 'p1', name: 'Örnek Lokanta', category: 'RESTAURANT', latitude: 37.07, longitude: 36.25 },
    { id: 'p2', name: 'Kent Müzesi', category: 'TOURISM', latitude: 37.08, longitude: 36.26 },
    { id: 'p3', name: 'Kahve Durağı', category: 'CAFE', latitude: 37.06, longitude: 36.24 },
  ];
  useState(() => {
    saved.forEach((place) => localStorage.setItem(`blinkr.saved.scene.${place.id}`, JSON.stringify(place)));
    localStorage.setItem('blinkr.saved.scene.index', saved.map((place) => place.id).join(','));
  });
  const [tab, setTab] = useState<BlinkrTab>('profile');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [auth, setAuth] = useState<AuthResponse>({ userId: 'scene', userName: 'alper', email: 'alper@example.test', token: 't' });
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ProfileScreen auth={auth} onAuthChange={(next) => setAuth(next)} onCreateSignal={() => {}} onLogout={() => {}} onOpenPlace={() => {}} onOverlayOpenChange={setSheetOpen} />
      <Text accessibilityLabel="avatar-key" style={{ height: 0, opacity: 0, position: 'absolute' }}>{auth.avatarKey ?? 'default'}</Text>
      <BlinkrBottomBar active={tab} hidden={sheetOpen} onShare={() => {}} onTab={setTab} />
    </View>
  );
}

// --- Chat ---
const qaAuth = { userId: 'qa', userName: 'alper', email: 'qa@example.test', token: 't' };
function Chat() {
  const [tab, setTab] = useState<BlinkrTab>('chat');
  const [covered, setCovered] = useState(false);
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ChatListScreen auth={qaAuth} onAuthChange={() => {}} onConversationOpenChange={setCovered} onSessionExpired={() => {}} snapRequested={typeof location !== 'undefined' && location.search.includes('compose')} />
      <BlinkrBottomBar active={tab} chatUnread hidden={covered} onShare={() => {}} onTab={setTab} />
    </View>
  );
}
function ShareHub() {
  const [choice, setChoice] = useState('');
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1 }}>
      <ShareHubSheet onCamera={() => setChoice('camera')} onClose={() => setChoice('closed')} onGallery={() => setChoice('gallery')} onSignalOnly={() => setChoice('signal')} />
      <Text accessibilityLabel="choice" style={{ height: 0, opacity: 0, position: 'absolute' }}>{choice}</Text>
    </View>
  );
}
function CameraScene() {
  const [result, setResult] = useState('');
  const [closed, setClosed] = useState(false);
  return (
    <View style={{ backgroundColor: '#000', flex: 1 }}>
      {!closed && <SignalCamera onCapture={(asset) => setResult(`${asset.type}:${asset.mimeType}:${asset.uri.endsWith('#rendered') ? 'rendered' : 'original'}`)} onClose={() => setClosed(true)} />}
      <Text accessibilityLabel="captured" style={{ height: 0, opacity: 0, position: 'absolute' }}>{result}{closed ? 'closed' : ''}</Text>
    </View>
  );
}
function AvatarGallery() {
  const keys = Array.from({ length: 48 }, (_, i) => avatarKeyOf({ color: i % 8, face: Math.floor(i / 8) % 6, accessory: (i * 5 + Math.floor(i / 8)) % 6 }));
  const accessories = [0, 1, 2, 3, 4, 5].map((accessory) => avatarKeyOf({ color: accessory + 1, face: accessory % 6, accessory }));
  return (
    <View style={{ backgroundColor: colors.background, flex: 1, gap: 20, padding: 16 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>{accessories.map((key) => <Avatar avatarKey={key} key={key} ringColor={colors.primary} seed="gallery" size={52} />)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{keys.map((key, i) => <Avatar avatarKey={key} key={`${key}-${i}`} seed="gallery" size={40} />)}</View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>{['a', 'b', 'c', 'd', 'e', 'f'].map((seed) => <Avatar key={seed} seed={seed} size={40} />)}</View>
    </View>
  );
}
function MapSearch() {
  const [chosen, setChosen] = useState('');
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1 }}>
      <MapSearchOverlay onClose={() => setChosen('closed')} onSelectLocation={(target) => setChosen(`location:${target.label}`)} onSelectPlace={(place) => setChosen(`place:${place.id}`)} origin={{ latitude: 37.0742, longitude: 36.2478 }} userId="scene" />
      <Text accessibilityLabel="chosen" style={{ height: 0, opacity: 0, position: 'absolute' }}>{chosen}</Text>
    </View>
  );
}
function Nearby() {
  const [tab, setTab] = useState<BlinkrTab>('nearby');
  const [opened, setOpened] = useState('');
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <NearbyScreen onCreateSignal={() => setOpened('camera')} onOpenPlace={(place) => setOpened(`place:${place.id}`)} onOpenSignal={(signal) => setOpened(`signal:${signal.postId}`)} />
      <Text accessibilityLabel="opened" style={{ height: 0, opacity: 0, position: 'absolute' }}>{opened}</Text>
      <BlinkrBottomBar active={tab} chatUnread onShare={() => {}} onTab={setTab} />
    </View>
  );
}
function Conversation() {
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ConversationScreen auth={qaAuth} conversation={conversations[0]} onAuthChange={() => {}} onBack={() => {}} onSessionExpired={() => {}} otherUserName="zeynep" />
    </View>
  );
}
function UserSearch() {
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1, justifyContent: 'flex-end' }}>
      <BlinkrSheetPanel maxHeightRatio={0.88}>
        <UserSearchSheet auth={qaAuth} onBack={() => {}} onSelect={() => {}} />
      </BlinkrSheetPanel>
    </View>
  );
}

// --- Composer over a captured photo (the design's camera-first look) ---
function ComposerWithMedia() {
  const capture = { uri: tile(20), type: 'image', fileName: 'kare.jpg', width: 400, height: 300 } as never;
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1 }}>
      <SignalComposer
        area={{ ...composerArea, place: nearby[1], source: 'place', proximity: { allowed: true, trustLevel: 'VERIFIED_LIVE', thresholdMeters: 200 } }}
        auth={qaAuth}
        canAskLocationAgain
        error={null}
        initialStep={1}
        isSubmitting={false}
        locationReadiness="ready"
        nearbyPlaces={nearby}
        nearbyStatus="READY"
        onAuthChange={() => {}}
        onClearError={() => {}}
        onClose={() => {}}
        onOpenSettings={() => {}}
        onSelectArea={async () => {}}
        onSessionExpired={() => {}}
        onSubmit={async () => {}}
        pendingCapture={capture}
        visible
      />
    </View>
  );
}

function Auth() { return <AuthScreen onAuthenticated={() => {}} />; }

const scenes: Record<string, () => React.JSX.Element> = { auth: Auth, composerMedia: ComposerWithMedia, kit: Kit, detail: Detail, map: MapChrome, profile: Profile, chat: Chat, nearby: Nearby, mapSearch: MapSearch, avatars: AvatarGallery, share: ShareHub, camera: CameraScene, conversation: Conversation, search: UserSearch };

export function SceneHost({ name }: { name: string }) {
  const Scene = scenes[name];
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 44, bottom: 24, left: 0, right: 0 } }}>
      {Scene ? <Scene /> : <Text style={{ color: 'red' }}>Unknown scene {name}</Text>}
    </SafeAreaProvider>
  );
}
