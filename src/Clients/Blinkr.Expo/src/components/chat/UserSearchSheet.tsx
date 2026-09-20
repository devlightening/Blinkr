import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, ChevronRight, Search, UserRound } from 'lucide-react-native';

import { searchUsers } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { colors, radii, typography, sizes, spacing } from '../../theme';
import type { AuthResponse, UserSummary } from '../../types';

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
      <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.88} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <Text accessibilityRole="header" style={styles.heading}>Yeni mesaj</Text>
    </View>
    <View style={styles.search}>
      <Search size={20} color={colors.textSecondary} />
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
    {loading && <ActivityIndicator accessibilityLabel="Aranıyor" style={styles.progress} color={colors.mint} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {results.map((user, index) => (
        <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 30)} key={user.id}>
          <AnimatedPressable accessibilityLabel={`${user.userName} ile mesajlaş`} accessibilityRole="button" onPress={() => onSelect(user)} pressScale={0.97} style={styles.row}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user.userName.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text></View>
            <Text numberOfLines={1} style={styles.name}>{user.userName}</Text>
            <ChevronRight color={colors.textSecondary} size={22} />
          </AnimatedPressable>
        </Animated.View>
      ))}
      {!loading && !error && searched && !results.length && (
        <View style={styles.empty}>
          <UserRound color={colors.textSecondary} size={30} />
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
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  back: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  heading: { ...typography.title, color: colors.text },
  search: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 54 },
  progress: { marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, paddingTop: spacing.md },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { ...typography.bodyStrong, color: colors.text },
  name: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  hint: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.xl, textAlign: 'center' },
});
