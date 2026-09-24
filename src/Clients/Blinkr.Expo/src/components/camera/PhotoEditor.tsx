import { Check, ChevronLeft, Trash2, Type } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import { captureRef } from 'react-native-view-shot';

import { MAX_STICKERS, STICKERS, TEXT_COLORS, TEXT_MAX, TEXT_STYLE_LABELS, TRASH_ZONE, nextTextStyle, placeText, textOnColor, type TextStyleId, lensById, lensChangesPicture, placeSticker, signalFromStickers, stickerName, stickerText, type PlacedSticker, type StickerSignal } from '../../cameraEffects';
import { friendlyError } from '../../productPresentation';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, typography } from '../../theme';
import { useLensSwipe } from './LensSwipe';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrButton } from '../ui/BlinkrButton';
import { DraggableSticker } from './DraggableSticker';
import { FilterOverlay } from './FilterOverlay';
import { LensIndicator } from './LensIndicator';
import { tx } from '../../i18n/tx';

export type CapturedMedia = {
  uri: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  mimeType: string;
  fileName?: string;
  /** From a type sticker: lets the composer start with that signal type chosen (the person can change it). */
  signalHint?: StickerSignal | null;
  /** When the picture was taken, if it came from the gallery (P5.11). */
  capturedAtUtc?: string | null;
};

type Props = {
  photo: { uri: string; width: number; height: number; capturedAtUtc?: string | null };
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
export function PhotoEditor({ photo, lensId, onLensChange, onRetake, onDone, submitLabel = tx('create:editor.use', 'Kullan') }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const shot = useRef<View>(null);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [rendering, setRendering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [writing, setWriting] = useState<{ value: string; style: TextStyleId; color: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const now = useRef(new Date());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const lens = lensById(lensId);
  const lensSwipe = useLensSwipe(lensId, onLensChange, rendering);
  const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 3 / 4;
  const availableHeight = Math.max(240, windowHeight - insets.top - insets.bottom - TOOLS_HEIGHT - 64);
  const frameWidth = Math.min(windowWidth - spacing.lg, availableHeight * ratio);
  const frame = { width: Math.round(frameWidth), height: Math.round(frameWidth / ratio) };

  const commit = (key: string, x: number, y: number, scale: number, rotation: number) =>
    setStickers((current) => current.map((item) => (item.key === key ? { ...item, x, y, scale, rotation } : item)));
  const signalHint = signalFromStickers(stickers);

  const use = async () => {
    if (rendering) return;
    setError(null);
    const untouched = !lensChangesPicture(lens) && stickers.length === 0;
    if (untouched) {
      onDone({ uri: photo.uri, width: photo.width, height: photo.height, type: 'image', mimeType: 'image/jpeg', fileName: `blinkr-${Date.now()}.jpg`, signalHint, capturedAtUtc: photo.capturedAtUtc ?? null });
      return;
    }
    setRendering(true);
    try {
      // Let the remove buttons disappear from the picture before it is rendered.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const uri = await captureRef(shot, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
      if (!uri) throw new Error('render-failed');
      if (mounted.current) onDone({ uri, width: photo.width, height: photo.height, type: 'image', mimeType: 'image/jpeg', fileName: `blinkr-${Date.now()}.jpg`, signalHint, capturedAtUtc: photo.capturedAtUtc ?? null });
    } catch (err) {
      console.log('[Blinkr Camera]', { failedStage: 'render', errorCode: err instanceof Error ? err.name : 'Unknown' });
      if (mounted.current) setError(friendlyError(err, tx('create:editor.renderFailed', 'Fotoğraf hazırlanamadı. Efektleri kaldırıp tekrar dene.')));
    } finally {
      if (mounted.current) setRendering(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        <AnimatedPressable accessibilityLabel={tx('create:editor.retake', 'Yeniden çek')} accessibilityRole="button" onPress={onRetake} pressScale={0.9} style={styles.back}>
          <ChevronLeft color={colors.text} size={26} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>{tx('create:editor.title', 'Efekt ve çıkartma')}</Text>
        <AnimatedPressable accessibilityLabel={tx('create:editor.addText', 'Yazı ekle')} accessibilityRole="button" disabled={rendering || stickers.length >= MAX_STICKERS} onPress={() => setWriting({ value: '', style: 'solid', color: TEXT_COLORS[0] })} pressScale={0.9} style={[styles.back, stickers.length >= MAX_STICKERS && styles.dim]}>
          <Type color={colors.text} size={22} />
        </AnimatedPressable>
      </View>

      <View style={styles.stage}>
        <GestureDetector gesture={lensSwipe.gesture}>
        <View collapsable={false} ref={shot} style={[styles.frame, frame]}>
          <Image accessibilityLabel={tx('create:editor.photo', 'Çekilen fotoğraf')} resizeMode="cover" source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
          <FilterOverlay lens={lens} />
          {stickers.map((sticker) => {
            const def = sticker.text ? { glyph: '', id: 'text', kind: 'label' as const, label: sticker.text } : STICKERS.find((item) => item.id === sticker.stickerId);
            if (!def) return null;
            return <DraggableSticker frame={frame} glyph={def.glyph} key={sticker.key} onCommit={commit} onDragChange={setDragging} onRemove={(key) => setStickers((current) => current.filter((item) => item.key !== key))} showControls={!rendering} sticker={sticker} text={stickerText(def, now.current)} />;
          })}
          {writing ? (
            <View style={styles.writeLayer}>
              <TextInput
                accessibilityLabel={tx('create:editor.textInput', 'Fotoğrafa yazı')}
                autoFocus
                maxLength={TEXT_MAX}
                multiline
                onChangeText={(value) => setWriting((w) => (w ? { ...w, value } : w))}
                placeholder={tx('create:editor.write', 'Yaz…')}
                placeholderTextColor={media.textFaint}
                style={[styles.writeInput, writing.style === 'solid' ? { backgroundColor: writing.color, color: textOnColor(writing.color) } : { color: writing.color }]}
                value={writing.value}
              />
              <View style={styles.writeTools}>
                <AnimatedPressable accessibilityLabel={tx('create:editor.textStyle', 'Yazı stili: {{style}}', { style: TEXT_STYLE_LABELS[writing.style] })} accessibilityRole="button" onPress={() => setWriting((w) => (w ? { ...w, style: nextTextStyle(w.style) } : w))} pressScale={0.92} style={styles.writeStyle}>
                  <Text style={styles.writeStyleText}>{TEXT_STYLE_LABELS[writing.style]}</Text>
                </AnimatedPressable>
                {TEXT_COLORS.map((color) => (
                  <AnimatedPressable accessibilityLabel={tx('create:editor.color', 'Renk {{color}}', { color })} accessibilityRole="button" aria-selected={writing.color === color} key={color} onPress={() => setWriting((w) => (w ? { ...w, color } : w))} pressScale={0.9} style={[styles.swatch, { backgroundColor: color }, writing.color === color && styles.swatchActive]} />
                ))}
              </View>
              <AnimatedPressable
                accessibilityLabel={tx('create:editor.placeText', 'Yazıyı ekle')}
                accessibilityRole="button"
                onPress={() => { setStickers((current) => placeText(current, writing.value, writing.style, writing.color, frame)); setWriting(null); }}
                pressScale={0.95}
                style={styles.writeDone}
              >
                <Text style={styles.writeDoneText}>{tx('create:editor.done', 'Bitti')}</Text>
              </AnimatedPressable>
            </View>
          ) : null}
          {dragging && !rendering ? (
            <View pointerEvents="none" style={[styles.trash, { bottom: TRASH_ZONE.bottomMargin, left: frame.width / 2 - TRASH_ZONE.size / 2 }]} testID="sticker-trash">
              <Trash2 color={colors.text} size={26} />
            </View>
          ) : null}
          {rendering ? null : lensSwipe.label}
        </View>
        </GestureDetector>
      </View>

      <View style={[styles.tools, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <LensIndicator disabled={rendering} onSelect={onLensChange} selectedId={lensId} />
        <ScrollView horizontal contentContainerStyle={styles.stickerRow} showsHorizontalScrollIndicator={false} style={styles.stickerScroll}>
          {STICKERS.map((def) => (
            <AnimatedPressable
              accessibilityLabel={tx('create:editor.addSticker', '{{name}} çıkartması ekle', { name: stickerName(def, now.current) })}
              accessibilityRole="button"
              disabled={rendering || stickers.length >= 6}
              key={def.id}
              onPress={() => setStickers((current) => placeSticker(current, def.id, frame))}
              pressScale={0.92}
              style={styles.stickerChip}
            >
              <Text style={styles.stickerGlyph}>{def.glyph}</Text>
              {def.kind === 'emoji' ? null : <Text style={styles.stickerLabel}>{stickerText(def, now.current)}</Text>}
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
          style={[styles.use, styles.flareButton]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: media.black, flex: 1 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  back: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
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
  dim: { opacity: 0.4 },
  writeLayer: { alignItems: 'center', backgroundColor: media.scrim, bottom: 0, gap: spacing.md, justifyContent: 'center', left: 0, padding: spacing.md, position: 'absolute', right: 0, top: 0 },
  writeInput: { ...typography.title, borderRadius: radii.md, maxWidth: '90%', minWidth: 120, paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center' },
  writeTools: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  writeStyle: { borderColor: colors.text, borderRadius: radii.pill, borderWidth: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  writeStyleText: { ...typography.label, color: colors.text },
  swatch: { borderColor: media.line, borderRadius: radii.pill, borderWidth: 1, height: 28, width: 28 },
  swatchActive: { borderColor: colors.flare, borderWidth: 3 },
  writeDone: { alignItems: 'center', backgroundColor: colors.flare, borderRadius: radii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg },
  writeDoneText: { ...typography.bodyStrong, color: colors.ink },
  trash: { alignItems: 'center', backgroundColor: media.scrimStrong, borderColor: colors.text, borderRadius: radii.pill, borderWidth: 1.5, height: TRASH_ZONE.size, justifyContent: 'center', position: 'absolute', width: TRASH_ZONE.size },
  flareButton: { backgroundColor: colors.flare },
});
