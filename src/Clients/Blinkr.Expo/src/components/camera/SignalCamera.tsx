import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraOff, Images, SwitchCamera, X, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_VIDEO_SECONDS, ZOOM_PRESETS, flashLabel, formatRecording, lensById, nextFlash, type FlashMode } from '../../cameraEffects';
import { friendlyError } from '../../productPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { FilterOverlay } from './FilterOverlay';
import { LensSelector } from './LensSelector';
import { PhotoEditor, type CapturedMedia } from './PhotoEditor';

type Props = {
  onClose: () => void;
  onCapture: (asset: CapturedMedia) => void;
  /** Label of the button that hands a finished photo on ("Kullan" for signals, "İleri" for snaps). */
  submitLabel?: string;
};

type Mode = 'photo' | 'video';

const videoMime = (uri: string) => (/\.mov(\?|$)/i.test(uri) ? 'video/quicktime' : 'video/mp4');

/**
 * Blinkr's own camera: live lenses, flash, flip, zoom, photo and video. A photo goes on to the edit stage
 * (lens + stickers); a video is handed over as recorded, because a lens cannot be applied to a recording.
 * It only hands a file to `onCapture`; publishing (place, proximity, server trust) stays in the composer.
 */
export function SignalCamera({ onClose, onCapture, submitLabel }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const recordingRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [stage, setStage] = useState<'camera' | 'edit'>('camera');
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [lensId, setLensId] = useState('none');
  const [mode, setMode] = useState<Mode>('photo');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoomIndex, setZoomIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recordingRef.current) camera.current?.stopRecording();
    };
  }, []);

  // Android back steps out of the edit stage first, then closes the camera (never while recording).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (recordingRef.current) return true;
      if (stage === 'edit') { setStage('camera'); setPhoto(null); return true; }
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [stage, onClose]);

  useEffect(() => {
    if (!recording) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(timer);
  }, [recording]);

  const takePhoto = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.9 });
      if (!picture?.uri) throw new Error('no-picture');
      void Haptics.selectionAsync();
      if (mounted.current) { setPhoto({ uri: picture.uri, width: picture.width, height: picture.height }); setStage('edit'); }
    } catch (err) {
      console.log('[Blinkr Camera]', { failedStage: 'photo', errorCode: err instanceof Error ? err.name : 'Unknown' });
      if (mounted.current) setError(friendlyError(err, 'Fotoğraf çekilemedi. Tekrar dene.'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, ready]);

  const toggleRecording = useCallback(async () => {
    if (recordingRef.current) { camera.current?.stopRecording(); return; }
    if (busy || !ready) return;
    setError(null);
    if (!micPermission?.granted) {
      const asked = await requestMic();
      if (!asked.granted) { setError('Video için mikrofon izni gerekiyor.'); return; }
    }
    recordingRef.current = true;
    setRecording(true);
    setSeconds(0);
    void Haptics.selectionAsync();
    try {
      const video = await camera.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (video?.uri && mounted.current) onCapture({ uri: video.uri, width: 0, height: 0, type: 'video', mimeType: videoMime(video.uri), fileName: `blinkr-${Date.now()}.${videoMime(video.uri) === 'video/quicktime' ? 'mov' : 'mp4'}` });
    } catch (err) {
      console.log('[Blinkr Camera]', { failedStage: 'video', errorCode: err instanceof Error ? err.name : 'Unknown' });
      if (mounted.current) setError(friendlyError(err, 'Video kaydedilemedi. Tekrar dene.'));
    } finally {
      recordingRef.current = false;
      if (mounted.current) setRecording(false);
    }
  }, [busy, ready, micPermission, requestMic, onCapture]);

  const pickFromLibrary = async () => {
    if (busy || recording) return;
    setError(null);
    try {
      const allowed = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (allowed.status !== 'granted') { setError('Fotoğraf arşivi izni gerekiyor.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (asset.type === 'video') onCapture({ uri: asset.uri, width: asset.width, height: asset.height, type: 'video', mimeType: asset.mimeType ?? videoMime(asset.uri), fileName: asset.fileName ?? undefined });
      else { setPhoto({ uri: asset.uri, width: asset.width, height: asset.height }); setStage('edit'); }
    } catch (err) {
      setError(friendlyError(err, 'Medya seçilemedi. Tekrar dene.'));
    }
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <AnimatedPressable accessibilityLabel="Kamerayı kapat" accessibilityRole="button" onPress={onClose} pressScale={0.9} style={[styles.round, styles.closeAbsolute, { top: insets.top + spacing.sm }]}>
          <X color={colors.text} size={24} />
        </AnimatedPressable>
        <BlinkrEmptyState
          action={permission.canAskAgain
            ? { label: 'Kameraya izin ver', onPress: () => { void requestPermission(); } }
            : { label: 'Ayarları aç', onPress: () => { void Linking.openSettings(); } }}
          description="Sinyaline fotoğraf veya video eklemek için kameraya erişmemiz gerekiyor. İstersen kamerasız da paylaşabilirsin."
          icon={<CameraOff color={colors.textSecondary} size={34} />}
          title="Kamera izni gerekiyor"
        />
      </View>
    );
  }

  if (stage === 'edit' && photo) {
    return (
      <PhotoEditor
        submitLabel={submitLabel}
        lensId={lensId}
        onDone={onCapture}
        onLensChange={setLensId}
        onRetake={() => { setStage('camera'); setPhoto(null); }}
        photo={photo}
      />
    );
  }

  const lens = lensById(lensId);
  const FlashIcon = flash === 'off' ? ZapOff : Zap;
  const previewHeight = Math.round(windowWidth * (4 / 3));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.preview, { height: previewHeight }]}>
        <CameraView
          enableTorch={false}
          facing={facing}
          flash={flash}
          mirror={facing === 'front'}
          mode={mode === 'video' ? 'video' : 'picture'}
          onCameraReady={() => setReady(true)}
          ref={camera}
          style={StyleSheet.absoluteFill}
          zoom={ZOOM_PRESETS[zoomIndex].value}
        />
        {mode === 'photo' ? <FilterOverlay lens={lens} /> : null}

        <View style={styles.topBar}>
          <AnimatedPressable accessibilityLabel="Kamerayı kapat" accessibilityRole="button" disabled={recording} onPress={onClose} pressScale={0.9} style={[styles.round, recording && styles.dim]}>
            <X color={colors.text} size={24} />
          </AnimatedPressable>
          {recording ? (
            <View accessibilityLabel={`Kayıt ${formatRecording(seconds)}`} accessibilityLiveRegion="polite" style={styles.timer}>
              <View style={styles.recDot} />
              <Text style={styles.timerText}>{formatRecording(seconds)} / {formatRecording(MAX_VIDEO_SECONDS)}</Text>
            </View>
          ) : null}
          <View style={styles.topRight}>
            <AnimatedPressable accessibilityLabel={flashLabel(flash)} accessibilityRole="button" disabled={recording} onPress={() => setFlash(nextFlash(flash))} pressScale={0.9} style={styles.round}>
              <FlashIcon color={flash === 'off' ? colors.text : colors.primary} size={22} />
              {flash === 'auto' ? <Text style={styles.autoBadge}>A</Text> : null}
            </AnimatedPressable>
            <AnimatedPressable accessibilityLabel="Kamerayı çevir" accessibilityRole="button" disabled={recording} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} pressScale={0.9} style={styles.round}>
              <SwitchCamera color={colors.text} size={22} />
            </AnimatedPressable>
          </View>
        </View>

        <AnimatedPressable
          accessibilityLabel={`Yakınlaştırma ${ZOOM_PRESETS[zoomIndex].label}, değiştir`}
          accessibilityRole="button"
          onPress={() => setZoomIndex((zoomIndex + 1) % ZOOM_PRESETS.length)}
          pressScale={0.92}
          style={styles.zoom}
        >
          <Text style={styles.zoomText}>{ZOOM_PRESETS[zoomIndex].label}</Text>
        </AnimatedPressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {mode === 'photo'
          ? <LensSelector disabled={recording} onSelect={setLensId} selectedId={lensId} />
          : <Text style={styles.note}>Video, seçtiğin efekt olmadan kaydedilir.</Text>}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

        <View style={styles.modes}>
          {(['photo', 'video'] as const).map((item) => (
            <AnimatedPressable
              accessibilityLabel={item === 'photo' ? 'Fotoğraf modu' : 'Video modu'}
              accessibilityRole="button"
              aria-selected={mode === item}
              disabled={recording}
              key={item}
              onPress={() => setMode(item)}
              pressScale={0.94}
              style={[styles.modeChip, mode === item && styles.modeChipActive]}
            >
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item === 'photo' ? 'Fotoğraf' : 'Video'}</Text>
            </AnimatedPressable>
          ))}
        </View>

        <View style={styles.shutterRow}>
          <AnimatedPressable accessibilityLabel="Galeriden seç" accessibilityRole="button" disabled={recording || busy} onPress={pickFromLibrary} pressScale={0.9} style={[styles.gallery, (recording || busy) && styles.dim]}>
            <Images color={colors.text} size={26} />
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel={mode === 'photo' ? 'Fotoğraf çek' : recording ? 'Kaydı durdur' : 'Kaydı başlat'}
            accessibilityRole="button"
            aria-disabled={!ready}
            disabled={!ready || busy}
            onPress={mode === 'photo' ? takePhoto : toggleRecording}
            pressScale={0.94}
            style={[styles.shutterRing, recording && styles.shutterRingRecording, !ready && styles.dim]}
          >
            <View style={[styles.shutterCore, mode === 'video' && styles.shutterCoreVideo, recording && styles.shutterCoreRecording]} />
          </AnimatedPressable>
          <View style={styles.gallery} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000000', flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  closeAbsolute: { left: spacing.md, position: 'absolute' },
  preview: { backgroundColor: colors.surface, borderRadius: radii.xl, overflow: 'hidden' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: spacing.md, position: 'absolute', right: spacing.md, top: spacing.md },
  topRight: { flexDirection: 'row', gap: spacing.sm },
  round: { alignItems: 'center', backgroundColor: 'rgba(16, 23, 20, 0.62)', borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  dim: { opacity: 0.4 },
  autoBadge: { ...typography.label, color: colors.primary, fontSize: 9, position: 'absolute', right: 8, top: 6 },
  timer: { alignItems: 'center', backgroundColor: 'rgba(16, 23, 20, 0.7)', borderRadius: radii.pill, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  recDot: { backgroundColor: colors.danger, borderRadius: radii.pill, height: 10, width: 10 },
  timerText: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  zoom: { alignItems: 'center', backgroundColor: 'rgba(16, 23, 20, 0.62)', borderRadius: radii.pill, bottom: spacing.md, height: 40, justifyContent: 'center', position: 'absolute', right: spacing.md, width: 52 },
  zoomText: { ...typography.bodyStrong, color: colors.primary },
  bottom: { flex: 1, gap: spacing.md, justifyContent: 'flex-end', paddingTop: spacing.md },
  note: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.lg, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, textAlign: 'center' },
  modes: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  modeChip: { borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 8 },
  modeChipActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.primary, borderWidth: 1 },
  modeText: { ...typography.bodyStrong, color: colors.textSecondary },
  modeTextActive: { color: colors.primary },
  shutterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  gallery: { alignItems: 'center', backgroundColor: 'rgba(32, 43, 38, 0.9)', borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 },
  shutterRing: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.pill, borderWidth: 3, height: 76, justifyContent: 'center', width: 76 },
  shutterRingRecording: { borderColor: colors.danger },
  shutterCore: { backgroundColor: colors.text, borderRadius: radii.pill, height: 58, width: 58 },
  shutterCoreVideo: { backgroundColor: colors.danger },
  shutterCoreRecording: { borderRadius: 14, height: 34, width: 34 },
});
