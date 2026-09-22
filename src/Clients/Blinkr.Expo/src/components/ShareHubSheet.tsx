import { Camera, ChevronRight, Images, PenLine, Send } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { Sheet } from './Sheet';
import { BlinkrSheetPanel } from './ui/BlinkrSheetPanel';

type Props = {
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onSignalOnly: () => void;
  /** Starts a view-once snap to a friend (camera, then recipients). */
  onSnap?: () => void;
};

function Option({ icon, title, subtitle, onPress, primary = false }: { icon: ReactNode; title: string; subtitle: string; onPress: () => void; primary?: boolean }) {
  return (
    <AnimatedPressable accessibilityLabel={`${title}. ${subtitle}`} accessibilityRole="button" onPress={onPress} pressScale={0.98} style={[styles.option, primary && styles.optionPrimary]}>
      <View style={[styles.iconTile, primary && styles.iconTilePrimary]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <ChevronRight color={colors.textSecondary} size={22} />
    </AnimatedPressable>
  );
}

/**
 * The one place to start sharing: camera (with lenses and stickers), an existing photo or video, or a plain
 * signal without media. All three lead to the same composer, where the place and the server-checked
 * proximity are decided.
 */
export function ShareHubSheet({ onClose, onCamera, onGallery, onSignalOnly, onSnap }: Props) {
  return (
    <Sheet onClose={onClose}>
      <BlinkrSheetPanel maxHeightRatio={0.7}>
        <Text accessibilityRole="header" style={styles.heading}>Ne paylaşmak istersin?</Text>
        <Text style={styles.hint}>Bulunduğun yerde şu an neler olduğunu göster.</Text>
        <View style={styles.list}>
          <Option icon={<Camera color={colors.ink} size={22} />} onPress={onCamera} primary subtitle="Efektlerle fotoğraf çek veya video kaydet" title="Kamera" />
          <Option icon={<Images color={colors.mint} size={22} />} onPress={onGallery} subtitle="Arşivinden bir fotoğraf ya da video seç" title="Galeri" />
          <Option icon={<PenLine color={colors.mint} size={22} />} onPress={onSignalOnly} subtitle="Doluluk, sıra veya durum bilgisini yaz" title="Sadece sinyal" />
          {onSnap ? <Option icon={<Send color={colors.flare} size={22} />} onPress={onSnap} subtitle="Arkadaşına bir kez izlenip kaybolan bir fotoğraf gönder" title="Snap gönder" /> : null}
        </View>
      </BlinkrSheetPanel>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text },
  hint: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  list: { gap: spacing.sm, marginTop: spacing.lg },
  option: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 64, padding: spacing.md },
  optionPrimary: { borderColor: 'rgba(95, 211, 160, 0.5)' },
  iconTile: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  iconTilePrimary: { backgroundColor: colors.primary },
  copy: { flex: 1 },
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
});
