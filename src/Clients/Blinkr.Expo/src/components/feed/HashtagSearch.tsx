import { Hash, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchHashtags } from '../../api';
import { foldTag } from '../../richText';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';

type Props = {
  auth: AuthResponse;
  refresh: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  onOpen: (tag: string) => void;
  bottomPadding: number;
};

const DEBOUNCE_MS = 300;

/**
 * Keşfet > # (V2-6): find a hashtag. Suggestions are tags used in the last 30 days that start with what was typed
 * (folded like the stored ones, so "akşam" finds #aksamkahvesi), most used first; the typed tag itself can always be
 * opened. Opening shows its feed inside Keşfet.
 */
export function HashtagSearch({ auth, refresh, onOpen, bottomPadding }: Props) {
  const { t } = useTranslation('feed');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Array<{ tag: string; postCount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const folded = foldTag(query);

  useEffect(() => {
    if (folded.length === 0) { setRows([]); setLoading(false); setFailed(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchHashtags(auth, folded, controller.signal, refresh)
        .then((found) => { if (!controller.signal.aborted) { setRows(found); setFailed(false); } })
        .catch(() => { if (!controller.signal.aborted) setFailed(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [auth, folded, refresh]);

  const exact = rows.some((row) => row.tag === folded);
  const data = folded.length >= 2 && !exact ? [{ tag: folded, postCount: -1 }, ...rows] : rows;

  return (
    <View style={styles.root}>
      <View style={styles.searchBox}>
        <Search color={colors.textSecondary} size={18} />
        <TextInput
          accessibilityLabel={t('hashtags.search')}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={t('hashtags.search')}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          onSubmitEditing={() => { if (folded.length >= 2) onOpen(folded); }}
          style={styles.input}
          testID="hashtag-search-input"
          value={query}
        />
        {loading ? <ActivityIndicator color={colors.textSecondary} size="small" /> : null}
      </View>
      {failed ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{t('hashtags.failed')}</Text> : null}
      <FlatList
        ListEmptyComponent={folded.length === 0 ? (
          <BlinkrEmptyState description={t('hashtags.hintBody')} icon={<Hash color={colors.textSecondary} size={32} />} style={styles.empty} title={t('hashtags.hintTitle')} />
        ) : null}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        data={data}
        keyExtractor={(row) => row.tag}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <AnimatedPressable accessibilityLabel={`#${item.tag}`} accessibilityRole="button" onPress={() => onOpen(item.tag)} pressScale={0.98} style={styles.row} testID={`hashtag-row-${item.tag}`}>
            <View style={styles.hashIcon}><Hash color={colors.primary} size={18} /></View>
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={styles.tag}>#{item.tag}</Text>
              <Text style={styles.count}>{item.postCount < 0 ? t('hashtags.openTyped') : t('hashtags.count', { count: item.postCount })}</Text>
            </View>
          </AnimatedPressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm, paddingHorizontal: spacing.lg },
  searchBox: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 44 },
  notice: { ...typography.caption, color: colors.textSecondary },
  empty: { marginTop: spacing.xxl },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56 },
  hashIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  rowCopy: { flex: 1 },
  tag: { ...typography.bodyStrong, color: colors.text },
  count: { ...typography.caption, color: colors.textSecondary },
});
