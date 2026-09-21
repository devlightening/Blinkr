import * as ScreenCapture from 'expo-screen-capture';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openSnap, snapMediaSource } from '../../api';
import { friendlyError } from '../../productPresentation';
import { timerLabel } from '../../snapPresentation';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse, SnapOpenResult } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { BlinkrButton } from '../ui/BlinkrButton';

type Props = {
  auth: AuthResponse;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatarKey?: string | null;
  /** Called once when the viewer ends. `opened` is true when the server marked the snap as opened. */
  onClose: (opened: boolean) => void;
  /** Reply with a snap of your own (the camera). */
  onReply?: () => void;
  onAuthChange?: (auth: AuthResponse) => void;
  onSessionExpired?: () => void;
};

type Phase = 'opening' | 'loading' | 'showing' | 'error';
type Source = { uri: string; headers: Record<string, string> };

function SnapVideo({ source, onReady, onEnd }: { source: Source; onReady: () => void; onEnd: () => void }) {
  const player = useVideoPlayer({ uri: source.uri, headers: source.headers }, (instance) => { instance.loop = false; instance.play(); });
  useEffect(() => {
    const ended = player?.addListener?.('playToEnd', onEnd);
    const status = player?.addListener?.('statusChange', ({ status: value }) => { if (value === 'readyToPlay') onReady(); });
    return () => { ended?.remove(); status?.remove(); };
  }, [player, onEnd, onReady]);
  return <VideoView contentFit="contain" nativeControls={false} player={player} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}

/**
 * Full-screen viewer for a view-once snap. Opening it tells the server to flip the snap to "opened" - after that
 * nobody, including this person, can open it again. A photo runs on its timer (tap to close early); a video plays
 * to its end. Screenshots are blocked where the platform allows it.
 */
export function SnapViewer({ auth, conversationId, messageId, senderName, senderId, senderAvatarKey, onClose, onReply, onAuthChange, onSessionExpired }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('opening');
  const [info, setInfo] = useState<SnapOpenResult | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);
  const closed = useRef(false);
  const started = useRef(false);
  const progress = useRef(new Animated.Value(1)).current;

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    progress.stopAnimation();
    onClose(opened.current);
  }, [onClose, progress]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const result = await openSnap(auth, conversationId, messageId, onAuthChange, onSessionExpired);
        if (!alive) return;
        opened.current = true;
        setInfo(result);
        setSource(snapMediaSource(auth, result.contentUrl));
        setPhase('loading');
      } catch (err) {
        if (!alive) return;
        setError(friendlyError(err, 'Bu Snap açılamadı. Tekrar dene.'));
        setPhase('error');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where the platform allows it, screenshots and screen recordings of a snap are blocked while it is on screen.
  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync('snap-view').catch(() => {});
    return () => { void ScreenCapture.allowScreenCaptureAsync('snap-view').catch(() => {}); };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [close]);

  /** The timer starts when the picture is really on screen, so a slow network does not eat the viewing time. */
  const startTimer = useCallback((seconds: number) => {
    if (started.current) return;
    started.current = true;
    setPhase('showing');
    if (seconds > 0) {
      Animated.timing(progress, { duration: seconds * 1000, easing: Easing.linear, toValue: 0, useNativeDriver: false }).start(({ finished }) => { if (finished) close(); });
    }
  }, [close, progress]);

  const fail = useCallback(() => {
    if (started.current) return;
    setError('Snap yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    setPhase('error');
  }, []);

  const isVideo = info?.mediaType === 'Video';
  const timed = Boolean(info && info.durationSeconds > 0);

  return (
    <View accessibilityViewIsModal style={styles.screen}>
      {source && info && !isVideo ? (
        <Image accessibilityLabel="Snap" onError={fail} onLoad={() => startTimer(info.durationSeconds)} resizeMode="contain" source={source} style={StyleSheet.absoluteFill} />
      ) : null}
      {source && info && isVideo ? <SnapVideo onEnd={close} onReady={() => startTimer(0)} source={source} /> : null}

      <Pressable accessibilityLabel="Snapı kapat" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        {timed ? (
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
        ) : <View style={styles.trackSpacer} />}
        <View style={styles.header}>
          <Avatar avatarKey={senderAvatarKey} seed={senderId} size={34} />
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.sender}>{senderName}</Text>
            {info ? <Text style={styles.meta}>{isVideo ? 'Video' : 'Snap'}{timed ? ` · ${timerLabel(info.durationSeconds)}` : ''}</Text> : null}
          </View>
          <AnimatedPressable accessibilityLabel="Kapat" accessibilityRole="button" hitSlop={8} onPress={close} pressScale={0.95} style={styles.close}>
            <X color={colors.text} size={22} />
          </AnimatedPressable>
        </View>
      </View>

      {phase === 'opening' || phase === 'loading' ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator accessibilityLabel="Snap yükleniyor" color={colors.text} />
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.center}>
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.errorTitle}>{error}</Text>
          <BlinkrButton label="Kapat" onPress={close} style={styles.errorButton} variant="secondary" />
        </View>
      ) : null}

      {phase === 'showing' ? (
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
          {info?.caption ? <Text accessibilityLabel={`Snap yazısı: ${info.caption}`} style={styles.caption}>{info.caption}</Text> : null}
          {onReply ? (
            <AnimatedPressable accessibilityLabel="Snap ile yanıtla" accessibilityRole="button" onPress={() => { close(); onReply(); }} pressScale={0.97} style={styles.reply}>
              <Camera color={colors.text} size={20} />
              <Text style={styles.replyText}>Yanıtla</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: '#000000', zIndex: 300 },
  top: { left: 0, paddingHorizontal: spacing.md, position: 'absolute', right: 0, top: 0 },
  track: { backgroundColor: 'rgba(255, 255, 255, 0.28)', borderRadius: 2, height: 3, overflow: 'hidden' },
  trackSpacer: { height: 3 },
  fill: { backgroundColor: colors.text, height: 3 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  headerCopy: { flex: 1 },
  sender: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: 'rgba(255, 255, 255, 0.72)' },
  close: { alignItems: 'center', backgroundColor: 'rgba(16, 20, 23, 0.55)', borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  errorTitle: { ...typography.body, color: colors.text, textAlign: 'center' },
  errorButton: { minWidth: 140 },
  bottom: { alignItems: 'center', bottom: 0, gap: spacing.md, left: 0, position: 'absolute', right: 0 },
  caption: { ...typography.body, backgroundColor: 'rgba(0, 0, 0, 0.58)', color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, textAlign: 'center', width: '100%' },
  reply: { alignItems: 'center', backgroundColor: 'rgba(16, 20, 23, 0.7)', borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg },
  replyText: { ...typography.bodyStrong, color: colors.text },
});
