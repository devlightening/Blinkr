import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MapPin, Search, ChevronRight } from 'lucide-react-native';
import { searchPlaces } from '../api';
import { formatCategory, formatDistance } from '../presentation';
import { friendlyError } from '../productPresentation';
import { colors, typography, sizes, spacing } from '../theme';
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
      <Pressable accessibilityLabel="Yer seçimine dön" onPress={onBack} style={styles.icon}><ArrowLeft color={colors.ink} /></Pressable>
      <Text style={styles.heading}>Yer seç</Text>
    </View>
    <View style={styles.search}><Search size={20} color={colors.muted} /><TextInput accessibilityLabel="Yer adı veya kategori" autoFocus maxLength={80} value={query} onChangeText={setQuery} placeholder="Yer adı veya kategori" style={styles.input} /></View>
    {loading && <ActivityIndicator style={styles.progress} color={colors.green} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <ScrollView keyboardShouldPersistTaps="handled">
      {results.map(place => <Pressable accessibilityLabel={`${place.name}, ${formatDistance(place.distanceMeters)}, seç`} key={place.id} onPress={() => onSelect(place)} style={styles.row}>
        <MapPin color={colors.green} size={22} /><View style={styles.flex}><Text style={styles.name}>{place.name}</Text><Text style={styles.caption}>{formatCategory(place.category)} · {formatDistance(place.distanceMeters)}</Text></View><ChevronRight color={colors.muted} size={18} />
      </Pressable>)}
      {!loading && !results.length && <Text style={styles.empty}>Bu arama için yakınında eşleşen yer bulunamadı.</Text>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  icon: { width: sizes.touch, height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  heading: { ...typography.heading, color: colors.ink }, search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, paddingHorizontal: 12, gap: 8 },
  input: { ...typography.body, minHeight: 50, flex: 1 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { ...typography.body, fontWeight: '600', color: colors.ink }, caption: { ...typography.caption, color: colors.muted, marginTop: 4 },
  progress: { marginTop: 12 }, error: { ...typography.caption, color: colors.error, padding: 12 }, empty: { ...typography.body, color: colors.muted, paddingVertical: 24 },
});
