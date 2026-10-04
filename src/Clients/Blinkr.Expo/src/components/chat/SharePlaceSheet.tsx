import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bookmark, CalendarClock, Search } from 'lucide-react-native';

import { foldSearchText } from '../../placeSearch';
import { formatCategory } from '../../presentation';
import { listSavedPlaces, type SavedPlace } from '../../savedPlaces';
import { liveStateFromCurrent } from '../../live/liveState';
import { usePlacesLive } from '../../usePlacesLive';
import { categoryTone, colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceSymbol } from '../PlaceSymbol';
import { LiveStateLine } from '../live/LiveStateLine';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { MeetupTimePicker } from './MeetupTimePicker';
import { tx } from '../../i18n/tx';

/**
 * Doc B5: share one of my saved places in a conversation with a single tap; the bubble then shows its live state (B1).
 * The calendar button on a row proposes meeting there instead (B2, a time picker in the same sheet). Only my own saved
 * list is read (account-synced, `savedPlaces.ts`); nothing about where I am is used or sent.
 */
export function SharePlaceSheet({ userId, onPick, onPropose }: { userId: string; onPick: (place: SavedPlace) => void; onPropose?: (place: SavedPlace, at: Date) => void }) {
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  const [query, setQuery] = useState('');
  const [proposing, setProposing] = useState<SavedPlace | null>(null);

  useEffect(() => {
    let alive = true;
    listSavedPlaces(userId)
      .then((list) => { if (alive) setSaved(list); })
      .catch(() => { if (alive) setSaved([]); });
    return () => { alive = false; };
  }, [userId]);

  const shown = useMemo(() => {
    const q = foldSearchText(query.trim());
    return (saved ?? []).filter((place) => !q || foldSearchText(place.name).includes(q));
  }, [query, saved]);
  const live = usePlacesLive(useMemo(() => (saved ?? []).map((place) => place.id), [saved]));

  if (proposing && onPropose) {
    return <MeetupTimePicker onBack={() => setProposing(null)} onPropose={(at) => onPropose(proposing, at)} placeName={proposing.name} />;
  }

  return (
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={styles.title}>{tx('chat:place.pickTitle', 'Yer paylaş')}</Text>
      <Text style={styles.hint}>{tx('chat:place.pickHint', 'Kayıtlı yerlerinden birini gönder; karşı taraf o yerin şu anki durumunu görür.')}</Text>
      {saved && saved.length > 6 ? (
        <View style={styles.searchField}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            accessibilityLabel={tx('chat:place.search', 'Kayıtlı yerlerde ara')}
            onChangeText={setQuery}
            placeholder={tx('chat:place.search', 'Kayıtlı yerlerde ara')}
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            value={query}
          />
        </View>
      ) : null}
      {saved === null ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : saved.length === 0 ? (
        <BlinkrEmptyState
          description={tx('chat:place.noSavedHint', 'Bir yerin sayfasında "Kaydet"e dokun; burada paylaşabilirsin.')}
          icon={<Bookmark color={colors.textSecondary} size={24} />}
          title={tx('chat:place.noSaved', 'Kayıtlı yerin yok')}
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {shown.map((place) => {
            const state = liveStateFromCurrent(live[place.id]?.currentState, Date.now());
            const tone = categoryTone(place.category);
            return (
              <View key={place.id} style={styles.rowWrap}>
                <AnimatedPressable
                  accessibilityLabel={tx('chat:place.sendA11y', '{{name}} yerini gönder', { name: place.name })}
                  accessibilityRole="button"
                  onPress={() => onPick(place)}
                  pressScale={0.98}
                  style={styles.row}
                >
                  <View style={[styles.tile, { backgroundColor: `${tone}26` }]}><PlaceSymbol category={place.category} color={tone} size={18} /></View>
                  <View style={styles.copy}>
                    <Text numberOfLines={1} style={styles.name}>{place.name}</Text>
                    {state.source === 'live' ? <LiveStateLine state={state} /> : <Text numberOfLines={1} style={styles.sub}>{formatCategory(place.category)}</Text>}
                  </View>
                </AnimatedPressable>
                {onPropose ? (
                  <AnimatedPressable accessibilityLabel={tx('chat:meetup.proposeAt', '{{name}} için buluşma öner', { name: place.name })} accessibilityRole="button" hitSlop={6} onPress={() => setProposing(place)} pressScale={0.92} style={styles.meet}>
                    <CalendarClock color={colors.primary} size={18} />
                  </AnimatedPressable>
                ) : null}
              </View>
            );
          })}
          {!shown.length ? <Text style={styles.hint}>{tx('chat:place.noMatch', 'Eşleşen kayıtlı yer yok')}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm, paddingBottom: spacing.md },
  title: { ...typography.title, color: colors.text, paddingHorizontal: spacing.xs },
  hint: { ...typography.callout, color: colors.textSecondary, paddingHorizontal: spacing.xs },
  searchField: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, height: 40, paddingHorizontal: spacing.md },
  searchInput: { ...typography.body, color: colors.text, flex: 1, paddingVertical: 0 },
  spinner: { paddingVertical: spacing.xl },
  list: { maxHeight: 420 },
  rowWrap: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  row: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  meet: { alignItems: 'center', backgroundColor: colors.primaryTint, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  tile: { alignItems: 'center', borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
});
