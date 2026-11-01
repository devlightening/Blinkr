import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { listStoryTray } from '../../api';
import { trayRing, type StoryTrayItem } from '../../stories';
import { colors, gradientDirection, gradients, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';
import { GradientRing } from '../ui/GradientRing';

type Props = {
  auth: AuthResponse;
  refresh?: { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };
  /** Changes whenever the tray should load again (after posting, after watching). */
  reloadKey?: number;
  onOpen: (item: StoryTrayItem, all: StoryTrayItem[]) => void;
  onAdd: () => void;
  /** `mine` renders only the reusable "Hikayen" item so another horizontal tray can own scrolling. */
  mode?: 'all' | 'mine';
};

/** Instagram-sized ring (a 68 pt ring read as a secondary feature). */
const RING = 78;
const ITEM = 84;

/**
 * Story tray (sinyal-mvp-plan P7.6): my story first (or "+"), then the people I follow with a bright ring for unseen
 * stories and a quiet one for watched. While loading it holds its place with soft rings so the feed below does not
 * jump; when stories cannot be loaded the tray simply stays out of the way.
 */
export function StoryTray({ auth, refresh = {}, reloadKey = 0, onOpen, onAdd, mode = 'all' }: Props) {
  const { t } = useTranslation('feed');
  const [items, setItems] = useState<StoryTrayItem[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listStoryTray(auth, controller.signal, refresh)
      .then((list) => { if (!controller.signal.aborted) setItems(list); })
      .catch(() => { if (!controller.signal.aborted) setItems((current) => current ?? []); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, auth.token, reloadKey]);

  if (items === null) {
    if (mode === 'mine') {
      return (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.item} testID="story-mine-loading">
          <View style={styles.placeholderRing} />
          <View style={styles.placeholderName} />
        </View>
      );
    }
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.row, styles.placeholderRow]} testID="story-tray-loading">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.item}>
            <View style={styles.placeholderRing} />
            <View style={styles.placeholderName} />
          </View>
        ))}
      </View>
    );
  }
  const mine = items.find((item) => item.isMine) ?? { authorId: auth.userId, authorName: auth.userName, isMine: true, storyCount: 0, latestAtUtc: '', allSeen: true };
  const others = items.filter((item) => !item.isMine);
  const ordered = [mine, ...others];

  const renderItem = (item: StoryTrayItem) => {
    const ring = trayRing(item);
    const label = item.isMine ? (ring === 'add' ? t('stories.add') : t('stories.yours')) : ring === 'unseen' ? t('stories.unseen', { name: item.authorName }) : t('stories.seen', { name: item.authorName });
    return (
      <AnimatedPressable
        accessibilityLabel={label}
        accessibilityRole="button"
        key={item.authorId}
        onPress={() => (ring === 'add' ? onAdd() : onOpen(item, ordered.filter((x) => x.storyCount > 0)))}
        pressScale={0.94}
        style={styles.item}
      >
        <View>
          <GradientRing hidden={ring === 'add'} seen={ring === 'seen'} size={RING} testID={`story-ring-${ring}`} thickness={3}>
            <Avatar avatarKey={item.isMine ? auth.avatarKey : undefined} seed={item.authorId} userId={item.authorId} size={RING - 12} />
          </GradientRing>
          {item.isMine && ring === 'add' ? (
            <View style={styles.plus}>
              <LinearGradient colors={gradients.brand} end={gradientDirection.end} start={gradientDirection.start} style={styles.plusFill} />
              <View style={styles.plusIcon}><Plus color={colors.white} size={14} strokeWidth={3} /></View>
            </View>
          ) : item.isMine ? (
            <AnimatedPressable accessibilityLabel={t('stories.add')} accessibilityRole="button" hitSlop={8} onPress={onAdd} pressScale={0.9} style={styles.plus} testID="story-add">
              <LinearGradient colors={gradients.brand} end={gradientDirection.end} start={gradientDirection.start} style={styles.plusFill} />
              <View style={styles.plusIcon}><Plus color={colors.white} size={14} strokeWidth={3} /></View>
            </AnimatedPressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.name, ring === 'unseen' && styles.nameUnseen]}>{item.isMine ? t('stories.yours') : item.authorName}</Text>
      </AnimatedPressable>
    );
  };

  if (mode === 'mine') return renderItem(mine);

  return (
    <ScrollView accessibilityLabel={t('stories.trayLabel')} contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} testID="story-tray">
      {ordered.map(renderItem)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  placeholderRow: { flexDirection: 'row', overflow: 'hidden' },
  placeholderRing: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: RING, width: RING },
  placeholderName: { backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 10, width: 48 },
  item: { alignItems: 'center', gap: 6, width: ITEM },
  plus: { alignItems: 'center', borderColor: colors.background, borderRadius: radii.pill, borderWidth: 2.5, bottom: 0, height: 26, justifyContent: 'center', overflow: 'hidden', position: 'absolute', right: 0, width: 26 },
  plusFill: { borderRadius: radii.pill, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  plusIcon: { zIndex: 1 },
  name: { ...typography.caption, color: colors.textSecondary, maxWidth: ITEM },
  nameUnseen: { color: colors.text },
});
