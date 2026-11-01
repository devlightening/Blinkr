import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Link2, ScanLine, Share2 } from 'lucide-react-native';

import { parseAppLink, userLink } from '../../deepLinks';
import { success, warning } from '../../haptics';
import { colors, mediaColors, radii, shadowSoft, sizes, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { Sheet } from '../Sheet';
import { BlinkrSheetPanel } from '../ui/BlinkrSheetPanel';
import { QrCode } from '../ui/QrCode';
import { tx } from '../../i18n/tx';

const QR_SIZE = 200;

type Props = {
  auth: AuthResponse;
  displayName?: string | null;
  photoVersion?: string | null;
  onClose: () => void;
  /** A scanned Blinkr profile code opens that person's profile. */
  onOpenUser: (userId: string) => void;
};

/**
 * Doc P2, "Profili paylaş": my profile as a card with a QR code (like a Snapcode), so adding someone face to face is
 * one scan instead of spelling a user name. The code carries only `blinkr://users/{id}`; the profile it opens follows
 * the usual rules (blocks, private account). "QR tara" reads someone else's code with the camera, asked for only then.
 */
export function ShareProfileSheet({ auth, displayName, photoVersion, onClose, onOpenUser }: Props) {
  const link = userLink(auth.userId);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const lastRejectAt = useRef(0);

  const copy = async () => {
    try { await Clipboard.setStringAsync(link); setNotice(tx('profile:share.copied', 'Bağlantı kopyalandı')); success(); } catch { setNotice(tx('profile:share.copyFailed', 'Kopyalanamadı')); }
  };
  const shareElsewhere = async () => {
    try { await Share.share({ message: tx('profile:share.message', "Blinkr'da beni ekle: @{{name}}\n{{link}}", { name: auth.userName, link }) }); } catch { setNotice(tx('profile:share.failed', 'Paylaşılamadı')); }
  };
  const startScan = async () => {
    setNotice(null);
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) { setNotice(tx('profile:share.cameraDenied', 'QR okumak için kamera izni gerekiyor. Ayarlar > İzinler.')); return; }
    handled.current = false;
    setScanning(true);
  };
  const onScanned = (data: string) => {
    if (handled.current) return;
    const target = parseAppLink(data);
    if (target?.kind !== 'user') {
      // The camera reports the same code many times a second: say it once every few seconds, not on every frame.
      const now = Date.now();
      if (now - lastRejectAt.current > 2500) { lastRejectAt.current = now; warning(); setNotice(tx('profile:share.notBlinkr', 'Bu bir Blinkr profil kodu değil')); }
      return;
    }
    handled.current = true;
    success();
    if (target.userId === auth.userId) { setScanning(false); setNotice(tx('profile:share.self', 'Bu senin kodun')); return; }
    onOpenUser(target.userId);
  };

  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.9}>
        {scanning ? (
          <View style={styles.scanner}>
            <View style={styles.scanBar}>
              <AnimatedPressable accessibilityLabel={tx('common:actions.back', 'Geri dön')} accessibilityRole="button" hitSlop={10} onPress={() => setScanning(false)} pressScale={0.9} style={styles.back}>
                <ArrowLeft color={colors.text} size={22} />
              </AnimatedPressable>
              <Text accessibilityRole="header" style={styles.title}>{tx('profile:share.scanTitle', 'QR kodu tara')}</Text>
            </View>
            <View style={styles.cameraBox}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                facing="back"
                onBarcodeScanned={({ data }) => onScanned(data)}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.frame} />
            </View>
            <Text style={styles.hint}>{notice ?? tx('profile:share.scanHint', 'Arkadaşının Blinkr profil kodunu çerçeveye getir.')}</Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.card}>
              <Avatar avatarKey={auth.avatarKey} photoVersion={photoVersion} seed={auth.userId} size={64} userId={auth.userId} />
              {displayName ? <Text numberOfLines={1} style={styles.name}>{displayName}</Text> : null}
              <Text numberOfLines={1} style={styles.handle}>@{auth.userName}</Text>
              <View style={styles.qr}>
                <QrCode accessibilityLabel={tx('profile:share.qrA11y', '@{{name}} profil kodu', { name: auth.userName })} size={QR_SIZE} value={link} />
              </View>
              <Text style={styles.cardHint}>{tx('profile:share.cardHint', 'Telefon kamerasıyla okutunca profilin Blinkr\'da açılır.')}</Text>
            </View>
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            <View style={styles.actions}>
              <Action icon={<Link2 color={colors.text} size={20} />} label={tx('profile:share.copy', 'Bağlantıyı kopyala')} onPress={() => { void copy(); }} />
              <Action icon={<Share2 color={colors.text} size={20} />} label={tx('profile:share.elsewhere', 'Paylaş')} onPress={() => { void shareElsewhere(); }} />
              <Action icon={permission === null ? <ActivityIndicator color={colors.text} size="small" /> : <ScanLine color={colors.text} size={20} />} label={tx('profile:share.scan', 'QR tara')} onPress={() => { void startScan(); }} />
            </View>
          </View>
        )}
      </BlinkrSheetPanel>
    </Sheet>
  );
}

function Action({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <AnimatedPressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.95} style={styles.action}>
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionText}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.md },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.xs, padding: spacing.lg, ...shadowSoft },
  name: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  handle: { ...typography.callout, color: colors.textSecondary },
  qr: { backgroundColor: colors.white, borderRadius: radii.md, marginTop: spacing.md, padding: spacing.sm },
  cardHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  notice: { ...typography.caption, color: colors.primary, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: spacing.xs, minWidth: 84 },
  actionIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 52, justifyContent: 'center', width: 52 },
  actionText: { ...typography.caption, color: colors.text, textAlign: 'center' },
  scanner: { gap: spacing.md, paddingBottom: spacing.md },
  scanBar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  back: { alignItems: 'center', height: sizes.touch, justifyContent: 'center', marginLeft: -spacing.xs, width: sizes.touch },
  title: { ...typography.title, color: colors.text },
  cameraBox: { aspectRatio: 1, backgroundColor: mediaColors.background, borderRadius: radii.xl, overflow: 'hidden', width: '100%' },
  frame: { borderColor: mediaColors.white, borderRadius: radii.lg, borderWidth: 3, bottom: '18%', left: '18%', position: 'absolute', right: '18%', top: '18%' },
  hint: { ...typography.callout, color: colors.textSecondary, textAlign: 'center' },
});
