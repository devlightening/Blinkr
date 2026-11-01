import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { followUser, unfollowUser } from '../../api';
import { followAfter, followButton, type FollowState } from '../../follows';
import { success } from '../../haptics';
import { colors, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { BlinkrButton } from '../ui/BlinkrButton';

type Props = {
  auth: AuthResponse;
  userId: string;
  state: FollowState;
  followsYou?: boolean;
  /** A private account turns a follow into a request. */
  isPrivate?: boolean;
  onChange: (next: FollowState, before: FollowState) => void;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
};

/**
 * Follow / Following / Requested (sinyal-mvp-plan P6.4). Optimistic: the new state shows at once and rolls back on
 * failure. Unfollowing asks once more inline, so a stray tap never drops someone.
 */
export function FollowButton({ auth, userId, state, followsYou = false, isPrivate = false, onChange, refresh = {} }: Props) {
  const { t } = useTranslation('profile');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const button = followButton(state, followsYou);
  if (!button) return null;

  const run = async (action: 'follow' | 'unfollow' | 'cancel') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setConfirming(false);
    const before = state;
    const optimistic = followAfter(action, isPrivate);
    onChange(optimistic, before);
    try {
      const result = action === 'follow' ? await followUser(auth, userId, refresh) : await unfollowUser(auth, userId, refresh);
      if (result.follow !== optimistic) onChange(result.follow, optimistic); // the server knows best (e.g. it just went private)
      if (action === 'follow') success();
    } catch {
      onChange(before, optimistic);
      setError(t('follow.failed'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <View style={styles.confirm}>
        <BlinkrButton
          label={state === 'requested' ? t('follow.cancelRequest') : t('follow.unfollow')}
          onPress={() => { void run(state === 'requested' ? 'cancel' : 'unfollow'); }}
          style={styles.flex}
          variant="danger"
        />
        <BlinkrButton label={t('lists.cancel')} onPress={() => setConfirming(false)} style={styles.flex} variant="ghost" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <BlinkrButton
        disabled={busy}
        label={t(button.labelKey)}
        onPress={() => (button.action === 'follow' ? void run('follow') : setConfirming(true))}
        variant={button.primary ? 'primary' : 'secondary'}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  confirm: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  error: { ...typography.caption, color: colors.danger },
});
