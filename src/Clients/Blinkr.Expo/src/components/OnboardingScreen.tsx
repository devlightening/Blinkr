import { Camera, MapPin, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ONBOARDING_PAGES, isLastPage, nextPage } from '../onboardingContent';
import { colors, radii, spacing, typography } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { BlinkrMark } from './BlinkrMark';
import { BlinkrButton } from './ui/BlinkrButton';
import { tx } from '../i18n/tx';

const visuals = {
  know: { Icon: MapPin, tone: colors.primary },
  signal: { Icon: Camera, tone: colors.orange },
  privacy: { Icon: ShieldCheck, tone: colors.blue },
} as const;

/**
 * Three quiet cards shown once after the first sign-in. It explains the one idea of the app, what a signal is and what
 * stays private, then gets out of the way. No location permission is asked here; that happens when it is needed.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const page = ONBOARDING_PAGES[index];
  const { Icon, tone } = visuals[page.id];
  const last = isLastPage(index);

  return (
    <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, spacing.lg), paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        <BlinkrMark size={30} />
        {!last ? (
          <AnimatedPressable accessibilityLabel={tx('common:onboarding.skip', 'Tanıtımı atla')} accessibilityRole="button" onPress={onDone} pressScale={0.95} style={styles.skip}>
            <Text style={styles.skipText}>{tx('common:onboarding.skipShort', 'Atla')}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={[styles.ringOuter, { borderColor: `${tone}22` }]}>
          <View style={[styles.ringInner, { borderColor: `${tone}44` }]}>
            <View style={[styles.disc, { backgroundColor: `${tone}1F` }]}>
              <Icon color={tone} size={44} strokeWidth={1.8} />
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{page.title}</Text>
        <Text style={styles.body}>{page.body}</Text>
      </View>

      <View style={styles.bottom}>
        <View accessibilityLabel={tx('common:onboarding.page', 'Sayfa {{n}} / {{total}}', { n: index + 1, total: ONBOARDING_PAGES.length })} style={styles.dots}>
          {ONBOARDING_PAGES.map((item, position) => <View key={item.id} style={[styles.dot, position === index && styles.dotActive]} />)}
        </View>
        <BlinkrButton label={last ? tx('common:onboarding.start', 'Başla') : tx('common:onboarding.next', 'İleri')} onPress={last ? onDone : () => setIndex(nextPage(index))} size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1, paddingHorizontal: spacing.xl },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  skip: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  skipText: { ...typography.bodyStrong, color: colors.textSecondary },
  center: { alignItems: 'center', flex: 1, gap: spacing.lg, justifyContent: 'center' },
  ringOuter: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, height: 220, justifyContent: 'center', width: 220 },
  ringInner: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, height: 160, justifyContent: 'center', width: 160 },
  disc: { alignItems: 'center', borderRadius: radii.pill, height: 104, justifyContent: 'center', width: 104 },
  title: { ...typography.headline, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, maxWidth: 320, textAlign: 'center' },
  bottom: { gap: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.primary, width: 24 },
});
