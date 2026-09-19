import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Search, UserRound } from 'lucide-react-native';

import { searchUsers } from '../../api';
import { friendlyError } from '../../productPresentation';
import { AnimatedPressable } from '../AnimatedPressable';
import { colors, radii, typography, sizes, spacing } from '../../theme';
import type { AuthResponse, UserSummary } from '../../types';

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
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const next = await searchUsers(auth, query.trim(), controller.signal);
        if (!controller.signal.aborted) setResults(next);
      } catch (err) {
        if (!controller.signal.aborted) setError(friendlyError(err, 'Kullanıcılar aranamadı. Tekrar dene.'));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, auth]);

  return <View style={styles.flex}>
    <View style={styles.bar}>
      <AnimatedPressable accessibilityLabel="Geri dön" onPress={onBack} pressScale={0.88} style={styles.icon}><ArrowLeft color={colors.textPrimary} /></AnimatedPressable>
      <Text style={styles.heading}>Yeni mesaj</Text>
    </View>
    <View style={styles.search}>
      <Search size={20} color={colors.muted} />
      <TextInput accessibilityLabel="Kullanıcı adı" autoFocus maxLength={40} value={query} onChangeText={setQuery} placeholder="Kullanıcı adı ara" placeholderTextColor={colors.mutedSoft} style={styles.input} />
    </View>
    {loading && <ActivityIndicator style={styles.progress} color={colors.green} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled">
      {results.map((user, index) => (
        <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 30)} key={user.id}>
          <AnimatedPressable accessibilityLabel={`${user.userName} ile mesajlaş`} onPress={() => onSelect(user)} pressScale={0.97} style={styles.row}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user.userName.slice(0, 1).toUpperCase()}</Text></View>
            <Text style={styles.name}>{user.userName}</Text>
          </AnimatedPressable>
        </Animated.View>
      ))}
      {!loading && query.trim().length >= 2 && !results.length && (
        <View style={styles.empty}>
          <UserRound color={colors.mutedSoft} size={28} />
          <Text style={styles.emptyText}>Bu isimde bir kullanıcı bulunamadı.</Text>
        </View>
      )}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  icon: { width: sizes.touch, height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  heading: { ...typography.heading, color: colors.textPrimary },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: radii.control, paddingHorizontal: 12, gap: 8 },
  input: { ...typography.body, minHeight: 50, flex: 1, color: colors.textPrimary },
  progress: { marginTop: 12 },
  error: { ...typography.caption, color: colors.error, padding: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: radii.control, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  name: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
