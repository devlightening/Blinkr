import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ArrowLeft, Search, UserRound } from 'lucide-react-native';

import { searchUsers } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { colors, motion, radii, typography, sizes, spacing } from '../../theme';
import type { AuthResponse, UserSummary } from '../../types';
import { Avatar } from '../Avatar';

const MIN_QUERY_LENGTH = 2;

export function UserSearchSheet({ auth, onBack, onSelect }: {
  auth: AuthResponse; onBack: () => void; onSelect: (user: UserSummary) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    if (query.trim().length < MIN_QUERY_LENGTH) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const next = await searchUsers(auth, query.trim(), controller.signal);
        // You cannot start a conversation with yourself, so you are never offered as a result.
        if (!controller.signal.aborted) setResults(next.filter((user) => user.id !== auth.userId));
      } catch (err) {
        if (!controller.signal.aborted) setError(friendlyError(err, 'Kullanıcılar aranamadı. Tekrar dene.'));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, auth]);

  const searched = query.trim().length >= MIN_QUERY_LENGTH;

  return <View style={styles.flex}>
    <View style={styles.bar}>
      <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <Text accessibilityRole="header" style={styles.heading}>Yeni mesaj</Text>
    </View>
    <View style={styles.search}>
      <Search size={18} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel="Kullanıcı adı"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={40}
        onChangeText={setQuery}
        placeholder="Kullanıcı adı ara"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={query}
      />
    </View>
    {loading && <ActivityIndicator accessibilityLabel="Aranıyor" style={styles.progress} color={colors.primary} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {results.map((user) => (
        <Animated.View entering={FadeIn.duration(motion.base)} key={user.id}>
          <AnimatedPressable accessibilityLabel={`${user.userName} ile mesajlaş`} accessibilityRole="button" onPress={() => onSelect(user)} pressScale={0.97} style={styles.row}>
            <Avatar avatarKey={user.avatarKey} seed={user.id} size={44} />
            <Text numberOfLines={1} style={styles.name}>{user.userName}</Text>
          </AnimatedPressable>
        </Animated.View>
      ))}
      {!loading && !error && searched && !results.length && (
        <View style={styles.empty}>
          <UserRound color={colors.textSecondary} size={26} />
          <Text style={styles.emptyText}>Bu isimde bir kullanıcı bulunamadı.</Text>
        </View>
      )}
      {!searched && (
        <Text style={styles.hint}>Konuşmak istediğin kişinin kullanıcı adını yaz (en az {MIN_QUERY_LENGTH} harf).</Text>
      )}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { minHeight: 380 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.sm, width: sizes.touch },
  heading: { ...typography.heading, color: colors.text },
  search: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: sizes.touch },
  progress: { marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, paddingTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  name: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.xl, textAlign: 'center' },
});
