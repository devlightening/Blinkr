import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react-native';
import { searchPlaces } from '../api';
import { formatCategory, formatDistance } from '../presentation';
import { friendlyError } from '../productPresentation';
import { AnimatedPressable } from './AnimatedPressable';
import { PlaceSymbol } from './PlaceSymbol';
import { categoryTone, colors, radii, typography, sizes, spacing } from '../theme';
import type { BlinkrPlace } from '../types';

export function PlacePicker({ origin, nearby, onSelect, onBack }: {
  origin: { latitude: number; longitude: number } | null; nearby: BlinkrPlace[];
  onSelect: (place: BlinkrPlace) => void; onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(nearby);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lat = origin?.latitude;
  const lon = origin?.longitude;
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    if (!query.trim() || lat == null || lon == null) { setResults(nearby); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const next = await searchPlaces(query.trim(), lat, lon, controller.signal);
        if (!controller.signal.aborted) setResults(next);
      } catch (err) {
        if (!controller.signal.aborted) setError(friendlyError(err, 'Yerler aranamadı. Tekrar dene.'));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, lat, lon, nearby]);
  return <View style={styles.flex}>
    <View style={styles.bar}>
      <AnimatedPressable accessibilityLabel="Yer seçimine dön" accessibilityRole="button" onPress={onBack} pressScale={0.88} style={styles.back}>
        <ArrowLeft color={colors.text} size={22} />
      </AnimatedPressable>
      <Text accessibilityRole="header" style={styles.heading}>Yer seç</Text>
    </View>
    <View style={styles.search}>
      <Search size={20} color={colors.textSecondary} />
      <TextInput accessibilityLabel="Yer adı veya kategori" autoFocus maxLength={80} onChangeText={setQuery} placeholder="Yer adı veya kategori" placeholderTextColor={colors.textSecondary} style={styles.input} value={query} />
    </View>
    {loading && <ActivityIndicator accessibilityLabel="Aranıyor" style={styles.progress} color={colors.mint} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {results.map((place, index) => {
        const tone = categoryTone(place.category);
        return (
          <Animated.View entering={FadeInDown.duration(260).delay(Math.min(index, 8) * 35)} key={place.id}>
            <AnimatedPressable accessibilityLabel={`${place.name}, ${formatDistance(place.distanceMeters)}, seç`} accessibilityRole="button" onPress={() => onSelect(place)} pressScale={0.97} style={styles.row}>
              <View style={[styles.tile, { borderColor: tone }]}><PlaceSymbol category={place.category} color={tone} size={20} /></View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.name}>{place.name}</Text>
                <Text style={styles.caption}>{formatCategory(place.category)} · {formatDistance(place.distanceMeters)}</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </AnimatedPressable>
          </Animated.View>
        );
      })}
      {!loading && !results.length && <Text style={styles.empty}>Bu arama için yakınında eşleşen yer bulunamadı.</Text>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginVertical: spacing.md },
  back: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  heading: { ...typography.title, color: colors.text },
  search: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 54 },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm },
  tile: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.sm + 2, borderWidth: 2, height: 44, justifyContent: 'center', width: 44 },
  name: { ...typography.bodyStrong, color: colors.text },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  progress: { marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, padding: spacing.md },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.xl },
});
