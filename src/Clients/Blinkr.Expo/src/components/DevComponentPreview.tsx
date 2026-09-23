import { ArrowLeft, Layers, MapPin, MessageCircle, ShieldCheck, Users, X, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, getThemeMode, radii, signalInks, signalTints, sizes, spacing, typography } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrCard } from './ui/BlinkrCard';
import { BlinkrChip } from './ui/BlinkrChip';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrErrorState } from './ui/BlinkrErrorState';
import { FreshnessRing } from './ui/BlinkrFreshnessRing';
import { IconButton } from './ui/BlinkrIconButton';
import { LevelMeter } from './ui/BlinkrLevelMeter';
import { SegmentedControl } from './ui/BlinkrSegmentedControl';
import { SkeletonList } from './ui/BlinkrSkeleton';
import { StatRow } from './ui/BlinkrStatRow';
import { BlinkrText } from './ui/BlinkrText';
import { Toast } from './ui/BlinkrToast';
import { TypeBadge } from './ui/BlinkrTypeBadge';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * P1.9 (sinyal-mvp-plan Faz 1): the design system's whole catalogue in one scrollable, native-runnable
 * screen - a `__DEV__`-only entry point (Ayarlar > Geliştirici), never shown in a release build. Covers
 * the same ground as the browser harness's "Kit" scene, but rendered by the real app on a real device,
 * where fonts, native gestures and platform-specific rendering can actually be checked.
 */
export function DevComponentPreview({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState('nearby');
  const [chipSelected, setChipSelected] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>Bileşen Önizleme</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <Section title="Metin (plan-devam B4)">
          <BlinkrText variant="display">Display 34/40</BlinkrText>
          <BlinkrText variant="title1">Title1 24/30</BlinkrText>
          <BlinkrText variant="title2">Title2 19/25</BlinkrText>
          <BlinkrText variant="heading">Headline 16/21 · Şişli İğneada</BlinkrText>
          <BlinkrText variant="body">Body 15/21 - Şişli'de İğneada Çığlığı</BlinkrText>
          <BlinkrText variant="callout">Callout 14/19</BlinkrText>
          <BlinkrText color={colors.textSecondary} variant="caption">Caption 12/16</BlinkrText>
          <BlinkrText color={colors.textSecondary} variant="micro">Micro 11/13</BlinkrText>
          <BlinkrText variant="number">1.234 · 12:05 · 283 m</BlinkrText>
        </Section>

        <Section title={`Renk (${getThemeMode() === 'dark' ? 'koyu' : 'açık'} tema)`}>
          <View style={styles.swatches}>
            {([['Zemin', colors.background], ['Yüzey', colors.surface], ['Gömük', colors.surfaceElevated], ['Vurgu', colors.primary], ['Yumuşak vurgu', colors.greenSoft], ['Oluştur', colors.flare], ['Metin', colors.text], ['İkincil metin', colors.textSecondary], ['Tehlike', colors.danger]] as const).map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.swatchChip, { backgroundColor: value }]} />
                <Text style={styles.swatchText}>{name}</Text>
              </View>
            ))}
          </View>
          <View style={styles.swatches}>
            {(Object.keys(signalTints) as (keyof typeof signalTints)[]).map((type) => (
              <View key={type} style={[styles.typePair, { backgroundColor: signalTints[type] }]}>
                <Text style={[styles.swatchText, { color: signalInks[type] }]}>{type}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Buton, Chip, Kart">
          <View style={styles.row}>
            <BlinkrButton label="Birincil" onPress={() => {}} style={styles.flex} />
            <BlinkrButton label="İkincil" onPress={() => {}} style={styles.flex} variant="secondary" />
          </View>
          <BlinkrChip label={chipSelected ? 'Seçili' : 'Seçili değil'} onPress={() => setChipSelected((v) => !v)} selected={chipSelected} />
          <BlinkrCard variant="elevated"><Text style={{ ...typography.body, color: colors.text }}>Kart içeriği</Text></BlinkrCard>
        </Section>

        <Section title="FreshnessRing, TypeBadge, LevelMeter">
          <View style={styles.row}>
            <FreshnessRing color={colors.orange} live progress={0.85} size={56}><Avatar seed="dev-1" size={44} /></FreshnessRing>
            <FreshnessRing color={colors.amber} progress={0.4} size={56}><Avatar seed="dev-2" size={44} /></FreshnessRing>
            <FreshnessRing color={colors.textSecondary} progress={0.1} size={56}><Avatar seed="dev-3" size={44} /></FreshnessRing>
          </View>
          <View style={styles.row}>
            <TypeBadge signalType="Crowd" tone={colors.orange} typeLabel="Doluluk" valueLabel="Kalabalık" />
            <TypeBadge signalType="Queue" tone={colors.amber} typeLabel="Bekleme" valueLabel="5-15 dk" />
          </View>
          <LevelMeter accessibilityLabel="Doluluk seviyesi: kalabalık" level={2} />
        </Section>

        <Section title="StatRow">
          <StatRow items={[
            { key: 'signals', icon: <Layers color={colors.mint} size={18} />, text: '12 sinyal' },
            { key: 'freshness', icon: <Zap color={colors.mint} size={18} />, text: 'Canlı' },
            { key: 'confidence', icon: <ShieldCheck color={colors.mint} size={18} />, text: 'Orta güven' },
            { key: 'distance', icon: <MapPin color={colors.mint} size={18} />, text: '283 m' },
          ]}
          />
        </Section>

        <Section title="IconButton, SegmentedControl">
          <View style={styles.row}>
            <IconButton accessibilityLabel="Kapat" icon={<X color={colors.text} size={20} />} onPress={() => {}} variant="glass" />
            <IconButton accessibilityLabel="Kişiler" icon={<Users color={colors.text} size={20} />} onPress={() => {}} variant="surface" />
          </View>
          <SegmentedControl
            accessibilityLabel="Görünüm"
            onChange={setSegment}
            options={[{ value: 'nearby', label: 'Yakınımda' }, { value: 'following', label: 'Takip' }]}
            value={segment}
          />
        </Section>

        <Section title="Skeleton, EmptyState, ErrorState">
          <SkeletonList rows={2} variant="person" />
          <BlinkrEmptyState description="Boş durum açıklaması." icon={<Users color={colors.textSecondary} size={24} />} title="Boş durum başlığı" />
          <BlinkrErrorState description="Hata durumu açıklaması." onRetry={() => {}} />
        </Section>

        <Section title="Toast">
          <BlinkrButton label="Toast göster" onPress={() => setToast('Kaydedildi')} variant="secondary" />
        </Section>
      </ScrollView>
      <Toast message={toast} onHide={() => setToast(null)} tone="success" />
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { alignItems: 'center', gap: 4, width: 72 },
  swatchChip: { borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 40, width: 56 },
  swatchText: { ...typography.micro, color: colors.textSecondary, textAlign: 'center' },
  typePair: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 20 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.sm, width: sizes.touch },
  title: { ...typography.title, color: colors.text },
  content: { gap: spacing.lg, paddingHorizontal: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
