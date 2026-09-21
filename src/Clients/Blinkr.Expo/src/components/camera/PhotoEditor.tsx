import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { STICKERS, lensById, lensChangesPicture, placeSticker, stickerText, type PlacedSticker } from '../../cameraEffects';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrButton } from '../ui/BlinkrButton';
import { DraggableSticker } from './DraggableSticker';
import { FilterOverlay } from './FilterOverlay';
import { LensSelector } from './LensSelector';

export type CapturedMedia = {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  mimeType: string;
  fileName?: string;
};

type Props = {
  photo: { uri: string; width: number; height: number };
  lensId: string;
  onLensChange: (id: string) => void;
  onRetake: () => void;
  onDone: (asset: CapturedMedia) => void;
  submitLabel?: string;
};

const TOOLS_HEIGHT = 250;

/**
 * Edit stage for a photo: pick a lens, add stickers, then render the result to a file.
 * A photo without a lens and without stickers is passed on untouched (no re-encoding).
 */
export function PhotoEditor({ photo, lensId, onLensChange, onRetake, onDone, submitLabel = 'Kullan' }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const shot = useRef<View>(null);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const now = useRef(new Date());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const lens = lensById(lensId);
  const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 3 / 4;
  const availableHeight = Math.max(240, windowHeight - insets.top - insets.bottom - TOOLS_HEIGHT - 64);
  const frameWidth = Math.min(windowWidth - spacing.lg, availableHeight * ratio);
  const frame = { width: Math.round(frameWidth), height: Math.round(frameWidth / ratio) };

  const commit = (key: string, x: number, y: number, scale: number) =>
    setStickers((current) => current.map((item) => (item.key === key ? { ...item, x, y, scale } : item)));

  const use = async () => {
    if (rendering) return;
    setError(null);
    const untouched = !lensChangesPicture(lens) && stickers.length === 0;
    if (untouched) {
      onDone({ uri: photo.uri, width: photo.width, height: photo.height, type: 'image', mimeType: 'image/jpeg', fileName: `blinkr-${Date.now()}.jpg` });
      return;
    }
    setRendering(true);
    try {
      // Let the remove buttons disappear from the picture before it is rendered.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const uri = await captureRef(shot, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
      if (!uri) throw new Error('render-failed');
      if (mounted.current) onDone({ uri, width: photo.width, height: photo.height, type: 'image', mimeType: 'image/jpeg', fileName: `blinkr-${Date.now()}.jpg` });
    } catch (err) {
      console.log('[Blinkr Camera]', { failedStage: 'render', errorCode: err instanceof Error ? err.name : 'Unknown' });
      if (mounted.current) setError(friendlyError(err, 'Fotoğraf hazırlanamadı. Efektleri kaldırıp tekrar dene.'));
    } finally {
      if (mounted.current) setRendering(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <AnimatedPressable accessibilityLabel="Yeniden çek" accessibilityRole="button" onPress={onRetake} pressScale={0.9} style={styles.back}>
          <ChevronLeft color={colors.text} size={26} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>Efekt ve çıkartma</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.stage}>
        <View collapsable={false} ref={shot} style={[styles.frame, frame]}>
          <Image accessibilityLabel="Çekilen fotoğraf" resizeMode="cover" source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
          <FilterOverlay lens={lens} />
          {stickers.map((sticker) => {
            const def = STICKERS.find((item) => item.id === sticker.stickerId);
            if (!def) return null;
            return <DraggableSticker frame={frame} glyph={def.glyph} key={sticker.key} onCommit={commit} onRemove={(key) => setStickers((current) => current.filter((item) => item.key !== key))} showControls={!rendering} sticker={sticker} text={stickerText(def, now.current)} />;
          })}
        </View>
      </View>

      <View style={[styles.tools, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <LensSelector disabled={rendering} onSelect={onLensChange} selectedId={lensId} />
        <ScrollView horizontal contentContainerStyle={styles.stickerRow} showsHorizontalScrollIndicator={false} style={styles.stickerScroll}>
          {STICKERS.map((def) => (
            <AnimatedPressable
              accessibilityLabel={`${stickerText(def, now.current)} çıkartması ekle`}
              accessibilityRole="button"
              disabled={rendering || stickers.length >= 6}
              key={def.id}
              onPress={() => setStickers((current) => placeSticker(current, def.id, frame))}
              pressScale={0.92}
              style={styles.stickerChip}
            >
              <Text style={styles.stickerGlyph}>{def.glyph}</Text>
              <Text style={styles.stickerLabel}>{stickerText(def, now.current)}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <BlinkrButton
          icon={<Check color={colors.ink} size={22} />}
          label={submitLabel}
          loading={rendering}
          onPress={use}
          size="lg"
          style={styles.use}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000000', flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  back: { alignItems: 'center', backgroundColor: 'rgba(16, 23, 20, 0.7)', borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  title: { ...typography.bodyStrong, color: colors.text },
  stage: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  frame: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden' },
  tools: { gap: spacing.md, minHeight: TOOLS_HEIGHT, paddingTop: spacing.sm },
  stickerScroll: { flexGrow: 0 },
  stickerRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  stickerChip: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  stickerGlyph: { fontSize: 18 },
  stickerLabel: { ...typography.caption, color: colors.text, fontWeight: '700' },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg },
  use: { marginHorizontal: spacing.lg },
});
