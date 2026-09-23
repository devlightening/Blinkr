import { EyeOff, Image as ImageIcon, MapPin, Radio } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { freshnessLabelKey, freshnessTier } from '../freshness';
import { formatAge, meaningfulTitle, signalLabels } from '../presentation';
import { signalValueLabel } from '../productPresentation';
import { colors, radii, signalColors, spacing, typography } from '../theme';
import type { AuthoredPost } from '../types';
import { SignalSymbol } from './SignalSymbol';

/** One published signal as a compact row: what, how it was tagged, where, and whether it is still live. */
export function PostRow({ post }: { post: AuthoredPost }) {
  const tone = signalColors[post.signalType] ?? colors.mint;
  const { t } = useTranslation('common');
  // The shared freshness rule (plan-devam A8). The profile list does not carry the server trust, so it never says "Canlı".
  const freshness = freshnessTier(post.createdAtUtc, post.expiresAt);
  const anonymous = post.identityDisclosure === 'AnonymousMap';
  const value = signalValueLabel(post.signalType, post.signalValue);
  const title = meaningfulTitle(post.title, signalLabels[post.signalType]);
  return (
    <View style={styles.post}>
      <View style={styles.postIcon}><SignalSymbol color={tone} size={18} type={post.signalType} /></View>
      <View style={styles.postBody}>
        <View style={styles.postTop}>
          {title ? <Text numberOfLines={1} style={styles.postTitle}>{title}</Text> : <View style={styles.flex} />}
          <Text style={styles.postAge}>{formatAge(post.createdAtUtc)}</Text>
        </View>
        {post.content ? <Text numberOfLines={2} style={styles.postText}>{post.content}</Text> : null}
        <View style={styles.postMeta}>
          <Text style={[styles.chip, { backgroundColor: `${tone}24`, color: tone }]}>{signalLabels[post.signalType] ?? 'Sinyal'}{value ? ` · ${value}` : ''}</Text>
          {anonymous ? <View style={styles.chipRow}><EyeOff color={colors.textSecondary} size={12} /><Text style={styles.chipMuted}>Anonim</Text></View> : null}
          {post.mediaUrls?.length ? <View style={styles.chipRow}><ImageIcon color={colors.textSecondary} size={12} /><Text style={styles.chipMuted}>{post.mediaUrls.length}</Text></View> : null}
          {post.locationName ? <View style={styles.chipRow}><MapPin color={colors.textSecondary} size={12} /><Text numberOfLines={1} style={[styles.chipMuted, styles.place]}>{post.locationName}</Text></View> : null}
          {freshness === 'live'
            ? <View style={styles.chipRow}><Radio color={colors.primary} size={12} /><Text style={styles.chipLive}>{t(freshnessLabelKey(freshness, false))}</Text></View>
            : <Text style={styles.chipMuted}>{t(freshnessLabelKey(freshness, false))}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  postIcon: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.sm + 2, height: 36, justifyContent: 'center', width: 36 },
  postBody: { flex: 1, gap: 3 },
  postTop: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  postTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  flex: { flex: 1 },
  postAge: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  postText: { ...typography.caption, color: colors.textSecondary },
  postMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  chip: { ...typography.label, borderRadius: radii.sm, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  chipRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  chipMuted: { ...typography.label, color: colors.textSecondary, fontWeight: '400' },
  chipLive: { ...typography.label, color: colors.primary },
  place: { maxWidth: 140 },
});
