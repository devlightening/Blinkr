import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { displayLocale } from '../../i18n/locale';
import { tx } from '../../i18n/tx';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { useAuthorTrust } from './TrustLine';

const format = (value: number) => value.toLocaleString(displayLocale());

/**
 * "Yerel rehber": what a person has contributed from the place itself, built only from the server's verified numbers
 * (VERIFIED_LIVE publications; anonymous ones never counted). No rank, level or score: each number says what it counts.
 * Absent while loading, on failure, behind a private account or with nothing verified yet - it never shows a guess.
 */
export function LocalGuideCard({ auth, userId, enabled = true, refresh }: {
  auth: AuthResponse;
  userId: string;
  enabled?: boolean;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
}) {
  const trust = useAuthorTrust(auth, userId, enabled, refresh);
  if (!trust) return null;

  const stats = [
    { key: 'signals', value: trust.verifiedSignals, label: tx('profile:guide.signals', 'Konumda'), hint: tx('profile:guide.signalsHint', 'Yerindeyken paylaştığın, sunucunun doğruladığı sinyaller') },
    ...(trust.verifiedPlaces > 0
      ? [{ key: 'places', value: trust.verifiedPlaces, label: tx('profile:guide.places', 'Yer'), hint: tx('profile:guide.placesHint', 'Doğrulanmış sinyal bıraktığın farklı yerler') }]
      : []),
  ];
  const summary = trust.verifiedPlaces > 0
    ? tx('profile:trust.line', 'Konumda doğrulanmış {{signals}} sinyal · {{places}} yer', { signals: trust.verifiedSignals, places: trust.verifiedPlaces })
    : tx('profile:trust.signalsOnly', 'Konumda doğrulanmış {{signals}} sinyal', { signals: trust.verifiedSignals });

  return (
    <View accessibilityLabel={`${tx('profile:guide.title', 'Yerel rehber')}. ${summary}`} accessible style={styles.card} testID="local-guide">
      <View style={styles.head}>
        <View style={styles.icon}><ShieldCheck color={colors.primary} size={20} /></View>
        <View style={styles.headCopy}>
          <Text accessibilityRole="header" style={styles.title}>{tx('profile:guide.title', 'Yerel rehber')}</Text>
          <Text style={styles.subtitle}>{tx('profile:guide.subtitle', 'Yerinde doğrulanmış katkıların')}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.key} style={styles.stat}>
            <Text style={styles.value}>{format(stat.value)}</Text>
            <Text style={styles.label}>{stat.label}</Text>
            <Text style={styles.hint}>{stat.hint}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.md, padding: spacing.md, ...shadowSoft },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  icon: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radii.md, height: 40, justifyContent: 'center', width: 40 },
  headCopy: { flex: 1 },
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, flex: 1, gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  value: { ...typography.title, color: colors.primary, fontVariant: ['tabular-nums'] },
  label: { ...typography.label, color: colors.text },
  hint: { ...typography.micro, color: colors.textSecondary, textAlign: 'center' },
});
