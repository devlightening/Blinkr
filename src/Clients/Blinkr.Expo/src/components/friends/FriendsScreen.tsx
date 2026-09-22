import { ArrowLeft, MessageCircle, Search, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listFriendRequests, listFriends, searchUsers } from '../../api';
import { runFriendAction } from '../../friendActions';
import { success } from '../../haptics';
import { badgeText, orderPeople, primaryAction, relationLabel, type FriendAction } from '../../friends';
import { friendlyError } from '../../productPresentation';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthResponse, Friend, FriendRequests, Relation, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { BlinkrButton } from '../ui/BlinkrButton';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { SkeletonList } from '../ui/BlinkrSkeleton';
import { UserProfileSheet } from './UserProfileSheet';

const MIN_QUERY_LENGTH = 2;
type Tab = 'friends' | 'requests' | 'add';
type Person = Pick<UserSummary, 'id' | 'userName' | 'avatarKey'>;

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onBack: () => void;
  /** Opens (or starts) a 1:1 conversation. */
  onMessage: (user: UserSummary) => void;
  /** Reports the real numbers after every load so the profile header and the tab-bar dot stay honest. */
  onCountsChange?: (counts: { friends: number; incoming: number }) => void;
  /** Tab to start on (e.g. "requests" when arriving from the request badge). */
  initialTab?: Tab;
};

function MiniButton({ label, onPress, primary = false, disabled = false, accessibilityLabel }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      pressScale={0.95}
      style={[styles.mini, primary ? styles.miniPrimary : styles.miniQuiet, disabled && styles.miniDisabled]}
    >
      <Text style={[styles.miniText, primary && styles.miniTextPrimary]}>{label}</Text>
    </AnimatedPressable>
  );
}

function PersonRow({ person, subtitle, onOpen, right }: { person: Person; subtitle?: string; onOpen: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <AnimatedPressable accessibilityLabel={`${person.userName}, profili aç`} accessibilityRole="button" onPress={onOpen} pressScale={0.98} style={styles.rowMain}>
        <Avatar avatarKey={person.avatarKey} seed={person.id} size={44} />
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.rowName}>{person.userName}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
      </AnimatedPressable>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );
}

/**
 * Friends, requests and finding people. Friendship is only for finding each other and messaging; nothing here shares a
 * location, and nobody's friend list is ever shown to anyone else.
 */
export function FriendsScreen({ auth, onAuthChange, onSessionExpired, onBack, onMessage, onCountsChange, initialTab = 'friends' }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequests | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<UserSummary | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const load = useRef<AbortController | null>(null);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };

  const loadAll = useCallback(async () => {
    load.current?.abort();
    const controller = new AbortController();
    load.current = controller;
    setError(null);
    try {
      const [nextFriends, nextRequests] = await Promise.all([
        listFriends(auth, controller.signal, refresh),
        listFriendRequests(auth, controller.signal, refresh),
      ]);
      if (controller.signal.aborted) return;
      setFriends(nextFriends);
      setRequests(nextRequests);
      onCountsChange?.({ friends: nextFriends.length, incoming: nextRequests.incoming.length });
    } catch (err) {
      // A failed refresh keeps whatever was already shown; only an empty screen shows the error.
      if (!controller.signal.aborted) setError(friendlyError(err, 'Arkadaş listesi yüklenemedi. Tekrar dene.'));
    } finally {
      if (load.current === controller) { load.current = null; setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token]);

  useEffect(() => { void loadAll(); return () => load.current?.abort(); }, [loadAll]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => back.remove();
  }, [onBack]);

  // Find people: debounced, abortable, and a stale answer never replaces a newer one.
  useEffect(() => {
    const controller = new AbortController();
    setSearchError(null);
    if (query.trim().length < MIN_QUERY_LENGTH) { setResults([]); setSearching(false); return undefined; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchUsers(auth, query.trim(), controller.signal);
        if (!controller.signal.aborted) setResults(orderPeople(found.filter((user) => user.id !== auth.userId)));
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(friendlyError(err, 'Kullanıcılar aranamadı. Tekrar dene.'));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, auth]);

  const act = async (userId: string, action: FriendAction) => {
    if (busy.has(userId)) return;
    setBusy((current) => new Set(current).add(userId));
    setActionError(null);
    try {
      const relation = await runFriendAction(auth, action, userId, refresh);
      if (action === 'add' || action === 'accept') success();
      setResults((current) => current.map((user) => (user.id === userId ? { ...user, relation } : user)));
      await loadAll();
    } catch (err) {
      setActionError(friendlyError(err, 'İşlem tamamlanamadı. Tekrar dene.'));
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(userId); return next; });
    }
  };

  const relationChanged = (userId: string, relation: Relation) => {
    setResults((current) => current.map((user) => (user.id === userId ? { ...user, relation } : user)));
    void loadAll();
  };

  const incomingCount = requests?.incoming.length ?? 0;
  const outgoingCount = requests?.outgoing.length ?? 0;
  const loadingFirst = friends === null && requests === null && !error;

  const friendsTab = friends && friends.length > 0 ? (
    friends.map((friend) => (
      <PersonRow
        key={friend.id}
        onOpen={() => setProfileUser({ id: friend.id, userName: friend.userName, avatarKey: friend.avatarKey, relation: 'friends' })}
        person={friend}
        right={(
          <AnimatedPressable accessibilityLabel={`${friend.userName} ile mesajlaş`} accessibilityRole="button" onPress={() => onMessage({ id: friend.id, userName: friend.userName, avatarKey: friend.avatarKey, relation: 'friends' })} pressScale={0.92} style={styles.iconButton}>
            <MessageCircle color={colors.text} size={20} />
          </AnimatedPressable>
        )}
      />
    ))
  ) : (
    <BlinkrEmptyState
      action={{ label: 'Arkadaş ekle', onPress: () => setTab('add'), icon: <UserPlus color={colors.ink} size={20} /> }}
      description="Kullanıcı adıyla arayıp arkadaşlık isteği gönderebilirsin. Arkadaşların sohbette önce görünür."
      icon={<Users color={colors.textSecondary} size={24} />}
      style={styles.empty}
      title="Henüz arkadaşın yok"
    />
  );

  const requestsTab = requests && (incomingCount > 0 || outgoingCount > 0) ? (
    <View style={styles.sections}>
      {incomingCount > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Gelen istekler</Text>
          {requests.incoming.map((request) => (
            <PersonRow
              key={request.id}
              onOpen={() => setProfileUser({ id: request.id, userName: request.userName, avatarKey: request.avatarKey, relation: 'incoming' })}
              person={request}
              right={(
                <View style={styles.pair}>
                  <MiniButton accessibilityLabel={`${request.userName} isteğini kabul et`} disabled={busy.has(request.id)} label="Kabul et" onPress={() => void act(request.id, 'accept')} primary />
                  <MiniButton accessibilityLabel={`${request.userName} isteğini reddet`} disabled={busy.has(request.id)} label="Reddet" onPress={() => void act(request.id, 'decline')} />
                </View>
              )}
            />
          ))}
        </View>
      ) : null}
      {outgoingCount > 0 ? (
        <View>
          <Text style={styles.sectionTitle}>Gönderilen istekler</Text>
          {requests.outgoing.map((request) => (
            <PersonRow
              key={request.id}
              onOpen={() => setProfileUser({ id: request.id, userName: request.userName, avatarKey: request.avatarKey, relation: 'outgoing' })}
              person={request}
              right={<MiniButton accessibilityLabel={`${request.userName} isteğini geri al`} disabled={busy.has(request.id)} label="Geri al" onPress={() => void act(request.id, 'cancel')} />}
              subtitle="Yanıt bekleniyor"
            />
          ))}
        </View>
      ) : null}
    </View>
  ) : (
    <BlinkrEmptyState
      description="Sana gelen ve senin gönderdiğin arkadaşlık istekleri burada görünür."
      icon={<UserPlus color={colors.textSecondary} size={24} />}
      style={styles.empty}
      title="Bekleyen istek yok"
    />
  );

  const searched = query.trim().length >= MIN_QUERY_LENGTH;
  const addTab = (
    <View>
      <View style={styles.search}>
        <Search color={colors.textSecondary} size={18} />
        <TextInput
          accessibilityLabel="Kullanıcı adı ara"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
          onChangeText={setQuery}
          placeholder="Kullanıcı adı ara"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={query}
        />
      </View>
      {searching ? <ActivityIndicator accessibilityLabel="Aranıyor" color={colors.primary} style={styles.progress} /> : null}
      {searchError ? <Text accessibilityRole="alert" style={styles.error}>{searchError}</Text> : null}
      {results.map((user) => {
        const main = primaryAction(user.relation);
        const label = relationLabel(user.relation);
        return (
          <PersonRow
            key={user.id}
            onOpen={() => setProfileUser(user)}
            person={user}
            right={user.relation === 'incoming' ? (
              <MiniButton accessibilityLabel={`${user.userName} isteğini kabul et`} disabled={busy.has(user.id)} label="Kabul et" onPress={() => void act(user.id, 'accept')} primary />
            ) : main ? (
              <MiniButton accessibilityLabel={main.action === 'add' ? `${user.userName} için arkadaşlık isteği gönder` : `${user.userName} isteğini geri al`} disabled={busy.has(user.id)} label={main.action === 'add' ? 'Ekle' : 'Geri al'} onPress={() => void act(user.id, main.action)} primary={main.action === 'add'} />
            ) : label ? <Text style={styles.relationLabel}>{label}</Text> : null}
            subtitle={user.relation === 'incoming' ? 'Seni ekledi' : undefined}
          />
        );
      })}
      {!searching && !searchError && searched && results.length === 0 ? (
        <BlinkrEmptyState description="Yazımı kontrol et ya da başka bir kullanıcı adı dene." icon={<Search color={colors.textSecondary} size={24} />} style={styles.empty} title="Kullanıcı bulunamadı" />
      ) : null}
      {!searched ? <Text style={styles.hint}>Eklemek istediğin kişinin kullanıcı adını yaz (en az {MIN_QUERY_LENGTH} harf).</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={onBack} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>Arkadaşlar</Text>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {([['friends', 'Arkadaşlarım', friends ? String(friends.length) : ''], ['requests', 'İstekler', incomingCount > 0 ? badgeText(incomingCount) : ''], ['add', 'Ekle', '']] as const).map(([id, label, count]) => (
          <AnimatedPressable accessibilityLabel={count && id === 'requests' ? `${label}, ${count} yeni` : label} accessibilityRole="tab" aria-selected={tab === id} key={id} onPress={() => setTab(id)} pressScale={0.97} style={[styles.tabItem, tab === id && styles.tabItemActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
            {count ? <Text style={[styles.count, id === 'requests' && styles.countAlert]}>{count}</Text> : null}
          </AnimatedPressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void loadAll(); }} refreshing={refreshing} tintColor={colors.mint} />}
        showsVerticalScrollIndicator={false}
      >
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
        {tab === 'add' ? addTab : loadingFirst ? <SkeletonList rows={5} />
          : error && !friends ? (
            <View style={styles.inline}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <BlinkrButton label="Tekrar dene" onPress={() => void loadAll()} variant="secondary" />
            </View>
          ) : tab === 'friends' ? friendsTab : requestsTab}
      </ScrollView>

      {profileUser ? (
        <UserProfileSheet
          auth={auth}
          onAuthChange={onAuthChange}
          onClose={() => setProfileUser(null)}
          onMessage={(user) => { setProfileUser(null); onMessage(user); }}
          onRelationChange={relationChanged}
          onSessionExpired={onSessionExpired}
          user={profileUser}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 20 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.sm, width: sizes.touch },
  title: { ...typography.title, color: colors.text },
  tabs: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: 2, marginHorizontal: spacing.lg, padding: 3 },
  tabItem: { alignItems: 'center', borderRadius: radii.md - 3, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 38 },
  tabItemActive: { backgroundColor: colors.surfaceElevated },
  tabText: { ...typography.label, color: colors.textSecondary },
  tabTextActive: { color: colors.text },
  count: { ...typography.micro, color: colors.textSecondary },
  countAlert: { backgroundColor: colors.danger, borderRadius: radii.pill, color: colors.ink, minWidth: 18, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 1, textAlign: 'center' },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  sections: { gap: spacing.lg },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 60 },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minHeight: 60 },
  rowCopy: { flex: 1 },
  rowName: { ...typography.bodyStrong, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary },
  rowRight: { alignItems: 'center', flexDirection: 'row' },
  pair: { flexDirection: 'row', gap: spacing.xs },
  iconButton: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  mini: { alignItems: 'center', borderRadius: radii.pill, justifyContent: 'center', minHeight: 34, paddingHorizontal: spacing.md },
  miniPrimary: { backgroundColor: colors.primary },
  miniQuiet: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
  miniDisabled: { opacity: 0.5 },
  miniText: { ...typography.label, color: colors.text },
  miniTextPrimary: { color: colors.ink },
  relationLabel: { ...typography.label, color: colors.textSecondary },
  search: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: sizes.touch },
  progress: { marginTop: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  inline: { gap: spacing.md },
  empty: { paddingBottom: spacing.xl, paddingTop: spacing.xl },
  hint: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.xl, textAlign: 'center' },
});
