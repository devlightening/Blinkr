import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';

import { getAuthorTrust, type AuthorTrust } from '../../api';
import { colors, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { tx } from '../../i18n/tx';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/** The server's verified numbers for a person; null while loading, on failure, when locked, or when there is nothing verified yet. */
export function useAuthorTrust(auth: AuthResponse, userId: string, enabled: boolean, refresh?: Refresh): AuthorTrust | null {
  const [trust, setTrust] = useState<AuthorTrust | null>(null);

  useEffect(() => {
    if (!enabled) { setTrust(null); return undefined; }
    const controller = new AbortController();
    getAuthorTrust(auth, userId, controller.signal, refresh)
      .then((value) => { if (!controller.signal.aborted) setTrust(value); })
      .catch(() => { /* a reliability line is not worth an error */ });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, userId, enabled]);

  return trust && trust.verifiedSignals > 0 ? trust : null;
}

/**
 * Doc P6, the line that sets Blinkr apart from a follower count: "Konumda doğrulanmış 23 sinyal · 9 yer". The numbers
 * are the server's (VERIFIED_LIVE publications; anonymous ones never counted, no place names). Nothing is shown while
 * loading, on failure, behind a private account, or when there is nothing verified yet - it never shows a guess.
 */
export function TrustLine({ auth, userId, enabled = true, refresh }: {
  auth: AuthResponse;
  userId: string;
  /** False while the profile is locked (private account): the server would refuse anyway. */
  enabled?: boolean;
  refresh?: Refresh;
}) {
  const trust = useAuthorTrust(auth, userId, enabled, refresh);

  if (!trust) return null;
  const label = trust.verifiedPlaces > 0
    ? tx('profile:trust.line', 'Konumda doğrulanmış {{signals}} sinyal · {{places}} yer', { signals: trust.verifiedSignals, places: trust.verifiedPlaces })
    : tx('profile:trust.signalsOnly', 'Konumda doğrulanmış {{signals}} sinyal', { signals: trust.verifiedSignals });
  return (
    <View accessibilityLabel={label} accessible style={styles.row} testID="trust-line">
      <ShieldCheck color={colors.primary} size={15} />
      <Text numberOfLines={1} style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  text: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
});
