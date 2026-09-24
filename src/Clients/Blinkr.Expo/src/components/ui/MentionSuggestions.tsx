import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { searchUsers } from '../../api';
import { activeMention } from '../../richText';
import { colors, radii, shadowSoft, spacing, typography } from '../../theme';
import type { AuthResponse, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';

const DEBOUNCE_MS = 300;
const MAX_ROWS = 5;
/** Friends first, then everyone else as the server sorted them. */
const rank = (u: UserSummary) => (u.relation === 'friends' ? 0 : 1);

type Props = {
  auth: AuthResponse | null;
  text: string;
  cursor: number;
  /** A person was chosen: the caller replaces the @word (insertMention). */
  onPick: (user: UserSummary) => void;
};

/**
 * "@" suggestions (V2-4, D-027): while the word at the cursor starts with @, people matching it (friends first), 300 ms
 * after typing stops. The server decides who is really mentioned; this only helps to spell the name.
 */
export function MentionSuggestions({ auth, text, cursor, onPick }: Props) {
  const { t } = useTranslation('signal');
  const active = activeMention(text, cursor);
  const query = active && active.query.length >= 1 ? active.query : null;
  const [people, setPeople] = useState<UserSummary[]>([]);

  useEffect(() => {
    if (!auth || !query) { setPeople([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // The server searches from two letters; one letter still shows nothing rather than everyone.
      if (query.length < 2) { setPeople([]); return; }
      searchUsers(auth, query, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setPeople(found.filter((u) => u.id !== auth.userId && u.relation !== 'blocked').sort((a, b) => rank(a) - rank(b)).slice(0, MAX_ROWS));
        })
        .catch(() => { if (!controller.signal.aborted) setPeople([]); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [auth, query]);

  if (!query || people.length === 0) return null;
  return (
    <View accessibilityLabel={t('mentions.suggestions')} style={styles.list} testID="mention-suggestions">
      {people.map((user) => (
        <AnimatedPressable accessibilityLabel={t('mentions.pick', { name: user.userName })} accessibilityRole="button" key={user.id} onPress={() => onPick(user)} pressScale={0.98} style={styles.row}>
          <Avatar avatarKey={user.avatarKey} seed={user.id} size={28} />
          <Text numberOfLines={1} style={styles.name}>@{user.userName}</Text>
          {user.relation === 'friends' ? <Text style={styles.badge}>{t('mentions.friend')}</Text> : null}
        </AnimatedPressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { ...shadowSoft, backgroundColor: colors.surfaceElevated, borderRadius: radii.md, paddingVertical: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  badge: { ...typography.micro, color: colors.textSecondary, marginLeft: 'auto' },
});
