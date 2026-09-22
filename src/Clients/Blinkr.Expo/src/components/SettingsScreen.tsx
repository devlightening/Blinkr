import Constants from 'expo-constants';
import { ArrowLeft, ChevronRight, Code2, Info, LogOut, ShieldCheck, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBlocks, unblockUser } from '../api';
import { friendlyError } from '../productPresentation';
import { colors, radii, sizes, spacing, typography } from '../theme';
import type { AuthResponse, BlockedUser } from '../types';
import { AnimatedPressable } from './AnimatedPressable';
import { Avatar } from './Avatar';
import { DevComponentPreview } from './DevComponentPreview';
import { BlinkrButton } from './ui/BlinkrButton';
import { BlinkrEmptyState } from './ui/BlinkrEmptyState';

type Props = {
  auth: AuthResponse;
  onAuthChange: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
  onBack: () => void;
  onLogout: () => void;
};

type Page = 'main' | 'blocked' | 'dev';

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
export function SettingsScreen({ auth, onAuthChange, onSessionExpired, onBack, onLogout }: Props) {
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

  if (page === 'dev') return <DevComponentPreview onBack={() => setPage('main')} />;

  return (
    <View style={styles.screen}>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel="Geri dön" accessibilityRole="button" onPress={() => (page === 'blocked' ? setPage('main') : onBack())} pressScale={0.95} style={styles.back}>
          <ArrowLeft color={colors.text} size={22} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>{page === 'blocked' ? 'Engellenen kişiler' : 'Ayarlar'}</Text>
      </View>

      {page === 'main' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>Hesap</Text>
          <View style={styles.group}>
            <Row icon={<Text style={styles.glyph}>@</Text>} title="Kullanıcı adı" value={auth.userName} />
            <Row icon={<Text style={styles.glyph}>✉</Text>} title="E-posta" value={auth.email} />
          </View>

          <Text style={styles.section}>Güvenlik</Text>
          <View style={styles.group}>
            <Row icon={<UserX color={colors.text} size={18} />} onPress={() => setPage('blocked')} title="Engellenen kişiler" value={blocked ? String(blocked.length) : undefined} />
          </View>

          <Text style={styles.section}>Gizlilik</Text>
          <View style={styles.note}>
            <ShieldCheck color={colors.primary} size={18} />
            <View style={styles.noteCopy}>
              <Text style={styles.noteText}>Kesin cihaz konumun diğer kullanıcılara gösterilmez; haritada yer merkezi ya da yaklaşık alan görünür.</Text>
              <Text style={styles.noteText}>Anonim paylaştığın sinyalleri yalnızca sen görürsün.</Text>
              <Text style={styles.noteText}>Snap’ler bir kez izlenip kaybolur; fotoğraflardaki konum bilgisi silinir.</Text>
              <Text style={styles.noteText}>Arkadaşlık yalnızca birbirini bulmak ve mesajlaşmak içindir; konum paylaşmaz.</Text>
            </View>
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
            <Row icon={<Info color={colors.text} size={18} />} title="Sürüm" value={appVersion()} />
          </View>
          <Text style={styles.attribution}>Yer verileri © OpenStreetMap katkıcıları (ODbL). Taban harita Apple Maps / Google Maps’e aittir; Blinkr işaretleri yalnızca Blinkr verisinden çizilir.</Text>

          <AnimatedPressable accessibilityLabel="Oturumu kapat" accessibilityRole="button" onPress={onLogout} pressScale={0.98} style={styles.logout}>
            <LogOut color={colors.danger} size={18} />
            <Text style={styles.logoutText}>Oturumu kapat</Text>
          </AnimatedPressable>
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
  title: { ...typography.title, color: colors.text },
  content: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  section: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.lg },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, overflow: 'hidden' },
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
