import { EyeOff, Images, Play } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { toAbsoluteUrl } from '../api';
import { signalLabels } from '../presentation';
import { signalValueLabel } from '../productPresentation';
import { gridTile } from '../profileGrid';
import { colors, mediaColors, radii, signalColors, typography } from '../theme';
import type { AuthoredPost } from '../types';
import { SignalSymbol } from './SignalSymbol';
import { tx } from '../i18n/tx';

/** One square of the profile grid (P6.3): the photo, or a tinted square with the type; expired ones are dimmed. */
export function SignalGridTile({ post, size }: { post: AuthoredPost; size: number }) {
  const tile = gridTile(post);
  const tone = signalColors[post.signalType] ?? colors.mint;
  const value = signalValueLabel(post.signalType, post.signalValue);
  const url = tile.photoUrl ? toAbsoluteUrl(tile.photoUrl) : null;
  const label = `${signalLabels[post.signalType] ?? tx('profile:grid.signal', 'Sinyal')}${value ? `, ${value}` : ''}${tile.video ? tx('profile:grid.videoSuffix', ', video') : ''}${tile.anonymous ? tx('profile:grid.anon', ', anonim') : ''}${tile.expired ? tx('profile:grid.expired', ', sona erdi') : ''}`;
  return (
    <View accessibilityLabel={label} style={[styles.tile, { height: size, width: size }, tile.expired && styles.expired]} testID={`grid-tile-${post.id}`}>
      {url ? (
        <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: url }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.textTile, { backgroundColor: `${tone}26` }]}>
          <SignalSymbol color={tone} size={Math.round(size * 0.26)} type={post.signalType} />
          {value ? <Text numberOfLines={1} style={[styles.value, { color: tone }]}>{value}</Text> : null}
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: colors.background }]}>
        <SignalSymbol color={tone} size={12} type={post.signalType} />
      </View>
      {tile.video ? <View accessibilityLabel={tx('profile:grid.video', 'video')} style={styles.corner} testID={`grid-video-${post.id}`}><Play color={mediaColors.white} fill={mediaColors.white} size={14} /></View>
        : tile.extraPhotos > 0 ? <View style={styles.corner}><Images color={colors.text} size={14} /></View> : null}
      {tile.anonymous ? <View style={[styles.corner, styles.cornerLow]}><EyeOff color={colors.text} size={14} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.surfaceElevated, borderRadius: radii.sm, overflow: 'hidden' },
  expired: { opacity: 0.45 },
  textTile: { alignItems: 'center', gap: 4, justifyContent: 'center', padding: 6 },
  value: { ...typography.micro, textAlign: 'center' },
  badge: { alignItems: 'center', borderRadius: radii.pill, height: 22, justifyContent: 'center', left: 4, opacity: 0.9, position: 'absolute', top: 4, width: 22 },
  corner: { position: 'absolute', right: 5, top: 5 },
  cornerLow: { bottom: 5, top: undefined },
});
