import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SignalComposer } from '../src/components/SignalComposer';
import { PostDetailSheet } from '../src/components/PostDetailSheet';
import { BlinkrMark } from '../src/components/BlinkrMark';
import { nearby, area as initialArea } from './ui-fixtures';
import { SceneHost } from './ui-scenes';
import type { ComposerArea } from '../src/types';
function Preview() {
  const [area, setArea] = useState<ComposerArea>(initialArea);
  const [open, setOpen] = useState(true);
  const [published, setPublished] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [publicationCount, setPublicationCount] = useState(0);
  const isDetail = location.search.includes('detail');
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 24, bottom: 20, left: 0, right: 0 } }}>
    <View style={{ height: '100%', backgroundColor: '#E3ECE8', paddingTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 }}><BlinkrMark /><Text>blinkr</Text></View>
      <Text accessibilityLabel="Published result">{published}</Text>
      <Text accessibilityLabel="Publication count">{publicationCount}</Text>
      <Pressable accessibilityLabel="Yeniden aç" onPress={() => setOpen(true)}><Text>Yeniden aç</Text></Pressable>
      {open && (isDetail ? <PostDetailSheet isLoading={false} onClose={() => setOpen(false)} onCreateSignal={() => {}} place={{ ...nearby[1], currentState: { signalType: 'Crowd', signalValue: 'Calm', freshness: 'FRESH', confidence: 'MEDIUM', confidenceValue: .4, activeSignalCount: 1 }, recentSignals: [{ postId: 'one', title: 'Parkın ışıkları çalışmıyor', text: 'Ana girişteki aydınlatma bu akşam kapalı.', signalType: 'TemporaryStatus', createdAtUtc: new Date().toISOString(), publicationTrust: 'NEARBY_PLACE_POST', authorName: 'deniz' }] }} /> : <SignalComposer
        area={area} auth={{ userId: 'qa', userName: 'deniz', email: 'qa@example.test', token: 'qa' }}
        canAskLocationAgain error={location.search.includes('error') ? 'Network request timed out' : null} isSubmitting={submitting} locationReadiness="ready"
        nearbyPlaces={nearby} nearbyStatus="READY" onAuthChange={() => {}} onClearError={() => {}}
        onClose={() => setOpen(false)} onOpenSettings={() => {}}
        onSelectArea={async (source, place) => setArea(place ? { ...initialArea, place, source: 'place', proximity: { allowed: (place.distanceMeters ?? 0) < 600, trustLevel: (place.distanceMeters ?? 0) < 200 ? 'VERIFIED_LIVE' : 'NEARBY_PLACE_POST', thresholdMeters: 600 } } : { ...initialArea, source })}
        onSessionExpired={() => {}}
        onSubmit={async input => {
          setSubmitting(true);
          setPublicationCount(count => count + 1);
          try {
            await new Promise(resolve => setTimeout(resolve, 600));
            setPublished(`${input.placeId ?? 'coordinate'}:${input.signalType}:${input.signalValue ?? ''}`);
            setOpen(false);
          } finally { setSubmitting(false); }
        }} visible />)}
    </View>
  </SafeAreaProvider>;
}
const scene = new URLSearchParams(location.search).get('scene');
createRoot(document.getElementById('root')!).render(scene ? <SceneHost name={scene} /> : <Preview />);
