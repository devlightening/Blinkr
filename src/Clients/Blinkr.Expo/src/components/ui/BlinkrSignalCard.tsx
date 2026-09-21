import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme';
import type { SignalType } from '../../types';
import { SignalSymbol } from '../SignalSymbol';

type Props = {
  signalType?: SignalType | null;
  /** Accent for the type badge (see `signalColors`). */
  tone: string;
  typeLabel: string;
  ageLabel: string;
  title?: string | null;
  text?: string | null;
  /** Real author name, or "Topluluk üyesi" - never an invented person. */
  authorLabel: string;
  trustLabel?: string;
  /** Pre-rendered media (image/video thumbnails). Omit when the signal has none. */
  media?: ReactNode;
};

/** A single observation. Every field except the type and age is optional and simply hidden when absent. */
export function BlinkrSignalCard({ signalType, tone, typeLabel, ageLabel, title, text, authorLabel, trustLabel, media }: Props) {
  const initial = authorLabel.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <View style={styles.card}>
      <View style={styles.author}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={styles.authorCopy}>
          <Text numberOfLines={1} style={styles.authorName}>{authorLabel}</Text>
          <Text style={styles.meta}>{ageLabel}{trustLabel ? ` · ${trustLabel}` : ''}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.copy}>
          <View style={[styles.badge, { borderColor: tone }]}>
            <SignalSymbol color={tone} size={14} type={signalType} />
            <Text style={[styles.badgeText, { color: tone }]}>{typeLabel}</Text>
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {text ? <Text style={styles.text}>{text}</Text> : null}
        </View>
        {media ? <View style={styles.media}>{media}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  author: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 34, justifyContent: 'center', width: 34 },
  avatarText: { ...typography.bodyStrong, color: colors.text },
  authorCopy: { flex: 1 },
  authorName: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  body: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  copy: { flex: 1, gap: spacing.sm },
  badge: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { ...typography.label, letterSpacing: 0 },
  title: { ...typography.heading, color: colors.text, fontSize: 16, lineHeight: 21 },
  text: { ...typography.body, color: colors.textSecondary },
  media: { borderRadius: radii.md, overflow: 'hidden' },
});
