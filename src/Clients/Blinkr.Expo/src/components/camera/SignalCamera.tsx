import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { AlertCircle, CameraOff, Images, MapPin, ShieldCheck, SwitchCamera, Type, X, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { HOLD_TO_RECORD_MS, MAX_VIDEO_SECONDS, clampZoom, recordingProgress, flashLabel, formatRecording, lensById, nextFlash, zoomMultiplierLabel, type FlashMode } from '../../cameraEffects';
import { capturedAtOf } from '../../galleryCapture';
import type { CameraPlace } from '../../cameraPlace';
import { friendlyError } from '../../productPresentation';
// Drawn over live camera/photo/video: always the dark media palette, whatever the app theme (plan-devam B3).
import { media, mediaColors as colors, radii, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { BlinkrEmptyState } from '../ui/BlinkrEmptyState';
import { FilterOverlay } from './FilterOverlay';
import { LensIndicator } from './LensIndicator';
import { useLensSwipe } from './LensSwipe';
import { PhotoEditor, type CapturedMedia } from './PhotoEditor';
import { tx } from '../../i18n/tx';

type Props = {
  onClose: () => void;
  onCapture: (asset: CapturedMedia) => void;
  /** Label of the button that hands a finished photo on ("Kullan" for signals, "İleri" for snaps). */
  submitLabel?: string;
  /** Snaps are photo-only: no video mode, no video from the gallery. */
  photoOnly?: boolean;
  /** "Aa": leave the camera for a text-only signal (sinyal-mvp-plan P5.2). Hidden when absent (snaps). */
  onTextOnly?: () => void;
  /** plan-devam D3: where the share will start - the nearest place, or the approximate area, or "Konum belirsiz". */
  place?: CameraPlace | null;
};

type Mode = 'photo' | 'video';

/** onCameraReady sometimes never fires on real Android hardware; past this, the shutter unlocks anyway. */
const READY_FALLBACK_MS = 1200;

const videoMime = (uri: string) => (/\.mov(\?|$)/i.test(uri) ? 'video/quicktime' : 'video/mp4');

/**
 * Blinkr's own camera: a full-bleed live preview - exactly like the camera you already know - with lenses, flash,
 * flip, pinch-to-zoom, photo and video. A photo goes on to the edit stage (lens + stickers); a video is handed over
 * as recorded, because a lens cannot be applied to a recording. It only hands a file to `onCapture`; publishing
 * (place, proximity, server trust) stays in the composer.
 */
export function SignalCamera({ onClose, onCapture, submitLabel, photoOnly = false, onTextOnly, place = null }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('create');
  // plan-devam D11: the sensitive-place notice shows once per place while the camera is open.
  const [noticeSeenFor, setNoticeSeenFor] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const recordingRef = useRef(false);
  const zoomRef = useRef(0);
  const zoomStartRef = useRef(0);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hold-to-record: the shutter was held long enough; recording starts once the camera is in video mode.
  const holdRef = useRef(false);
  const heldRecording = useRef(false);
  const [holdPending, setHoldPending] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [stage, setStage] = useState<'camera' | 'edit'>('camera');
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number; capturedAtUtc?: string | null } | null>(null);
  const [lensId, setLensId] = useState('none');
  const [mode, setMode] = useState<Mode>('photo');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);
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
      if (readyTimer.current) clearTimeout(readyTimer.current);
    };
  }, []);

  // A stuck "hazırlanıyor" shutter reads as a broken camera; this is the safety net for devices where
  // onCameraReady never fires. It costs nothing when the callback does fire first.
  useEffect(() => {
    if (!permission?.granted || stage !== 'camera') return undefined;
    readyTimer.current = setTimeout(() => { if (mounted.current) setReady(true); }, READY_FALLBACK_MS);
    return () => { if (readyTimer.current) clearTimeout(readyTimer.current); };
  }, [permission?.granted, stage, facing]);

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
      if (mounted.current) setError(friendlyError(err, tx('create:camera.photoFailed', 'Fotoğraf çekilemedi. Tekrar dene.')));
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
      if (!asked.granted) { setError(tx('create:camera.micNeeded', 'Video için mikrofon izni gerekiyor.')); return; }
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
      if (mounted.current) setError(friendlyError(err, tx('create:camera.videoFailed', 'Video kaydedilemedi. Tekrar dene.')));
    } finally {
      recordingRef.current = false;
      if (mounted.current) setRecording(false);
      if (mounted.current && heldRecording.current) { heldRecording.current = false; setMode('photo'); }
    }
  }, [busy, ready, micPermission, requestMic, onCapture]);

  // Snapchat-style: holding the shutter records. expo-camera only records in video mode, so a hold switches the
  // mode first and starts once the preview has had a moment to reconfigure; releasing stops it.
  useEffect(() => {
    if (!holdPending || mode !== 'video') return undefined;
    const timer = setTimeout(() => {
      setHoldPending(false);
      if (holdRef.current) { heldRecording.current = true; void toggleRecording(); }
    }, 350);
    return () => clearTimeout(timer);
  }, [holdPending, mode, toggleRecording]);

  const startHold = () => {
    if (photoOnly || busy || !ready || recordingRef.current) return;
    holdRef.current = true;
    setMode('video');
    setHoldPending(true);
  };

  const endHold = () => {
    if (!holdRef.current) return;
    holdRef.current = false;
    setHoldPending(false);
    // Switching mode while a clip is still being written can drop it; the recording finally-block switches back.
    if (recordingRef.current) { camera.current?.stopRecording(); return; }
    setMode('photo');
  };

  const pickFromLibrary = async () => {
    if (busy || recording) return;
    setError(null);
    try {
      const allowed = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (allowed.status !== 'granted') { setError(tx('create:camera.libraryNeeded', 'Fotoğraf arşivi izni gerekiyor.')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: photoOnly ? ['images'] : ['images', 'videos'], quality: 0.84, videoMaxDuration: MAX_VIDEO_SECONDS, exif: true });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      if (asset.type === 'video') onCapture({ uri: asset.uri, width: asset.width, height: asset.height, type: 'video', mimeType: asset.mimeType ?? videoMime(asset.uri), fileName: asset.fileName ?? undefined });
      else { setPhoto({ uri: asset.uri, width: asset.width, height: asset.height, capturedAtUtc: capturedAtOf(asset)?.toISOString() ?? null }); setStage('edit'); }
    } catch (err) {
      setError(friendlyError(err, tx('create:camera.pickFailed', 'Medya seçilemedi. Tekrar dene.')));
    }
  };

  // Pinch anywhere on the preview to zoom, like the camera you already know; the pill shows where you are and
  // resets to 1.0x on tap. expo-camera's zoom is a 0..1 fraction, so the gesture maps naturally onto that range.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => { zoomStartRef.current = zoomRef.current; })
    .onUpdate((event) => {
      const next = clampZoom(zoomStartRef.current + (event.scale - 1) / 2);
      zoomRef.current = next;
      setZoom(next);
    });
  const lensSwipe = useLensSwipe(lensId, setLensId, recording || mode !== 'photo');
  const previewGestures = Gesture.Simultaneous(pinch, lensSwipe.gesture);
  const resetZoom = () => { zoomRef.current = 0; setZoom(0); };

  if (!permission) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator accessibilityLabel={tx('create:camera.preparing', 'Kamera hazırlanıyor')} color={colors.flare} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <AnimatedPressable accessibilityLabel={tx('create:camera.close', 'Kamerayı kapat')} accessibilityRole="button" onPress={onClose} pressScale={0.9} style={[styles.round, styles.closeAbsolute, { top: insets.top + spacing.sm }]}>
          <X color={colors.text} size={24} />
        </AnimatedPressable>
        <BlinkrEmptyState
          action={permission.canAskAgain
            ? { label: tx('create:camera.allow', 'Kameraya izin ver'), onPress: () => { void requestPermission(); } }
            : { label: tx('common:actions.openSettings', 'Ayarları aç'), onPress: () => { void Linking.openSettings(); } }}
          description={tx('create:camera.permissionWhy', 'Sinyaline fotoğraf veya video eklemek için kameraya erişmemiz gerekiyor. İstersen kamerasız da paylaşabilirsin.')}
          icon={<CameraOff color={colors.textSecondary} size={34} />}
          title={tx('create:camera.permissionTitle', 'Kamera izni gerekiyor')}
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

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={previewGestures}>
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            enableTorch={false}
            facing={facing}
            flash={flash}
            mirror={facing === 'front'}
            mode={mode === 'video' ? 'video' : 'picture'}
            onCameraReady={() => setReady(true)}
            ref={camera}
            style={StyleSheet.absoluteFill}
            zoom={zoom}
          />
          {mode === 'photo' ? <FilterOverlay lens={lens} /> : null}
          {lensSwipe.label}
        </View>
      </GestureDetector>

      {/* A flat scrim behind the top chrome keeps icons legible over a bright sky without dimming the shot itself. */}
      <View pointerEvents="none" style={styles.topScrim} />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <AnimatedPressable accessibilityLabel={tx('create:camera.close', 'Kamerayı kapat')} accessibilityRole="button" disabled={recording} onPress={onClose} pressScale={0.9} style={[styles.round, recording && styles.dim]}>
          <X color={colors.text} size={24} />
        </AnimatedPressable>
        {recording ? (
          <View accessibilityLabel={tx('create:camera.recording', 'Kayıt {{time}}', { time: formatRecording(seconds) })} accessibilityLiveRegion="polite" style={styles.timer}>
            <View style={styles.recDot} />
            <Text style={styles.timerText}>{formatRecording(seconds)} / {formatRecording(MAX_VIDEO_SECONDS)}</Text>
          </View>
        ) : null}
        <View style={styles.topRight}>
          <AnimatedPressable accessibilityLabel={flashLabel(flash)} accessibilityRole="button" disabled={recording} onPress={() => setFlash(nextFlash(flash))} pressScale={0.9} style={styles.round}>
            <FlashIcon color={flash === 'off' ? colors.text : colors.flare} size={22} />
            {flash === 'auto' ? <Text style={styles.autoBadge}>A</Text> : null}
          </AnimatedPressable>
          <AnimatedPressable accessibilityLabel={tx('create:camera.flip', 'Kamerayı çevir')} accessibilityRole="button" disabled={recording} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')} pressScale={0.9} style={styles.round}>
            <SwitchCamera color={colors.text} size={22} />
          </AnimatedPressable>
        </View>
      </View>

      {place && !recording ? (
        <View pointerEvents="none" style={[styles.placeChipRow, { top: insets.top + spacing.sm + 52 }]}>
          <View accessibilityLabel={place.uncertain ? t('safety.uncertainTitle') : place.label} style={[styles.placeChip, place.uncertain && styles.placeChipWarn]} testID="camera-place">
            {place.uncertain ? <AlertCircle color={colors.warning} size={15} /> : <MapPin color={colors.text} size={15} />}
            <Text numberOfLines={1} style={[styles.placeChipText, place.uncertain && styles.placeChipWarnText]}>{place.uncertain ? t('safety.uncertainTitle') : place.label}</Text>
          </View>
        </View>
      ) : null}
      {place?.sensitivity && place.place && noticeSeenFor !== place.place.id && !photoOnly ? (
        <View accessibilityRole="alert" style={[styles.notice, { top: insets.top + spacing.sm + 96 }]} testID="camera-sensitive">
          <ShieldCheck color={colors.warning} size={20} />
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>{t(place.sensitivity === 'education' ? 'safety.noMediaTitle' : 'safety.privacyTitle')}</Text>
            <Text style={styles.noticeText}>{t(place.sensitivity === 'education' ? 'safety.noMediaBody' : 'safety.privacyBody')}</Text>
            <View style={styles.noticeActions}>
              {place.sensitivity === 'education' && onTextOnly ? (
                <AnimatedPressable accessibilityRole="button" onPress={onTextOnly} pressScale={0.95} style={styles.noticePrimary}><Text style={styles.noticePrimaryText}>{t('camera.textOnly')}</Text></AnimatedPressable>
              ) : null}
              <AnimatedPressable accessibilityRole="button" onPress={() => setNoticeSeenFor(place.place?.id ?? null)} pressScale={0.95} style={styles.noticeSecondary}><Text style={styles.noticeSecondaryText}>{t('safety.gotIt')}</Text></AnimatedPressable>
            </View>
          </View>
        </View>
      ) : null}

      <AnimatedPressable
        accessibilityLabel={tx('create:camera.zoomA11y', 'Yakınlaştırma {{zoom}}, sıfırla', { zoom: zoomMultiplierLabel(zoom) })}
        accessibilityRole="button"
        onPress={resetZoom}
        pressScale={0.92}
        style={[styles.zoom, zoom > 0 && styles.zoomActive]}
      >
        <Text style={[styles.zoomText, zoom > 0 && styles.zoomTextActive]}>{zoomMultiplierLabel(zoom)}</Text>
      </AnimatedPressable>

      {/* A second scrim behind the bottom chrome, same reasoning as the top one. */}
      <View pointerEvents="none" style={styles.bottomScrim} />

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {mode === 'photo'
          ? <LensIndicator disabled={recording} onSelect={setLensId} selectedId={lensId} />
          : <Text style={styles.note}>{tx('create:camera.videoNoLens', 'Video, seçtiğin efekt olmadan kaydedilir.')}</Text>}
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

        {photoOnly ? null : (
          <View style={styles.modes}>
            {(['photo', 'video'] as const).map((item) => (
              <AnimatedPressable
                accessibilityLabel={item === 'photo' ? tx('create:camera.photoMode', 'Fotoğraf modu') : tx('create:camera.videoMode', 'Video modu')}
                accessibilityRole="button"
                aria-selected={mode === item}
                disabled={recording}
                key={item}
                onPress={() => setMode(item)}
                pressScale={0.94}
                style={[styles.modeChip, mode === item && styles.modeChipActive]}
              >
                <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item === 'photo' ? tx('create:camera.photo', 'Fotoğraf') : tx('create:camera.video', 'Video')}</Text>
              </AnimatedPressable>
            ))}
          </View>
        )}

        <View style={styles.shutterRow}>
          <AnimatedPressable accessibilityLabel={tx('create:camera.gallery', 'Galeriden seç')} accessibilityRole="button" disabled={recording || busy} onPress={pickFromLibrary} pressScale={0.9} style={[styles.gallery, (recording || busy) && styles.dim]}>
            <Images color={colors.text} size={26} />
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel={mode === 'photo' ? tx('create:camera.shoot', 'Fotoğraf çek') : recording ? tx('create:camera.stop', 'Kaydı durdur') : tx('create:camera.start', 'Kaydı başlat')}
            accessibilityRole="button"
            aria-disabled={!ready}
            disabled={!ready || busy}
            accessibilityHint={mode === 'photo' && !photoOnly ? tx('create:camera.holdHint', 'Basılı tutarsan video kaydeder (en fazla 15 sn).') : undefined}
            delayLongPress={HOLD_TO_RECORD_MS}
            onLongPress={mode === 'photo' ? startHold : undefined}
            onPress={mode === 'photo' ? takePhoto : toggleRecording}
            onPressOut={endHold}
            pressScale={0.94}
            style={[styles.shutterRing, recording && styles.shutterRingRecording, !ready && styles.dim]}
            testID="shutter"
          >
            {recording ? (
              <Svg accessibilityLabel={tx('create:camera.progressA11y', 'kayıt ilerlemesi {{percent}}', { percent: Math.round(recordingProgress(seconds) * 100) })} height={RING} style={StyleSheet.absoluteFill} width={RING}>
                <Circle cx={RING / 2} cy={RING / 2} fill="none" r={RING_R} stroke={colors.danger} strokeDasharray={`${RING_C} ${RING_C}`} strokeDashoffset={RING_C * (1 - recordingProgress(seconds))} strokeLinecap="round" strokeWidth={4} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} />
              </Svg>
            ) : null}
            <View style={[styles.shutterCore, mode === 'video' && styles.shutterCoreVideo, recording && styles.shutterCoreRecording]} />
          </AnimatedPressable>
          {onTextOnly ? (
            <AnimatedPressable accessibilityLabel={tx('create:camera.textOnlyA11y', 'Sadece yazılı sinyal')} accessibilityRole="button" disabled={recording || busy} onPress={onTextOnly} pressScale={0.9} style={[styles.gallery, (recording || busy) && styles.dim]}>
              <Type color={colors.text} size={26} />
            </AnimatedPressable>
          ) : <View style={styles.gallery} />}
        </View>
      </View>
    </View>
  );
}

const CHROME_HEIGHT = 130;
const RING = 76;
const RING_R = (RING - 4) / 2;
const RING_C = 2 * Math.PI * RING_R;
const styles = StyleSheet.create({
  screen: { backgroundColor: media.black, flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  closeAbsolute: { left: spacing.md, position: 'absolute' },
  topScrim: { backgroundColor: media.scrimTop, height: CHROME_HEIGHT, left: 0, position: 'absolute', right: 0, top: 0 },
  bottomScrim: { backgroundColor: media.scrim, bottom: 0, height: 280, left: 0, position: 'absolute', right: 0 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: spacing.md, position: 'absolute', right: spacing.md },
  topRight: { flexDirection: 'row', gap: spacing.sm },
  round: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  dim: { opacity: 0.4 },
  autoBadge: { ...typography.label, color: colors.flare, fontSize: 9, position: 'absolute', right: 8, top: 6 },
  timer: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  recDot: { backgroundColor: colors.danger, borderRadius: radii.pill, height: 10, width: 10 },
  timerText: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  zoom: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, bottom: 178, height: 40, justifyContent: 'center', position: 'absolute', right: spacing.md, width: 56 },
  zoomActive: { backgroundColor: media.sunSoft },
  zoomText: { ...typography.bodyStrong, color: colors.text },
  zoomTextActive: { color: colors.flare },
  bottom: { bottom: 0, gap: spacing.md, left: 0, position: 'absolute', right: 0 },
  note: { ...typography.caption, color: colors.text, paddingHorizontal: spacing.lg, textAlign: 'center' },
  error: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.lg, textAlign: 'center' },
  modes: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  modeChip: { borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 8 },
  modeChipActive: { backgroundColor: media.lineSoft, borderColor: colors.flare, borderWidth: 1 },
  modeText: { ...typography.bodyStrong, color: media.textSoft },
  modeTextActive: { color: colors.flare },
  shutterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  gallery: { alignItems: 'center', backgroundColor: media.chipStrong, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 },
  shutterRing: { alignItems: 'center', borderColor: colors.flare, borderRadius: radii.pill, borderWidth: 3, height: 76, justifyContent: 'center', width: 76 },
  shutterRingRecording: { borderColor: colors.danger },
  shutterCore: { backgroundColor: colors.text, borderRadius: radii.pill, height: 58, width: 58 },
  shutterCoreVideo: { backgroundColor: colors.danger },
  shutterCoreRecording: { borderRadius: 14, height: 34, width: 34 },
  placeChipRow: { alignItems: 'center', left: 0, position: 'absolute', right: 0 },
  placeChip: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, flexDirection: 'row', gap: 6, maxWidth: '70%', paddingHorizontal: 12, paddingVertical: 7 },
  placeChipWarn: { backgroundColor: media.chipStrong, borderColor: colors.warning, borderWidth: 1 },
  placeChipText: { ...typography.label, color: colors.text, flexShrink: 1 },
  placeChipWarnText: { color: colors.warning },
  notice: { alignItems: 'flex-start', backgroundColor: media.chipStrong, borderColor: media.line, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, left: spacing.md, padding: spacing.md, position: 'absolute', right: spacing.md },
  noticeBody: { flex: 1, gap: 4 },
  noticeTitle: { ...typography.bodyStrong, color: colors.text },
  noticeText: { ...typography.caption, color: media.textSoft },
  noticeActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  noticePrimary: { alignItems: 'center', backgroundColor: colors.flare, borderRadius: radii.pill, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  noticePrimaryText: { ...typography.label, color: colors.ink },
  noticeSecondary: { alignItems: 'center', borderColor: media.line, borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  noticeSecondaryText: { ...typography.label, color: colors.text },
});
