import { useVideoPlayer, VideoView, type VideoPlayer as ExpoVideoPlayer, type VideoPlayerEvents } from 'expo-video';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated';

import { tx } from '../../i18n/tx';
// Drawn over video: the fixed dark media palette in both themes.
import { media, mediaColors, radii, spacing, typography } from '../../theme';
import { formatClock, nextRate, progressOf, rateLabel, seekTarget } from '../../videoControls';
import { AnimatedPressable } from '../AnimatedPressable';

type Props = {
  uri: string;
  fit?: 'cover' | 'contain';
  /** `minimal`: muted loop with a sound toggle and a thin progress line (card, feed). `full`: play/pause, scrubbing, speed, sound (full page, viewer). */
  controls?: 'minimal' | 'full';
  autoPlay?: boolean;
  startMuted?: boolean;
  loop?: boolean;
  /** False while off screen: the video pauses (only one plays at a time in lists). */
  active?: boolean;
  testID?: string;
};

const HIDE_AFTER_MS = 3000;

/** The player's latest event payload as state (a local copy of expo's useEvent, which the web preview cannot bundle). */
function usePlayerEvent<K extends keyof VideoPlayerEvents>(player: ExpoVideoPlayer, name: K, initial: Parameters<VideoPlayerEvents[K]>[0]) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const sub = player.addListener(name, ((payload: Parameters<VideoPlayerEvents[K]>[0]) => setValue(payload)) as VideoPlayerEvents[K]);
    return () => sub.remove();
  }, [player, name]);
  return value;
}

/**
 * Blinkr's video player (V2-2, FEATURES/08): one component for every surface. The card and feed show a quiet muted
 * loop; the full page and viewer show Instagram-like controls that fade after 3 s of play and come back on tap.
 * Scrubbing pauses while the finger moves and resumes where it was; speed cycles 1 → 1.25 → 1.5 → 2 → 0.5.
 */
export function VideoPlayer({ uri, fit = 'contain', controls = 'minimal', autoPlay = true, startMuted = controls === 'minimal', loop = true, active = true, testID }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = startMuted;
    p.timeUpdateEventInterval = 0.25;
    if (autoPlay && active) p.play();
  });
  const { isPlaying } = usePlayerEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = usePlayerEvent(player, 'statusChange', { status: player.status });
  const time = usePlayerEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const { muted } = usePlayerEvent(player, 'mutedChange', { muted: player.muted });
  const [rate, setRate] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [ended, setEnded] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const trackWidth = useRef(0);
  const resumeAfterScrub = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = player.duration || 0;
  const current = scrub ?? time?.currentTime ?? 0;

  useEffect(() => {
    if (active) { if (autoPlay && !ended) player.play(); } else player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => { if (!loop) setEnded(true); });
    return () => sub.remove();
  }, [player, loop]);

  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), HIDE_AFTER_MS);
  }, []);
  useEffect(() => {
    if (controls !== 'full') return undefined;
    if (isPlaying && chrome) armHide();
    if (!isPlaying && hideTimer.current) clearTimeout(hideTimer.current);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [armHide, chrome, controls, isPlaying]);

  const togglePlay = () => {
    if (ended) { player.currentTime = 0; setEnded(false); player.play(); return; }
    if (isPlaying) player.pause(); else player.play();
  };
  const toggleMute = () => { player.muted = !player.muted; };
  const cycleRate = () => { const next = nextRate(rate); player.playbackRate = next; setRate(next); };
  const retry = () => { player.replace(uri); player.play(); };

  const beginScrub = (x: number) => {
    resumeAfterScrub.current = player.playing;
    player.pause();
    setChrome(true);
    setScrub(seekTarget(x, trackWidth.current, duration));
  };
  const moveScrub = (x: number) => setScrub(seekTarget(x, trackWidth.current, duration));
  const endScrub = (x: number) => {
    player.currentTime = seekTarget(x, trackWidth.current, duration);
    setScrub(null);
    setEnded(false);
    if (resumeAfterScrub.current) player.play();
  };
  const scrubGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(beginScrub)(e.x); })
    .onUpdate((e) => { runOnJS(moveScrub)(e.x); })
    .onFinalize((e) => { runOnJS(endScrub)(e.x); });
  const onTrackLayout = (e: LayoutChangeEvent) => { trackWidth.current = e.nativeEvent.layout.width; };

  const progress = progressOf(current, duration);
  const failed = status === 'error';

  if (controls === 'minimal') {
    return (
      <View style={StyleSheet.absoluteFill} testID={testID}>
        <VideoView contentFit={fit} nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.lineTrack}><View style={[styles.lineFill, { width: `${progress * 100}%` }]} /></View>
        <AnimatedPressable
          accessibilityLabel={muted ? tx('signal:video.unmute', 'Sesi aç') : tx('signal:video.mute', 'Sesi kapat')}
          accessibilityRole="button"
          hitSlop={10}
          onPress={toggleMute}
          pressScale={0.9}
          style={styles.muteChip}
          testID="video-mute"
        >
          {muted ? <VolumeX color={mediaColors.text} size={16} /> : <Volume2 color={mediaColors.text} size={16} />}
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <VideoView contentFit={fit} nativeControls={false} player={player} style={StyleSheet.absoluteFill} />
      <AnimatedPressable accessibilityElementsHidden onPress={() => setChrome((c) => !c)} pressScale={1} style={StyleSheet.absoluteFill} />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{tx('signal:video.error', 'Video oynatılamadı')}</Text>
          <AnimatedPressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>{tx('signal:video.retry', 'Tekrar dene')}</Text>
          </AnimatedPressable>
        </View>
      ) : chrome || !isPlaying ? (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(200)} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View pointerEvents="box-none" style={styles.center}>
            <AnimatedPressable
              accessibilityLabel={ended ? tx('signal:video.replay', 'Tekrar oynat') : isPlaying ? tx('signal:video.pause', 'Duraklat') : tx('signal:video.play', 'Oynat')}
              accessibilityRole="button"
              onPress={togglePlay}
              pressScale={0.9}
              style={styles.bigButton}
              testID="video-play"
            >
              {ended ? <RotateCcw color={mediaColors.text} size={30} /> : isPlaying ? <Pause color={mediaColors.text} fill={mediaColors.text} size={30} /> : <Play color={mediaColors.text} fill={mediaColors.text} size={30} />}
            </AnimatedPressable>
          </View>
          <View style={styles.bar}>
            <Text style={styles.clock}>{formatClock(current)}</Text>
            <GestureDetector gesture={scrubGesture}>
              <View
                accessibilityLabel={tx('signal:video.seek', 'Video konumu')}
                accessibilityRole="adjustable"
                accessibilityValue={{ max: Math.round(duration), min: 0, now: Math.round(current) }}
                collapsable={false}
                onAccessibilityAction={(e) => { player.seekBy(e.nativeEvent.actionName === 'increment' ? 5 : -5); }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onLayout={onTrackLayout}
                style={styles.trackHit}
                testID="video-track"
              >
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                </View>
                <View style={[styles.thumb, { left: `${progress * 100}%` }, scrub !== null && styles.thumbActive]} />
              </View>
            </GestureDetector>
            <Text style={styles.clock}>{formatClock(duration)}</Text>
            <AnimatedPressable accessibilityLabel={tx('signal:video.speed', 'Oynatma hızı {{rate}}', { rate: rateLabel(rate) })} accessibilityRole="button" hitSlop={6} onPress={cycleRate} pressScale={0.92} style={styles.pill} testID="video-speed">
              <Text style={styles.pillText}>{rateLabel(rate)}</Text>
            </AnimatedPressable>
            <AnimatedPressable accessibilityLabel={muted ? tx('signal:video.unmute', 'Sesi aç') : tx('signal:video.mute', 'Sesi kapat')} accessibilityRole="button" hitSlop={6} onPress={toggleMute} pressScale={0.9} style={styles.iconButton} testID="video-mute">
              {muted ? <VolumeX color={mediaColors.text} size={18} /> : <Volume2 color={mediaColors.text} size={18} />}
            </AnimatedPressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  bigButton: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 64, justifyContent: 'center', width: 64 },
  bar: { alignItems: 'center', backgroundColor: media.scrim, borderRadius: radii.pill, bottom: spacing.md, flexDirection: 'row', gap: spacing.sm, left: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 6, position: 'absolute', right: spacing.md },
  clock: { ...typography.caption, color: mediaColors.text, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'center' },
  trackHit: { flex: 1, height: 28, justifyContent: 'center' },
  track: { backgroundColor: media.track, borderRadius: radii.pill, height: 3, overflow: 'hidden' },
  trackFill: { backgroundColor: mediaColors.text, height: 3 },
  thumb: { backgroundColor: mediaColors.text, borderRadius: 6, height: 12, marginLeft: -6, position: 'absolute', width: 12 },
  thumbActive: { height: 16, marginLeft: -8, width: 16, borderRadius: 8 },
  pill: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, height: 28, justifyContent: 'center', minWidth: 44, paddingHorizontal: 8 },
  pillText: { ...typography.label, color: mediaColors.text },
  iconButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  muteChip: { alignItems: 'center', backgroundColor: media.chip, borderRadius: radii.pill, top: spacing.md, height: 30, justifyContent: 'center', position: 'absolute', right: spacing.md, width: 30 },
  lineTrack: { backgroundColor: media.lineSoft, bottom: 0, height: 2, left: 0, position: 'absolute', right: 0 },
  lineFill: { backgroundColor: mediaColors.text, height: 2 },
  errorText: { ...typography.callout, color: mediaColors.text },
  retry: { backgroundColor: media.chip, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { ...typography.label, color: mediaColors.text },
});
