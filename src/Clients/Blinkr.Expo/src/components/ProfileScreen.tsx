import { Bookmark, ChevronRight, LogOut, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCategory } from '../presentation';
import { friendlyError } from '../productPresentation';
import { listSavedPlaces, toPlace, type SavedPlace } from '../savedPlaces';
import { categoryTone, colors, radii, spacing, typography } from '../theme';
import type { AuthResponse, BlinkrPlace } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { PlaceSymbol } from './PlaceSymbol';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrCard } from './ui/BlinkrCard';
import { bottomBarClearance } from './ui/BlinkrBottomBar';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { BlinkrHeader } from './ui/BlinkrHeader';

type Props = {
  auth: AuthResponse;
  onLogout: () => void;
  /** Opens a saved Place on the map. */
  onOpenPlace: (place: BlinkrPlace) => void;
};

/**
 * Profile shows only what the app really knows: who is signed in, the places saved on this device
 * and the privacy promise. Counters, badges, ratings and a contributions feed appear only once a
 * backend exists to back them - nothing here is decorative data.
 */
export function ProfileScreen({ auth, onLogout, onOpenPlace }: Props) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSaved(await listSavedPlaces(auth.userId));
    } catch (err) {
      setSaved((current) => current ?? []);
      setError(friendlyError(err, 'Kaydedilen yerler okunamadı.'));
    }
  }, [auth.userId]);

  useEffect(() => { void load(); }, [load]);

  const initial = auth.userName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <BlinkrHeader subtitle={<Text style={styles.headerSub}>SENİN ÇEVREN</Text>} />

        <BlinkrCard style={styles.identity}>
          <View style={styles.ring}><Text style={styles.ringText}>{initial}</Text></View>
          <View style={styles.identityCopy}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{auth.userName}</Text>
            <Text numberOfLines={1} style={styles.email}>{auth.email}</Text>
          </View>
          <View style={styles.stat}>
            <Bookmark color={colors.mint} size={20} />
            <Text style={styles.statValue}>{saved ? saved.length : '–'}</Text>
            <Text style={styles.statLabel}>Kaydedilen</Text>
          </View>
        </BlinkrCard>

        <BlinkrCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}><Bookmark color={colors.ink} size={20} /></View>
            <View style={styles.sectionCopy}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Kaydettiğin yerler</Text>
              <Text style={styles.sectionSub}>Bu cihazda saklanır</Text>
            </View>
          </View>

          {saved === null ? (
            <ActivityIndicator accessibilityLabel="Yükleniyor" color={colors.mint} style={styles.loading} />
          ) : error ? (
            <View style={styles.inline}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <BlinkrButton label="Tekrar dene" onPress={() => void load()} variant="secondary" />
            </View>
          ) : saved.length === 0 ? (
            <BlinkrEmptyState
              description="Haritada bir yerin detayını açıp yer imi simgesine dokunarak kaydet."
              icon={<Bookmark color={colors.textSecondary} size={30} />}
              style={styles.empty}
              title="Henüz kayıtlı yerin yok"
            />
          ) : (
            <View>
              {saved.map((place, index) => {
                const tone = categoryTone(place.category);
                return (
                  <AnimatedPressable
                    accessibilityLabel={`${place.name}, haritada aç`}
                    accessibilityRole="button"
                    key={place.id}
                    onPress={() => onOpenPlace(toPlace(place))}
                    pressScale={0.98}
                    style={[styles.row, index > 0 && styles.rowDivider]}
                  >
                    <View style={[styles.rowIcon, { borderColor: tone }]}>
                      <PlaceSymbol category={place.category} color={tone} size={22} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{place.name}</Text>
                      <Text numberOfLines={1} style={styles.rowSub}>{formatCategory(place.category)}</Text>
                    </View>
                    <ChevronRight color={colors.textSecondary} size={22} />
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </BlinkrCard>

        <BlinkrCard style={styles.privacy}>
          <ShieldCheck color={colors.mint} size={24} />
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Gizlilik</Text>
            <Text style={styles.sectionSub}>Kesin cihaz konumun diğer kullanıcılara gösterilmez.</Text>
          </View>
        </BlinkrCard>

        <BlinkrButton icon={<LogOut color={colors.danger} size={20} />} label="Oturumu kapat" onPress={onLogout} variant="danger" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { gap: spacing.lg, paddingHorizontal: spacing.md },
  headerSub: { ...typography.label, color: colors.mint },
  identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  ring: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 3, height: 72, justifyContent: 'center', width: 72 },
  ringText: { ...typography.headline, color: colors.text },
  identityCopy: { flex: 1 },
  name: { ...typography.title, color: colors.text },
  email: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { ...typography.title, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  section: { padding: 0 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  sectionIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  sectionCopy: { flex: 1 },
  sectionTitle: { ...typography.bodyStrong, color: colors.text },
  sectionSub: { ...typography.caption, color: colors.textSecondary },
  loading: { paddingBottom: spacing.xl },
  inline: { gap: spacing.md, padding: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  empty: { paddingBottom: spacing.xl },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.lg },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 2, height: 46, justifyContent: 'center', width: 46 },
  rowCopy: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  privacy: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
});
