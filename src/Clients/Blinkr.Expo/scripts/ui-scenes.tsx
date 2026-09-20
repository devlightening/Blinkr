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
import { ClusterVisual, MarkerVisual } from '../src/components/MapMarkerVisuals';
import { MapTopChrome } from '../src/components/map/MapTopChrome';
import type { MapLayer } from '../src/mapSelection';
import { colors, signalColors, typography } from '../src/theme';
import type { BlinkrPlace } from '../src/types';

/** Browser-only scenes for visual review against the design package. Never shipped in the app bundle. */
function Kit() {
  const [tab, setTab] = useState<BlinkrTab>('map');
  const [layer, setLayer] = useState('all');
  const [taps, setTaps] = useState(0);
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 140 }}>
        <BlinkrHeader
          right={<HeaderAvatar userName="alper" />}
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
      <BlinkrBottomBar active={tab} chatUnread onCamera={() => setTaps(taps + 10)} onTab={setTab} />
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
  return (
    <View style={{ backgroundColor: colors.mapCanvas, flex: 1 }}>
      <PostDetailSheet isLoading={false} onClose={() => {}} onCreateSignal={() => {}} place={detailPlace} userId="scene" />
    </View>
  );
}

// --- Map chrome + markers over a flat stand-in for the base map (react-native-maps has no web build) ---
const at = (place: Partial<BlinkrPlace> & { category: string }, left: number, top: number, extra: { selected?: boolean; live?: boolean } = {}) => (
  <View key={`${place.category}-${left}-${top}`} style={{ left, position: 'absolute', top }}>
    <MarkerVisual
      now={Date.now()}
      place={{ id: place.category + left, name: place.category, latitude: 0, longitude: 0, category: place.category, lastActivityUtc: iso(3), currentState: extra.live ? { activeSignalCount: 2 } : null }}
      selected={Boolean(extra.selected)}
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
          <View key="c3" style={{ left: 40, position: 'absolute', top: 430 }}><ClusterVisual count={3} /></View>,
          <View key="c8" style={{ left: 240, position: 'absolute', top: 520 }}><ClusterVisual count={8} /></View>,
          at({ category: 'RESTAURANT' }, 190, 320, { live: true }),
          at({ category: 'RESTAURANT' }, 165, 430, { selected: true, live: true }),
          at({ category: 'CAFE' }, 230, 440),
          at({ category: 'BAR' }, 100, 480, { live: true }),
          at({ category: 'SPORT' }, 130, 560),
          at({ category: 'SHOP' }, 20, 350),
          at({ category: 'TOURISM' }, 290, 220),
          at({ category: 'PARK' }, 90, 250),
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
        userName="alper"
        visibleCount={80}
      />
      <BlinkrBottomBar active={tab} chatUnread onCamera={() => {}} onTab={setTab} />
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
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ProfileScreen auth={{ userId: 'scene', userName: 'alper', email: 'alper@example.test', token: 't' }} onLogout={() => {}} onOpenPlace={() => {}} />
      <BlinkrBottomBar active={tab} onCamera={() => {}} onTab={setTab} />
    </View>
  );
}

const scenes: Record<string, () => React.JSX.Element> = { kit: Kit, detail: Detail, map: MapChrome, profile: Profile };

export function SceneHost({ name }: { name: string }) {
  const Scene = scenes[name];
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 44, bottom: 24, left: 0, right: 0 } }}>
      {Scene ? <Scene /> : <Text style={{ color: 'red' }}>Unknown scene {name}</Text>}
    </SafeAreaProvider>
  );
}
