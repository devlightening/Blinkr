import { ImageOff, Play } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageResizeMode, type StyleProp, type ImageStyle } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type Props = {
  /** Absolute image url; null when there is nothing to draw (e.g. a video without a thumbnail). */
  uri: string | null;
  /** A video whose frame cannot be drawn as an image: shows a play tile instead of an empty box. */
  video?: boolean;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
};

/**
 * A signal photo that never ends up as an empty grey box (plan-devam A6): a video without a thumbnail shows a play
 * tile, and an image that fails to load shows a calm "could not load" placeholder in the same space.
 */
export function MediaImage({ uri, video = false, style, resizeMode = 'cover', accessibilityLabel }: Props) {
  const { t } = useTranslation('common');
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={[style as object, styles.placeholder]} testID="media-placeholder">
        {video && !failed ? <Play color={colors.textSecondary} fill={colors.textSecondary} size={28} /> : <ImageOff color={colors.textSecondary} size={24} />}
        {failed ? <Text style={styles.text}>{t('media.loadFailed')}</Text> : null}
      </View>
    );
  }
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailed(true)}
      resizeMode={resizeMode}
      source={{ uri }}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', backgroundColor: colors.surfaceElevated, gap: spacing.xs, justifyContent: 'center' },
  text: { ...typography.caption, color: colors.textSecondary },
});
