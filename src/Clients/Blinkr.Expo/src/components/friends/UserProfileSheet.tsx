import { Ban, ChevronLeft, Flag, Lock, MessageCircle, MoreHorizontal, Radio, UserCheck, UserMinus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPublicProfile, getUserPosts, sendReport } from '../../api';
import { runFriendAction } from '../../friendActions';
import { followerCountAfter, profileLocked, type FollowState } from '../../follows';
import { formatCount } from '../../engagement';
import { success, warning } from '../../haptics';
import { formatJoined, primaryAction, relationLabel, type FriendAction } from '../../friends';
import { friendlyError } from '../../productPresentation';
import { GRID_GAP, PROFILE_RECENT, gridTileSize } from '../../profileGrid';
import { fromAuthoredPost } from '../../signalCard';
import { colors, radii, sizes, spacing, typography } from '../../theme';
import type { AuthoredPost, AuthResponse, PublicProfile, Relation, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { TrustLine } from '../profile/TrustLine';
import { ReportPanel } from '../ReportPanel';
import { Sheet } from '../Sheet';
import { SignalCardModal } from '../signal/SignalCardModal';
import { SignalTile } from '../live/SignalTile';
import { BlinkrButton } from '../ui/BlinkrButton';
import { bottomBarClearance } from '../ui/BlinkrBottomBar';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { PushScreen, type PushScreenHandle } from '../ui/PushScreen';
import { FollowButton } from './FollowButton';
import { FollowListPanel, type FollowListTab } from './FollowListSheet';
import { tx } from '../../i18n/tx';

type Props = {
  auth: AuthResponse;
  /** Who to show; the name and avatar are known already, everything else is loaded. */
  user: UserSummary;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onClose: () => void;
  /** Reports the relation after any change so the list behind the page can update. */
  onRelationChange?: (userId: string, relation: Relation) => void;
  /** Opens a 1:1 conversation with this person. */
  onMessage: (user: UserSummary) => void;
};

type MenuPage = 'menu' | 'block' | 'remove' | 'report' | 'followers' | 'following';

/**
 * Someone's profile as a full page, laid out like my own (Instagram): back, @username and ⋯ on top; photo and
 * numbers; name and bio; Follow and Message; their newest public signals as a grid (a tile opens its Sinyal Kartı).
 * Block, report and unfriend sit behind ⋯. What anyone may see: no e-mail, no friend list, no location, no anonymous
 * signals; a private account shows a lock instead of the grid until the follow is approved. The name stays
 * UserProfileSheet so every place that opens a person keeps working.
 */
export function UserProfileSheet({ auth, user, onAuthChange, onSessionExpired, onClose, onRelationChange, onMessage }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const tileSize = gridTileSize(screenWidth, spacing.lg);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<AuthoredPost[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relation, setRelation] = useState<Relation>(user.relation ?? 'none');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuPage | null>(null);
  const [follow, setFollow] = useState<FollowState>('none');
  const [followers, setFollowers] = useState(0);
  const [openPost, setOpenPost] = useState<AuthoredPost | null>(null);
  const { t, i18n } = useTranslation('profile');
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const mounted = useRef(true);
  const page = useRef<PushScreenHandle>(null);
  // The back arrow and Android back slide the page out the same way a swipe does (Instagram).
  const goBack = () => { if (page.current) page.current.back(); else onClose(); };
  useEffect(() => () => { mounted.current = false; }, []);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };

  const load = useCallback(async (signal: AbortSignal) => {
    setError(null);
    try {
      // Their signals are a bonus: the profile itself must never fail because the list did.
      const [next, page] = await Promise.all([
        getPublicProfile(auth, user.id, signal, refresh),
        getUserPosts(auth, user.id, 1, PROFILE_RECENT, signal, onAuthChange, onSessionExpired).catch(() => null),
      ]);
      if (signal.aborted) return;
      setProfile(next);
      setRelation(next.relation);
      setFollow(next.follow ?? 'none');
      setFollowers(next.followerCount ?? 0);
      setPosts(page?.items ?? []);
      setTotal(page?.total ?? 0);
    } catch (err) {
      if (!signal.aborted) setError(friendlyError(err, tx('profile:person.loadFailed', 'Profil açılamadı. Tekrar dene.')));
    } finally {
      if (!signal.aborted) { setLoading(false); setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token, user.id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Android back: the open layer first (card, menu), then the page.
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openPost) setOpenPost(null); else if (menu) setMenu(null); else goBack();
      return true;
    });
    return () => back.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, openPost]);

  const act = async (action: FriendAction) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await runFriendAction(auth, action, user.id, refresh);
      if (!mounted.current) return;
      setRelation(next);
      if (next === 'blocked') warning(); else if (action === 'add' || action === 'accept') success();
      setMenu(null);
      onRelationChange?.(user.id, next);
    } catch (err) {
      if (mounted.current) setActionError(friendlyError(err, tx('profile:friends.actionFailed', 'İşlem tamamlanamadı. Tekrar dene.')));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const name = profile?.userName ?? user.userName;
  const avatarKey = profile?.avatarKey ?? user.avatarKey;
  const main = primaryAction(relation);
  const joined = formatJoined(profile?.joinedAtUtc);
  // Following a private account (once accepted) opens it; until then the server says canSeeContent: false.
  const locked = profileLocked(profile) && follow !== 'following';
  const blocked = relation === 'blocked';
  const status = relation === 'friends' ? null : relationLabel(relation);

  const stat = (value: number, label: string, onPress?: () => void) => (
    <AnimatedPressable accessibilityLabel={`${formatCount(value, lang)} ${label}`} accessibilityRole="button" disabled={!onPress || locked} onPress={onPress} pressScale={0.95} style={styles.stat}>
      <Text style={styles.statValue}>{formatCount(value, lang)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </AnimatedPressable>
  );

  const grid = !profile || blocked ? null : locked ? (
    <View style={styles.locked} testID="private-lock">
      <View style={styles.lockedIcon}><Lock color={colors.text} size={26} /></View>
      <Text style={styles.lockedTitle}>{t('private.title')}</Text>
      <Text style={styles.muted}>{t('private.body')}</Text>
    </View>
  ) : posts && posts.length > 0 ? (
    <View style={styles.grid} testID="person-grid">
      {posts.map((post) => <SignalTile key={post.id} onPress={() => setOpenPost(post)} post={post} size={tileSize} />)}
    </View>
  ) : (
    <View style={styles.noSignals}>
      <Radio color={colors.textSecondary} size={22} />
      <Text style={styles.muted}>{tx('profile:person.noSignals', 'Henüz herkese açık sinyali yok.')}</Text>
    </View>
  );

  return (
    <PushScreen gestureEnabled={!menu && !openPost} handleHardwareBack={false} onBack={onClose} ref={page} style={styles.screen} testID="person-profile">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri')} accessibilityRole="button" hitSlop={8} onPress={goBack} pressScale={0.9} style={styles.iconButton} testID="person-back">
          <ChevronLeft color={colors.text} size={28} />
        </AnimatedPressable>
        <View style={styles.titleRow}>
          {profile?.isPrivate ? <Lock color={colors.text} size={15} /> : null}
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{name}</Text>
        </View>
        <AnimatedPressable accessibilityLabel={tx('profile:person.more', 'Diğer seçenekler')} accessibilityRole="button" hitSlop={8} onPress={() => setMenu('menu')} pressScale={0.9} style={styles.iconButton} testID="person-menu">
          <MoreHorizontal color={colors.text} size={24} />
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomBarClearance(insets.bottom) + spacing.lg }]}
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void load(new AbortController().signal); }} refreshing={refreshing} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <Avatar avatarKey={avatarKey} seed={user.id} size={AVATAR} userId={user.id} />
          <View style={styles.stats}>
            {stat(total, tx('profile:me.signals', 'Sinyal'))}
            {stat(followers, t('stats.followers'), () => setMenu('followers'))}
            {stat(profile?.followingCount ?? 0, t('stats.following'), () => setMenu('following'))}
          </View>
        </View>

        <View style={styles.about}>
          {profile?.displayName ? <Text numberOfLines={1} style={styles.displayName}>{profile.displayName}</Text> : null}
          {profile && !blocked ? <TrustLine auth={auth} enabled={!locked} refresh={{ onAuthRefresh: onAuthChange, onSessionExpired }} userId={user.id} /> : null}
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <View style={styles.metaRow}>
            {profile?.followsYou && follow !== 'self' ? <Text style={styles.badge}>{t('follow.followsYou')}</Text> : null}
            {status ? <Text style={styles.badge}>{status}</Text> : null}
            {relation === 'friends' ? (
              <View style={styles.friendsBadge}>
                <UserCheck color={colors.primary} size={13} />
                <Text style={styles.friendsText}>{tx('profile:person.friends', 'Arkadaşsınız')}</Text>
              </View>
            ) : null}
            {joined ? <Text style={styles.muted}>{joined}</Text> : null}
          </View>
        </View>

        {loading && !profile ? <ActivityIndicator accessibilityLabel={tx('profile:person.loading', 'Profil yükleniyor')} color={colors.primary} style={styles.loading} /> : null}
        {error ? (
          <View style={styles.block}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <BlinkrButton label={tx('common:actions.retry', 'Tekrar dene')} onPress={() => { setLoading(true); void load(new AbortController().signal); }} variant="secondary" />
          </View>
        ) : null}

        {profile && !blocked ? (
          <View style={styles.buttons}>
            {follow !== 'self' ? (
              <View style={styles.flex}>
                <FollowButton
                  auth={auth}
                  followsYou={profile.followsYou}
                  isPrivate={profile.isPrivate}
                  onChange={(next, before) => { setFollow(next); setFollowers((count) => followerCountAfter(count, before, next)); }}
                  refresh={refresh}
                  state={follow}
                  userId={user.id}
                />
              </View>
            ) : null}
            <BlinkrButton
              icon={<MessageCircle color={colors.text} size={18} />}
              label={tx('profile:person.messageShort', 'Mesaj')}
              onPress={() => onMessage({ id: user.id, userName: name, avatarKey, relation })}
              style={styles.flex}
              variant="secondary"
            />
          </View>
        ) : null}
        {profile && relation === 'incoming' ? (
          <View style={styles.request}>
            <Text style={styles.requestText}>{tx('profile:person.requestIncoming', '{{name}} sana arkadaşlık isteği gönderdi', { name })}</Text>
            <View style={styles.buttons}>
              <BlinkrButton disabled={busy} label={tx('profile:friends.accept', 'Kabul et')} loading={busy} onPress={() => void act('accept')} style={styles.flex} />
              <BlinkrButton disabled={busy} label={tx('profile:friends.decline', 'Reddet')} onPress={() => void act('decline')} style={styles.flex} variant="secondary" />
            </View>
          </View>
        ) : profile && main ? (
          <BlinkrButton disabled={busy} label={main.label} loading={busy} onPress={() => void act(main.action)} variant={main.action === 'add' || main.action === 'unblock' ? 'secondary' : 'ghost'} />
        ) : null}
        {blocked ? (
          <View style={styles.request}>
            <Text style={styles.requestText}>{tx('profile:person.blockedNote', 'Bu kişiyi engelledin. Engeli Ayarlar > Engellenen kişiler bölümünden kaldırabilirsin.')}</Text>
          </View>
        ) : null}
        {actionError && !menu ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}

        {profile && !blocked && !locked ? <View style={styles.divider} /> : null}
        {grid}
      </ScrollView>

      {menu ? (
        <Sheet onClose={() => setMenu(null)}>
          <BlinkrSheetPanel maxHeightRatio={0.9}>
            {menu === 'followers' || menu === 'following' ? (
              <FollowListPanel auth={auth} initialTab={menu as FollowListTab} onClose={() => setMenu(null)} ownerId={user.id} ownerName={name} refresh={refresh} />
            ) : menu === 'report' ? (
              <ReportPanel
                onDone={() => setMenu(null)}
                onSubmit={async (reason, note) => { await sendReport(auth, { targetType: 'user', targetId: user.id, reason, note }, refresh); }}
                subject={name}
                target="user"
              />
            ) : menu === 'block' || menu === 'remove' ? (
              <View style={styles.confirm}>
                <Text accessibilityRole="header" style={styles.confirmTitle}>{menu === 'block' ? tx('profile:person.blockTitle', '{{name}} engellensin mi?', { name }) : tx('profile:person.removeTitle', '{{name}} arkadaşlıktan çıkarılsın mı?', { name })}</Text>
                {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
                {menu === 'block' ? <Text style={styles.muted}>{tx('profile:person.blockWarning', 'Engellersen arkadaşlığınız biter; birbirinizi bulamaz, mesajlaşamazsınız. Karşı taraf bilgilendirilmez.')}</Text> : null}
                <BlinkrButton disabled={busy} label={menu === 'block' ? tx('profile:person.confirmBlock', 'Evet, engelle') : tx('profile:person.confirmRemove', 'Evet, çıkar')} loading={busy} onPress={() => void act(menu === 'block' ? 'block' : 'remove')} variant="danger" />
                <BlinkrButton label={tx('common:actions.cancel', 'Vazgeç')} onPress={() => setMenu(null)} variant="ghost" />
              </View>
            ) : (
              <View testID="person-menu-sheet">
                {relation === 'friends' ? <MenuRow icon={<UserMinus color={colors.text} size={20} />} label={tx('profile:person.remove', 'Arkadaşlıktan çıkar')} onPress={() => setMenu('remove')} /> : null}
                {!blocked ? <MenuRow icon={<Ban color={colors.danger} size={20} />} label={tx('profile:person.block', 'Engelle')} onPress={() => setMenu('block')} tone="danger" /> : null}
                <MenuRow icon={<Flag color={colors.danger} size={20} />} label={tx('common:actions.report', 'Bildir')} onPress={() => setMenu('report')} tone="danger" />
              </View>
            )}
          </BlinkrSheetPanel>
        </Sheet>
      ) : null}

      {openPost ? (
        <SignalCardModal
          auth={auth}
          cards={[fromAuthoredPost(openPost, { userId: user.id, userName: name })]}
          deviceOrigin={null}
          key={openPost.id}
          onChanged={() => setOpenPost(null)}
          onClose={() => setOpenPost(null)}
          onConfirm={async () => {}}
          onDeleted={() => setOpenPost(null)}
          onOpenAuthor={() => setOpenPost(null)}
          refresh={refresh}
        />
      ) : null}
    </PushScreen>
  );
}

function MenuRow({ icon, label, onPress, tone }: { icon: React.ReactNode; label: string; onPress: () => void; tone?: 'danger' }) {
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} pressScale={0.98} style={styles.menuRow}>
      {icon}
      <Text style={[styles.menuText, tone === 'danger' && styles.menuDanger]}>{label}</Text>
    </AnimatedPressable>
  );
}

const AVATAR = 88;

const styles = StyleSheet.create({
  // Above the map's signal card (zIndex 120) it may be opened from; elevation for Android, where zIndex alone loses.
  screen: { elevation: 30, zIndex: 150 },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs, paddingHorizontal: spacing.sm },
  iconButton: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', width: sizes.touch },
  titleRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  title: { ...typography.heading, color: colors.text, flexShrink: 1 },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  stats: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 1, minHeight: sizes.touch, minWidth: 64 },
  statValue: { ...typography.title, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  about: { gap: 3 },
  displayName: { ...typography.heading, color: colors.text },
  bio: { ...typography.body, color: colors.text },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  badge: { ...typography.label, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, color: colors.textSecondary, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3 },
  friendsBadge: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.pill, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 3 },
  friendsText: { ...typography.label, color: colors.primary },
  muted: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  loading: { paddingVertical: spacing.xl },
  block: { gap: spacing.md },
  error: { ...typography.body, color: colors.danger },
  buttons: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  request: { backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.sm, padding: spacing.md },
  requestText: { ...typography.callout, color: colors.text },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginHorizontal: -spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  locked: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  lockedIcon: { alignItems: 'center', borderColor: colors.text, borderRadius: radii.pill, borderWidth: 2, height: 56, justifyContent: 'center', width: 56 },
  lockedTitle: { ...typography.heading, color: colors.text },
  noSignals: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  confirm: { gap: spacing.md },
  confirmTitle: { ...typography.title, color: colors.text },
  menuRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52 },
  menuText: { ...typography.body, color: colors.text },
  menuDanger: { color: colors.danger },
});
