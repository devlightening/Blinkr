import Constants from 'expo-constants';
import { ArrowLeft, BookOpen, ChevronRight, Code2, Download, FileText, Info, LogOut, Lock, ShieldCheck, Trash2, UserX, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBlocks, setAccountPrivacy, unblockUser } from '../api';
import { friendlyError } from '../productPresentation';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { AuthResponse, BlockedUser } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { DevComponentPreview } from './DevComponentPreview';
import { LegalDocView } from './LegalDocView';
import { DataRequestView } from './account/DataRequestView';
import { DeleteAccountView } from './account/DeleteAccountView';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';
import { SegmentedControl } from './ui/BlinkrSegmentedControl';
import { useTheme } from './ThemeProvider';
import type { ThemePreference } from '../theme';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onBack: () => void;
  onLogout: () => void;
  /** Private account (sinyal-mvp-plan Faz 6, D-009). */
  isPrivate?: boolean;
  onPrivacyChange?: (isPrivate: boolean) => void;
};

type Page = 'main' | 'blocked' | 'dev' | 'data' | 'delete' | 'community' | 'terms' | 'privacy';

const appVersion = () => Constants.expoConfig?.version ?? '1.0.0';

function Row({ icon, title, value, onPress, danger = false }: { icon: React.ReactNode; title: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const body = (
    <>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowTitle, danger && styles.rowDanger]}>{title}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && !danger ? <ChevronRight color={colors.textSecondary} size={18} /> : null}
    </>
  );
  return onPress
    ? <AnimatedPressable accessibilityLabel={value ? `${title}, ${value}` : title} accessibilityRole="button" onPress={onPress} pressScale={0.99} style={styles.row}>{body}</AnimatedPressable>
    : <View style={styles.row}>{body}</View>;
}

/**
 * Settings: who I blocked, what Blinkr does with my data, and where the map data comes from. Only real facts live here;
 * there are no switches that do nothing.
 */
export function SettingsScreen({ auth, onAuthChange, onSessionExpired, onBack, onLogout, isPrivate = false, onPrivacyChange }: Props) {
  const { t } = useTranslation('settings');
  const theme = useTheme();
  const [privateOn, setPrivateOn] = useState(isPrivate);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  useEffect(() => { setPrivateOn(isPrivate); }, [isPrivate]);
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('main');
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const load = useRef<AbortController | null>(null);
  const refresh = { onAuthRefresh: onAuthChange, onSessionExpired };

  const loadBlocked = useCallback(async () => {
    load.current?.abort();
    const controller = new AbortController();
    load.current = controller;
    setError(null);
    try {
      const rows = await listBlocks(auth, controller.signal, refresh);
      if (!controller.signal.aborted) setBlocked(rows);
    } catch (err) {
      if (!controller.signal.aborted) setError(friendlyError(err, 'Engellenen kişiler yüklenemedi. Tekrar dene.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token]);

  useEffect(() => { void loadBlocked(); return () => load.current?.abort(); }, [loadBlocked]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (page !== 'main') setPage('main'); else onBack(); return true; });
    return () => back.remove();
  }, [page, onBack]);

  const unblock = async (userId: string) => {
    if (busy.has(userId)) return;
    setBusy((current) => new Set(current).add(userId));
    setError(null);
    try {
      await unblockUser(auth, userId, refresh);
      setBlocked((current) => (current ? current.filter((user) => user.id !== userId) : current));
    } catch (err) {
      setError(friendlyError(err, 'Engel kaldırılamadı. Tekrar dene.'));
    } finally {
      setBusy((current) => { const next = new Set(current); next.delete(userId); return next; });
    }
  };

  const togglePrivate = async (next: boolean) => {
    setPrivacyError(null);
    setPrivateOn(next);
    try {
      const saved = await setAccountPrivacy(auth, next, refresh);
      setPrivateOn(saved.isPrivate);
      onPrivacyChange?.(saved.isPrivate);
    } catch {
      setPrivateOn(!next);
      setPrivacyError(t('privacy.privateFailed'));
    }
  };

  if (page === 'dev') return <DevComponentPreview onBack={() => setPage('main')} />;

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => (page !== 'main' ? setPage('main') : onBack())} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{page === 'blocked' ? 'Engellenen kişiler' : page === 'main' ? 'Ayarlar' : t(`pages.${page}`)}</Text>
      </View>

      {page === 'main' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>Hesap</Text>
          <View style={styles.group}>
            <Row icon={<Text style={styles.glyph}>@</Text>} title="Kullanıcı adı" value={auth.userName} />
            <Row icon={<Text style={styles.glyph}>✉</Text>} title="E-posta" value={auth.email} />
            <Row icon={<Download color={colors.text} size={18} />} onPress={() => setPage('data')} title={t('pages.data')} />
            <Row icon={<Trash2 color={colors.danger} size={18} />} onPress={() => setPage('delete')} title={t('pages.delete')} />
          </View>

          <Text style={styles.section}>Güvenlik</Text>
          <View style={styles.group}>
            <Row icon={<UserX color={colors.text} size={18} />} onPress={() => setPage('blocked')} title="Engellenen kişiler" value={blocked ? String(blocked.length) : undefined} />
          </View>

          <Text style={styles.section}>Gizlilik</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.noteCopy}>
                <Text style={styles.rowTitle}>{t('privacy.privateTitle')}</Text>
                <Text style={styles.noteText}>{t('privacy.privateHint')}</Text>
              </View>
              <Switch accessibilityLabel={t('privacy.privateTitle')} onValueChange={(value) => { void togglePrivate(value); }} testID="private-switch" trackColor={{ false: colors.border, true: colors.primary }} value={privateOn} />
            </View>
          </View>
          {privacyError ? <Text accessibilityRole="alert" style={styles.noteText}>{privacyError}</Text> : null}
          <View style={styles.note}>
            <ShieldCheck color={colors.primary} size={18} />
            <View style={styles.noteCopy}>
              <Text style={styles.noteText}>Kesin cihaz konumun diğer kullanıcılara gösterilmez; haritada yer merkezi ya da yaklaşık alan görünür.</Text>
              <Text style={styles.noteText}>Anonim paylaştığın sinyalleri yalnızca sen görürsün.</Text>
              <Text style={styles.noteText}>Snap’ler bir kez izlenip kaybolur; fotoğraflardaki konum bilgisi silinir.</Text>
              <Text style={styles.noteText}>Arkadaşlık yalnızca birbirini bulmak ve mesajlaşmak içindir; konum paylaşmaz.</Text>
            </View>
          </View>

          {/* plan-devam B3: Sistem / Açık / Koyu. Choosing one reloads the app so every surface, the map included, repaints. */}
          <Text style={styles.section}>{t('appearance.title')}</Text>
          <View style={[styles.group, styles.appearance]}>
            <SegmentedControl<ThemePreference>
              accessibilityLabel={t('appearance.title')}
              onChange={theme.setPreference}
              options={[
                { value: 'system', label: t('appearance.system') },
                { value: 'light', label: t('appearance.light') },
                { value: 'dark', label: t('appearance.dark') },
              ]}
              value={theme.preference}
            />
            <Text style={styles.noteText}>{t('appearance.hint')}</Text>
          </View>

          {__DEV__ ? (
            <>
              <Text style={styles.section}>Geliştirici</Text>
              <View style={styles.group}>
                <Row icon={<Code2 color={colors.text} size={18} />} onPress={() => setPage('dev')} title="Bileşen önizleme" />
              </View>
            </>
          ) : null}

          <Text style={styles.section}>Hakkında</Text>
          <View style={styles.group}>
            <Row icon={<Users color={colors.text} size={18} />} onPress={() => setPage('community')} title={t('pages.community')} />
            <Row icon={<FileText color={colors.text} size={18} />} onPress={() => setPage('terms')} title={t('pages.terms')} />
            <Row icon={<Lock color={colors.text} size={18} />} onPress={() => setPage('privacy')} title={t('pages.privacy')} />
            <Row icon={<Info color={colors.text} size={18} />} title="Sürüm" value={appVersion()} />
          </View>
          <Text style={styles.attribution}>Yer verileri © OpenStreetMap katkıcıları (ODbL). Taban harita Apple Maps / Google Maps’e aittir; Blinkr işaretleri yalnızca Blinkr verisinden çizilir.</Text>

          <AnimatedPressable accessibilityLabel="Oturumu kapat" accessibilityRole="button" onPress={onLogout} pressScale={0.98} style={styles.logout}>
            <LogOut color={colors.danger} size={18} />
            <Text style={styles.logoutText}>Oturumu kapat</Text>
          </AnimatedPressable>
        </ScrollView>
      ) : page === 'data' || page === 'delete' || page === 'community' || page === 'terms' || page === 'privacy' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          {page === 'data' ? <DataRequestView auth={auth} refresh={refresh} /> : null}
          {page === 'delete' ? <DeleteAccountView auth={auth} onDeleted={onLogout} refresh={refresh} /> : null}
          {page === 'community' || page === 'terms' || page === 'privacy' ? <LegalDocView id={page} /> : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {blocked === null && !error ? <ActivityIndicator accessibilityLabel="Yükleniyor" color={colors.primary} style={styles.loading} /> : null}
          {blocked === null && error ? <BlinkrButton label="Tekrar dene" onPress={() => void loadBlocked()} variant="secondary" /> : null}
          {blocked && blocked.length === 0 ? (
            <BlinkrEmptyState description="Engellediğin kişiler burada listelenir. Engelli biri seni bulamaz, sana istek ya da mesaj gönderemez." icon={<UserX color={colors.textSecondary} size={24} />} style={styles.empty} title="Kimseyi engellemedin" />
          ) : null}
          {blocked?.map((user) => (
            <View key={user.id} style={styles.person}>
              <Avatar avatarKey={user.avatarKey} seed={user.id} size={44} />
              <Text numberOfLines={1} style={styles.personName}>{user.userName}</Text>
              <AnimatedPressable accessibilityLabel={`${user.userName} engelini kaldır`} accessibilityRole="button" aria-disabled={busy.has(user.id)} disabled={busy.has(user.id)} onPress={() => void unblock(user.id)} pressScale={0.95} style={styles.mini}>
                <Text style={styles.miniText}>Engeli kaldır</Text>
              </AnimatedPressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, zIndex: 20 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.sm, width: sizes.touch },
  title: { ...typography.title, color: colors.text, flex: 1 },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  section: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.lg },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
  appearance: { gap: spacing.sm, padding: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg },
  rowIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.sm + 2, height: 32, justifyContent: 'center', width: 32 },
  glyph: { ...typography.bodyStrong, color: colors.text },
  rowTitle: { ...typography.body, color: colors.text, flex: 1 },
  rowDanger: { color: colors.danger },
  rowValue: { ...typography.caption, color: colors.textSecondary, flexShrink: 1, maxWidth: '55%' },
  note: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  noteCopy: { flex: 1, gap: spacing.sm },
  noteText: { ...typography.caption, color: colors.textSecondary },
  attribution: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  logout: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, minHeight: sizes.touch, paddingHorizontal: spacing.xs },
  logoutText: { ...typography.bodyStrong, color: colors.danger },
  error: { ...typography.body, color: colors.danger },
  loading: { marginTop: spacing.xl },
  empty: { paddingTop: spacing.xl },
  person: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 60 },
  personName: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  mini: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: spacing.md },
  miniText: { ...typography.label, color: colors.text },
});
