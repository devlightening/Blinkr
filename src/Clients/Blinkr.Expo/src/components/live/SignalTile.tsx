import { LinearGradient } from 'expo-linear-gradient';
import { EyeOff, Images, Play } from 'lucide-react-native';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { toAbsoluteUrl } from '../../api';
import { tx } from '../../i18n/tx';
import { pinTagParts } from '../../live/liveLabels';
import { kindFromSignal } from '../../live/liveState';
import { formatAge, signalLabels } from '../../presentation';
import { signalValueLabel } from '../../productPresentation';
import { gridTile, gridTileHeight } from '../../profileGrid';
import { colors, gradients, liveColors, mediaColors, radii, spacing, typography, withAlpha } from '../../theme';
import type { AuthoredPost } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { SignalSymbol } from '../SignalSymbol';
import { LiveRing } from './LiveRing';
import { StatusPill } from './StatusPill';

const RING = 64;
const CORNER_ROOM = 28;

/**
 * One tile of a profile grid: the photo, or a plain tile with a neutral ring, a pill with the short word of what the post
 * reported, and "place · age" at the bottom. The author list carries no publication trust, so a tile is never coloured:
 * the coloured ring and pill mean "server-verified, live" and a profile grid cannot claim that.
 */
function SignalTileBase({ post, size, onPress }: { post: AuthoredPost; size: number; onPress?: () => void }) {
  const tile = gridTile(post);
  const stateKind = kindFromSignal(post.signalType, post.signalValue);
  const word = stateKind
    ? pinTagParts({ kind: stateKind, level: null, freshness: 0, ageMinutes: null, confirmations: 0, isStale: true, source: 'live', signalType: post.signalType, signalValue: post.signalValue ?? null }).state
    : signalValueLabel(post.signalType, post.signalValue) || tx('profile:grid.signal', 'Sinyal');
  const place = post.locationName || signalLabels[post.signalType] || tx('profile:grid.signal', 'Sinyal');
  const age = formatAge(post.createdAtUtc);
  const url = tile.photoUrl ? toAbsoluteUrl(tile.photoUrl) : null;
  const label = `${place}, ${word}, ${age}${tile.video ? tx('profile:grid.videoSuffix', ', video') : ''}${tile.anonymous ? tx('profile:grid.anon', ', anonim') : ''}${tile.expired ? tx('profile:grid.expired', ', sona erdi') : ''}`;
  const onPhoto = Boolean(url);

  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      pressScale={0.97}
      style={[styles.tile, { height: gridTileHeight(size), width: size }, tile.expired && styles.expired]}
      testID={`grid-tile-${post.id}`}
    >
      {url ? (
        <>
          <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: url }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={gradients.scrimBottom} pointerEvents="none" style={styles.scrim} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.plain, { backgroundColor: withAlpha(liveColors.unknown, 0.12) }]}>
          <LiveRing freshness={0} kind="unknown" size={RING}>
            <SignalSymbol color={colors.textSecondary} size={22} type={post.signalType} />
          </LiveRing>
        </View>
      )}
      <View style={[styles.pillBack, { maxWidth: size - spacing.xs * 2 - (tile.video || tile.extraPhotos > 0 ? CORNER_ROOM : 0) }]}>
        <StatusPill kind="unknown" label={word} singleLine />
      </View>
      {tile.video ? <View accessibilityLabel={tx('profile:grid.video', 'video')} style={styles.corner} testID={`grid-video-${post.id}`}><Play color={mediaColors.white} fill={mediaColors.white} size={14} /></View>
        : tile.extraPhotos > 0 ? <View style={styles.corner}><Images color={onPhoto ? mediaColors.white : colors.text} size={14} /></View> : null}
      <View style={styles.caption}>
        <Text numberOfLines={1} style={[styles.place, { color: onPhoto ? mediaColors.white : colors.text }]}>{place}</Text>
        <View style={styles.ageRow}>
          <Text numberOfLines={1} style={[styles.age, { color: onPhoto ? mediaColors.white : colors.textSecondary }]}>{age}</Text>
          {tile.anonymous ? <EyeOff color={onPhoto ? mediaColors.white : colors.textSecondary} size={12} /> : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

export const SignalTile = memo(SignalTileBase);

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.surfaceElevated, borderRadius: radii.sm, overflow: 'hidden' },
  expired: { opacity: 0.55 },
  scrim: { bottom: 0, height: '55%', left: 0, position: 'absolute', right: 0 },
  plain: { alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.lg },
  pillBack: { backgroundColor: colors.background, borderRadius: radii.pill, left: spacing.xs, position: 'absolute', top: spacing.xs },
  corner: { position: 'absolute', right: 6, top: 7 },
  caption: { bottom: 0, left: 0, paddingBottom: spacing.xs, paddingHorizontal: spacing.xs + 2, position: 'absolute', right: 0 },
  place: { ...typography.label, fontWeight: '700' },
  ageRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  age: { ...typography.micro, flexShrink: 1 },
});
