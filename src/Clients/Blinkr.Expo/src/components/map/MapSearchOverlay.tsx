import * as Location from 'expo-location';
import { ArrowLeft, Bookmark, Clock3, MapPin, Search, Trash2, UserRound, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listFriends, searchPlaces, searchUsers } from '../../api';
import { orderPeople, relationLabel } from '../../friends';
import { distanceMeters } from '../../nearbyRequestOwnership';
import { formatCategory, formatDistance } from '../../presentation';
import { friendlyError } from '../../productPresentation';
import {
  CATEGORY_SHORTCUTS, MIN_QUERY_LENGTH, distanceTier, highlightSegments, isLiveResult, isSearchableQuery, rankPlaces, recentToPlace, toRecentSearch,
  type RankedPlace, type RecentSearch,
} from '../../placeSearch';
import { clearRecentSearches, listRecentSearches, rememberSearch } from '../../recentSearches';
import { listSavedPlaces, toPlace, type SavedPlace } from '../../savedPlaces';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, BlinkrPlace, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { PlaceSymbol } from '../PlaceSymbol';
import { BlinkrChip } from '../ui/BlinkrChip';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SegmentedControl } from '../ui/BlinkrSegmentedControl';
import { tx } from '../../i18n/tx';

type Origin = { latitude: number; longitude: number };
type SearchMode = 'places' | 'people';

type Props = {
  auth: AuthResponse;
  /** The map centre: results are ranked around what the person is looking at, not only around the device. */
  origin: Origin;
  onClose: () => void;
  onSelectPlace: (place: BlinkrPlace) => void;
  /** An address or district that is not a catalogue Place: the map just moves there. */
  onSelectLocation: (target: Origin & { label: string }) => void;
  /** 04 §1.1/P3.13: tx('map:search.people', 'Kişiler') is the other half of this screen's Yerler|Kişiler tabs. */
  onSelectPerson: (user: UserSummary) => void;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';
const DEBOUNCE_MS = 250;
const SEARCH_RADIUS_METERS = 30_000;
/** When the map is looking somewhere else than the person is, both places are searched. */
const SECOND_ORIGIN_MIN_METERS = 25_000;
const TIER_TITLES = [tx('map:search.tierNear', 'Yakınında'), tx('map:search.tierCity', 'Şehirde'), tx('map:search.tierOther', 'Diğer şehirler')];
const MIN_PEOPLE_QUERY_LENGTH = 2;

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <Text numberOfLines={1} style={styles.name}>
      {highlightSegments(text, query).map((segment, index) => (
        <Text key={index} style={segment.match ? styles.nameMatch : undefined}>{segment.text}</Text>
      ))}
    </Text>
  );
}

function ResultRow({ place, distance, query, onPress }: { place: BlinkrPlace; distance: number; query: string; onPress: () => void }) {
  const live = isLiveResult(place);
  const subtitle = [formatCategory(place.category), Number.isFinite(distance) ? formatDistance(distance) : '', place.displayAddress].filter(Boolean).join(' · ');
  return (
    <AnimatedPressable accessibilityLabel={tx('map:search.rowA11y', '{{name}}, {{subtitle}}. Haritada göster', { name: place.name, subtitle })} accessibilityRole="button" onPress={onPress} pressScale={0.99} style={styles.row}>
      <View style={styles.tile}><PlaceSymbol category={place.category} color={colors.textSecondary} size={18} /></View>
      <View style={styles.rowCopy}>
        <Highlighted query={query} text={place.name} />
        <Text numberOfLines={1} style={styles.sub}>{subtitle}</Text>
      </View>
      {live ? <Text style={styles.live}>{tx('common:live', 'Canlı')}</Text> : null}
    </AnimatedPressable>
  );
}

function SimpleRow({ icon, title, subtitle, onPress, label }: { icon: React.ReactNode; title: string; subtitle?: string; onPress: () => void; label: string }) {
  return (
    <AnimatedPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.99} style={styles.row}>
      <View style={styles.tile}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.name}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.sub}>{subtitle}</Text> : null}
      </View>
    </AnimatedPressable>
  );
}

/**
 * Full-screen tx('map:search.placeholder', 'Nereye gidiyorsun?'): type a place, a kind of place ("eczane") or a neighbourhood and go straight
 * there. Before typing it offers recent searches, saved places and one-tap categories. Results are ranked by how
 * well the name matches, then by distance from the map centre, and show what is live right now.
 */
export function MapSearchOverlay({ auth, origin, onClose, onSelectPlace, onSelectLocation, onSelectPerson }: Props) {
  const userId = auth.userId;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SearchMode>('places');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<RankedPlace[]>([]);
  const [place, setPlace] = useState<(Origin & { label: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [device, setDevice] = useState<Origin | null>(null);
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const deviceRef = useRef<Origin | null>(null);
  const generation = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const originRef = useRef(origin);
  originRef.current = origin;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    mounted.current = true;
    void listRecentSearches(userId).then((items) => { if (mounted.current) setRecents(items); });
    void listSavedPlaces(userId).then((items) => { if (mounted.current) setSaved(items.slice(0, 4)); }).catch(() => {});
    // Where the person is (when they allowed location): the search is about \"near ME\", not only about what the map shows.
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        const known = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60_000 });
        const position = known ?? await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]);
        if (position && mounted.current) {
          const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          deviceRef.current = here;
          setDevice(here);
        }
      } catch { /* no location: the map centre is used */ }
    })();
    const back = BackHandler.addEventListener('hardwareBackPress', () => { closeRef.current(); return true; });
    return () => { mounted.current = false; generation.current += 1; inFlight.current?.abort(); back.remove(); };
  }, [userId]);

  // Kişiler: before anything is typed, the people you are most likely to look for - your friends -
  // same shortcut UserSearchSheet.tsx (chat's "Yeni mesaj") offers, kept separate here since this
  // screen's frame (full-screen, Yerler tab alongside it) does not match that sheet's.
  useEffect(() => {
    const controller = new AbortController();
    listFriends(auth, controller.signal)
      .then((list) => { if (!controller.signal.aborted) setFriends(list.map((friend) => ({ id: friend.id, userName: friend.userName, avatarKey: friend.avatarKey, relation: 'friends' as const }))); })
      .catch(() => { /* the search still works without the shortcut list */ });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (mode !== 'people') return undefined;
    const controller = new AbortController();
    setPeopleError(null);
    const trimmed = query.trim();
    if (trimmed.length < MIN_PEOPLE_QUERY_LENGTH) { setPeople([]); setPeopleLoading(false); return undefined; }
    setPeopleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const next = await searchUsers(auth, trimmed, controller.signal);
        if (!controller.signal.aborted) setPeople(orderPeople(next.filter((user) => user.id !== userId)));
      } catch (err) {
        if (!controller.signal.aborted) setPeopleError(friendlyError(err, tx('common:people.searchFailed', 'Kullanıcılar aranamadı. Tekrar dene.')));
      } finally {
        if (!controller.signal.aborted) setPeopleLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, userId]);

  const runSearch = useCallback(async (text: string) => {
    const mine = ++generation.current;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const current = () => mounted.current && generation.current === mine;
    setStatus('loading');
    setError(null);
    try {
      // "Near me" comes first: the person's position when known, else the map centre. If the map is looking at
      // another city, that area is searched too. The catalogue search and the address lookup run together;
      // a failed address lookup is not an error.
      const mapCenter = originRef.current;
      const here = deviceRef.current;
      const primary = here ?? mapCenter;
      const origins = here && distanceMeters(here, mapCenter) > SECOND_ORIGIN_MIN_METERS ? [here, mapCenter] : [primary];
      const [lists, geocoded] = await Promise.all([
        Promise.all(origins.map((at) => searchPlaces(text.trim(), at.latitude, at.longitude, controller.signal, SEARCH_RADIUS_METERS, true))),
        text.trim().length >= 3 ? Location.geocodeAsync(text.trim()).catch(() => []) : Promise.resolve([]),
      ]);
      if (!current()) return;
      setResults(rankPlaces(text, lists.flat(), { origin: primary }));
      const hit = geocoded[0];
      setPlace(hit ? { latitude: hit.latitude, longitude: hit.longitude, label: text.trim() } : null);
      setStatus('ready');
    } catch (err) {
      if (!current()) return;
      setError(friendlyError(err, tx('map:search.failed', 'Arama şu anda yapılamadı. Tekrar dene.')));
      setStatus('error');
    }
  }, []);

  // Debounced typing; an unusable query clears the list instead of asking the server. Only runs in the
  // Yerler tab - the Kişiler tab has its own debounce effect above.
  useEffect(() => {
    if (mode !== 'places' || !isSearchableQuery(query)) {
      generation.current += 1;
      inFlight.current?.abort();
      setStatus('idle');
      setResults([]);
      setPlace(null);
      return undefined;
    }
    const timer = setTimeout(() => { void runSearch(query); }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mode, query, runSearch]);

  const choose = (target: BlinkrPlace) => {
    void rememberSearch(userId, toRecentSearch(target));
    onSelectPlace(target);
  };

  const searching = isSearchableQuery(query);
  const typed = query.trim().length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.bar}>
        <AnimatedPressable accessibilityLabel={tx('map:search.close', 'Aramayı kapat')} accessibilityRole="button" onPress={onClose} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <View style={styles.field}>
          <Search color={colors.textSecondary} size={18} />
          <TextInput
            accessibilityLabel={mode === 'places' ? tx('map:search.searchPlaces', 'Yer ara') : tx('map:search.searchPeople', 'Kullanıcı ara')}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            maxLength={80}
            onChangeText={setQuery}
            placeholder={mode === 'places' ? tx('map:search.placeholder', 'Nereye gidiyorsun?') : tx('common:people.searchUsername', 'Kullanıcı adı ara')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {typed ? (
            <AnimatedPressable accessibilityLabel={tx('map:search.clear', 'Aramayı temizle')} accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')} pressScale={0.9}>
              <X color={colors.textSecondary} size={18} />
            </AnimatedPressable>
          ) : null}
        </View>
      </View>
      <View style={styles.tabsRow}>
        <SegmentedControl accessibilityLabel={tx('map:search.modeA11y', 'Yerler veya kişiler')} onChange={setMode} options={[{ value: 'places', label: tx('map:search.places', 'Yerler') }, { value: 'people', label: tx('map:search.people', 'Kişiler') }]} value={mode} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {mode === 'people' ? (
          peopleError ? (
            <BlinkrEmptyState
              description={peopleError}
              icon={<WifiOff color={colors.textSecondary} size={26} />}
              style={styles.empty}
              title={tx('map:search.openFailed', 'Arama açılamadı')}
            />
          ) : (
            <>
              {!typed && friends.length > 0 ? <Text style={styles.section}>{tx('map:search.friends', 'Arkadaşların')}</Text> : null}
              {(typed ? people : friends).map((user) => (
                <SimpleRow
                  icon={<Avatar avatarKey={user.avatarKey} seed={user.id} size={40} />}
                  key={user.id}
                  label={tx('map:search.openProfile', '{{name}} profilini aç', { name: user.userName })}
                  onPress={() => onSelectPerson(user)}
                  subtitle={typed ? relationLabel(user.relation) : undefined}
                  title={user.userName}
                />
              ))}
              {peopleLoading && people.length === 0 ? <ActivityIndicator accessibilityLabel={tx('common:actions.searching', 'Aranıyor')} color={colors.primary} style={styles.loading} /> : null}
              {!peopleLoading && typed && query.trim().length >= MIN_PEOPLE_QUERY_LENGTH && people.length === 0 ? (
                <BlinkrEmptyState
                  description={tx('common:people.notFoundHint', 'Yazımı kontrol et ya da başka bir kullanıcı adı dene.')}
                  icon={<UserRound color={colors.textSecondary} size={26} />}
                  style={styles.empty}
                  title={tx('common:people.notFound', 'Kullanıcı bulunamadı')}
                />
              ) : null}
              {typed && query.trim().length < MIN_PEOPLE_QUERY_LENGTH ? <Text style={styles.hint}>Aramak için en az {MIN_PEOPLE_QUERY_LENGTH} harf yaz.</Text> : null}
            </>
          )
        ) : !searching ? (
          <>
            {typed ? <Text style={styles.hint}>Aramak için en az {MIN_QUERY_LENGTH} harf yaz.</Text> : null}
            <Text style={styles.section}>{tx('map:search.nearby', 'Yakınında ara')}</Text>
            <View style={styles.chips}>
              {CATEGORY_SHORTCUTS.map((item) => (
                <BlinkrChip key={item.id} label={item.label} onPress={() => setQuery(item.query)} selected={false} />
              ))}
            </View>

            {recents.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.section}>{tx('map:search.recent', 'Son aramalar')}</Text>
                  <AnimatedPressable accessibilityLabel={tx('map:search.clearRecent', 'Son aramaları temizle')} accessibilityRole="button" hitSlop={8} onPress={() => { setRecents([]); void clearRecentSearches(userId); }} pressScale={0.95} style={styles.clear}>
                    <Trash2 color={colors.textSecondary} size={14} />
                    <Text style={styles.clearText}>{tx('map:search.clearShort', 'Temizle')}</Text>
                  </AnimatedPressable>
                </View>
                {recents.map((item) => (
                  <SimpleRow icon={<Clock3 color={colors.textSecondary} size={18} />} key={item.id} label={tx('map:search.recentA11y', '{{name}}, son arama. Haritada göster', { name: item.name })} onPress={() => choose(recentToPlace(item))} subtitle={formatCategory(item.category)} title={item.name} />
                ))}
              </>
            ) : null}

            {saved.length > 0 ? (
              <>
                <Text style={styles.section}>{tx('map:search.saved', 'Kaydettiğin yerler')}</Text>
                {saved.map((item) => (
                  <SimpleRow icon={<Bookmark color={colors.textSecondary} size={18} />} key={item.id} label={tx('map:search.savedA11y', '{{name}}, kayıtlı yer. Haritada göster', { name: item.name })} onPress={() => choose(toPlace(item))} subtitle={formatCategory(item.category)} title={item.name} />
                ))}
              </>
            ) : null}
          </>
        ) : status === 'error' ? (
          <BlinkrEmptyState
            action={{ label: tx('common:actions.retry', 'Tekrar dene'), onPress: () => { void runSearch(query); } }}
            description={error ?? undefined}
            icon={<WifiOff color={colors.textSecondary} size={26} />}
            style={styles.empty}
            title={tx('map:search.openFailed', 'Arama açılamadı')}
          />
        ) : (
          <>
            {status === 'loading' && results.length === 0 ? <ActivityIndicator accessibilityLabel={tx('common:actions.searching', 'Aranıyor')} color={colors.primary} style={styles.loading} /> : null}
            {results.map(({ place: item, distanceMeters: meters }, index) => {
              const tier = distanceTier(meters);
              const startsTier = index === 0 || distanceTier(results[index - 1].distanceMeters) !== tier;
              // Section titles only appear when the results really span more than one distance band.
              const showTitle = startsTier && (tier > 0 || results.some((entry) => distanceTier(entry.distanceMeters) !== tier));
              return (
                <View key={item.id}>
                  {showTitle ? <Text style={styles.tierTitle}>{TIER_TITLES[tier]}</Text> : null}
                  <ResultRow distance={meters} onPress={() => choose(item)} place={item} query={query} />
                </View>
              );
            })}
            {place ? (
              <SimpleRow
                icon={<MapPin color={colors.primary} size={18} />}
                label={tx('map:search.goToA11y', '{{name}} konumuna git', { name: place.label })}
                onPress={() => onSelectLocation(place)}
                subtitle={tx('map:search.addressHint', 'Adres veya bölge · haritayı oraya taşı')}
                title={place.label}
              />
            ) : null}
            {status === 'ready' && results.length === 0 && !place ? (
              <BlinkrEmptyState
                description={tx('map:search.noResultsHint', 'Yazımı kontrol et ya da daha kısa bir ad dene. Tüm Türkiye\'de aradık.')}
                icon={<Search color={colors.textSecondary} size={26} />}
                style={styles.empty}
                title={tx('map:search.noResults', 'Sonuç bulunamadı')}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 60 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  field: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: sizes.touch },
  tabsRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  section: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  clear: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: spacing.lg, marginBottom: spacing.sm },
  clearText: { ...typography.label, color: colors.textSecondary, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60, paddingVertical: spacing.sm },
  tile: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, height: 40, justifyContent: 'center', width: 40 },
  rowCopy: { flex: 1, gap: 1 },
  name: { ...typography.bodyStrong, color: colors.text, fontWeight: '400' },
  nameMatch: { fontWeight: '700' },
  sub: { ...typography.caption, color: colors.textSecondary },
  live: { ...typography.label, color: colors.primary },
  loading: { marginTop: spacing.xl },
  tierTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  empty: { marginTop: spacing.xxl },
});
