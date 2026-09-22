import { Ban, Flag, MessageCircle, Radio, UserCheck, UserMinus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getPublicProfile, getUserPosts, sendReport } from '../../api';
import { runFriendAction } from '../../friendActions';
import { success, warning } from '../../haptics';
import { formatJoined, primaryAction, relationLabel, type FriendAction } from '../../friends';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthoredPost, AuthResponse, PublicProfile, Relation, UserSummary } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { PostRow } from '../PostRow';
import { ReportPanel } from '../ReportPanel';
import { Sheet } from '../Sheet';
import { BlinkrButton } from '../ui/BlinkrButton';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';

const SIGNALS_SHOWN = 5;

type Props = {
  auth: AuthResponse;
  /** Who to show; the name and avatar are known already, everything else is loaded. */
  user: UserSummary;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onClose: () => void;
  /** Reports the relation after any change so the list behind the sheet can update. */
  onRelationChange?: (userId: string, relation: Relation) => void;
  /** Opens a 1:1 conversation with this person. */
  onMessage: (user: UserSummary) => void;
};

/**
 * What anyone may see of a person: avatar, name, bio, since when, their public (non-anonymous) signals and how
 * we are related. No e-mail, no friend list, no location. Friendship only changes what buttons are offered here.
 */
export function UserProfileSheet({ auth, user, onAuthChange, onSessionExpired, onClose, onRelationChange, onMessage }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<AuthoredPost[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relation, setRelation] = useState<Relation>(user.relation ?? 'none');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // Their signals are a bonus: the profile itself must never fail because the list did.
      const [next, page] = await Promise.all([
        getPublicProfile(auth, user.id, signal, refresh),
        getUserPosts(auth, user.id, 1, SIGNALS_SHOWN, signal, onAuthChange, onSessionExpired).catch(() => null),
      ]);
      if (signal.aborted) return;
      setProfile(next);
      setRelation(next.relation);
      setPosts(page?.items ?? []);
      setTotal(page?.total ?? 0);
    } catch (err) {
      if (!signal.aborted) setError(friendlyError(err, 'Profil açılamadı. Tekrar dene.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token, user.id]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const act = async (action: FriendAction) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await runFriendAction(auth, action, user.id, refresh);
      if (!mounted.current) return;
      setRelation(next);
      if (next === 'blocked') warning(); else if (action === 'add' || action === 'accept') success();
      setConfirmRemove(false);
      setConfirmBlock(false);
      onRelationChange?.(user.id, next);
    } catch (err) {
      if (mounted.current) setActionError(friendlyError(err, 'İşlem tamamlanamadı. Tekrar dene.'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const name = profile?.userName ?? user.userName;
  const avatarKey = profile?.avatarKey ?? user.avatarKey;
  const main = primaryAction(relation);
  const joined = formatJoined(profile?.joinedAtUtc);
  const status = relationLabel(relation);

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.9}>
        {reporting ? (
          <ReportPanel
            onDone={() => setReporting(false)}
            onSubmit={async (reason, note) => { await sendReport(auth, { targetType: 'user', targetId: user.id, reason, note }, refresh); }}
            subject={name}
            target="user"
          />
        ) : (
        <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Avatar avatarKey={avatarKey} seed={user.id} size={84} />
            <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{name}</Text>
            {status ? <Text style={[styles.status, relation === 'friends' && styles.statusFriends]}>{status}</Text> : null}
            {joined ? <Text style={styles.joined}>{joined}</Text> : null}
          </View>

          {loading && !profile ? <ActivityIndicator accessibilityLabel="Profil yükleniyor" color={colors.primary} style={styles.loading} /> : null}
          {error ? (
            <View style={styles.block}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <BlinkrButton label="Tekrar dene" onPress={() => { const controller = new AbortController(); void load(controller.signal); }} variant="secondary" />
            </View>
          ) : null}

          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {profile ? (
            <View style={styles.actions}>
              {relation === 'incoming' ? (
                <View style={styles.pair}>
                  <BlinkrButton disabled={busy} label="Kabul et" loading={busy} onPress={() => void act('accept')} style={styles.flex} />
                  <BlinkrButton disabled={busy} label="Reddet" onPress={() => void act('decline')} style={styles.flex} variant="secondary" />
                </View>
              ) : main ? (
                <BlinkrButton disabled={busy} label={main.label} loading={busy} onPress={() => void act(main.action)} variant={main.action === 'add' ? 'primary' : 'secondary'} />
              ) : relation === 'friends' ? (
                <View style={styles.friendsRow}>
                  <UserCheck color={colors.primary} size={18} />
                  <Text style={styles.friendsText}>Arkadaşsınız</Text>
                </View>
              ) : null}
              {relation !== 'blocked' ? (
                <BlinkrButton
                  icon={<MessageCircle color={colors.text} size={18} />}
                  label="Mesaj gönder"
                  onPress={() => onMessage({ id: user.id, userName: name, avatarKey, relation })}
                  variant="secondary"
                />
              ) : null}
              {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
              {relation === 'friends' ? (
                confirmRemove ? (
                  <View style={styles.pair}>
                    <BlinkrButton disabled={busy} label="Evet, çıkar" onPress={() => void act('remove')} style={styles.flex} variant="danger" />
                    <BlinkrButton label="Vazgeç" onPress={() => setConfirmRemove(false)} style={styles.flex} variant="ghost" />
                  </View>
                ) : (
                  <AnimatedPressable accessibilityLabel="Arkadaşlıktan çıkar" accessibilityRole="button" onPress={() => setConfirmRemove(true)} pressScale={0.98} style={styles.remove}>
                    <UserMinus color={colors.textSecondary} size={16} />
                    <Text style={styles.removeText}>Arkadaşlıktan çıkar</Text>
                  </AnimatedPressable>
                )
              ) : null}
              <View style={styles.safetyRow}>
                {relation !== 'blocked' ? (
                  confirmBlock ? (
                    <View style={styles.confirmBlock}>
                      <Text style={styles.confirmText}>Engellersen arkadaşlığınız biter; birbirinizi bulamaz, mesajlaşamazsınız. Karşı taraf bilgilendirilmez.</Text>
                      <View style={styles.pair}>
                        <BlinkrButton disabled={busy} label="Evet, engelle" onPress={() => void act('block')} style={styles.flex} variant="danger" />
                        <BlinkrButton label="Vazgeç" onPress={() => setConfirmBlock(false)} style={styles.flex} variant="ghost" />
                      </View>
                    </View>
                  ) : (
                    <AnimatedPressable accessibilityLabel="Engelle" accessibilityRole="button" onPress={() => setConfirmBlock(true)} pressScale={0.98} style={styles.safetyLink}>
                      <Ban color={colors.textSecondary} size={16} />
                      <Text style={styles.removeText}>Engelle</Text>
                    </AnimatedPressable>
                  )
                ) : null}
                {!confirmBlock ? (
                  <AnimatedPressable accessibilityLabel="Bildir" accessibilityRole="button" onPress={() => setReporting(true)} pressScale={0.98} style={styles.safetyLink}>
                    <Flag color={colors.textSecondary} size={16} />
                    <Text style={styles.removeText}>Bildir</Text>
                  </AnimatedPressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {profile && relation !== 'blocked' ? (
            <View style={styles.signals}>
              <View style={styles.signalsHead}>
                <Text accessibilityRole="header" style={styles.signalsTitle}>Sinyalleri</Text>
                {total > 0 ? <Text style={styles.signalsCount}>{total.toLocaleString('tr-TR')}</Text> : null}
              </View>
              {posts && posts.length > 0
                ? posts.map((post) => <PostRow key={post.id} post={post} />)
                : (
                  <View style={styles.noSignals}>
                    <Radio color={colors.textSecondary} size={18} />
                    <Text style={styles.noSignalsText}>Henüz herkese açık sinyali yok.</Text>
                  </View>
                )}
            </View>
          ) : null}
        </ScrollView>
        )}
      </BlinkrSheetPanel>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.md },
  head: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, color: colors.text, marginTop: spacing.sm, maxWidth: '90%' },
  status: { ...typography.label, backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, color: colors.textSecondary, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 3 },
  statusFriends: { backgroundColor: colors.greenSoft, color: colors.primary },
  joined: { ...typography.caption, color: colors.textSecondary },
  loading: { paddingVertical: spacing.xl },
  block: { gap: spacing.md },
  error: { ...typography.body, color: colors.danger },
  bio: { ...typography.body, color: colors.text, textAlign: 'center' },
  actions: { gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  friendsRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 24 },
  friendsText: { ...typography.bodyStrong, color: colors.primary },
  remove: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44 },
  removeText: { ...typography.caption, color: colors.textSecondary },
  safetyRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
  safetyLink: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44 },
  confirmBlock: { gap: spacing.sm, width: '100%' },
  confirmText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  signals: { gap: spacing.xs },
  signalsHead: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm },
  signalsTitle: { ...typography.heading, color: colors.text },
  signalsCount: { ...typography.caption, color: colors.textSecondary },
  noSignals: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  noSignalsText: { ...typography.caption, color: colors.textSecondary },
});
