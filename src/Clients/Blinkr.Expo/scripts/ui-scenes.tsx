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
import { colors, signalColors, typography } from '../src/theme';

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

const scenes: Record<string, () => React.JSX.Element> = { kit: Kit };

export function SceneHost({ name }: { name: string }) {
  const Scene = scenes[name];
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 44, bottom: 24, left: 0, right: 0 } }}>
      {Scene ? <Scene /> : <Text style={{ color: 'red' }}>Unknown scene {name}</Text>}
    </SafeAreaProvider>
  );
}
