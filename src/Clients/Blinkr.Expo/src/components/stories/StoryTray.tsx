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
};

/**
 * Story tray (sinyal-mvp-plan P7.6): my story first (or "+"), then the people I follow with a bright ring for unseen
 * stories and a quiet one for watched. When stories cannot be loaded the tray simply stays out of the way.
 */
export function StoryTray({ auth, refresh = {}, reloadKey = 0, onOpen, onAdd }: Props) {
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

  if (items === null) return null;
  const mine = items.find((item) => item.isMine) ?? { authorId: auth.userId, authorName: auth.userName, isMine: true, storyCount: 0, latestAtUtc: '', allSeen: true };
  const others = items.filter((item) => !item.isMine);
  const ordered = [mine, ...others];

  return (
    <ScrollView accessibilityLabel={t('stories.trayLabel')} contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} testID="story-tray">
      {ordered.map((item) => {
        const ring = trayRing(item);
        const label = item.isMine ? (ring === 'add' ? t('stories.add') : t('stories.yours')) : ring === 'unseen' ? t('stories.unseen', { name: item.authorName }) : t('stories.seen', { name: item.authorName });
        return (
          <AnimatedPressable
            accessibilityLabel={label}
            accessibilityRole="button"
            key={item.authorId}
            onPress={() => (ring === 'add' ? onAdd() : onOpen(item, ordered.filter((x) => x.storyCount > 0)))}
            onLongPress={item.isMine && ring !== 'add' ? onAdd : undefined}
            pressScale={0.94}
            style={styles.item}
          >
            {/* Instagram: brand-gradient ring for unseen, flat grey for watched, none + a gradient "+" for adding. */}
            <View>
              <GradientRing hidden={ring === 'add'} seen={ring === 'seen'} size={68} testID={`story-ring-${ring}`} thickness={2.5}>
                <Avatar avatarKey={item.isMine ? auth.avatarKey : undefined} seed={item.authorId} size={58} />
              </GradientRing>
              {item.isMine && ring === 'add' ? (
                <View style={styles.plus}>
                  <LinearGradient colors={gradients.brand} end={gradientDirection.end} start={gradientDirection.start} style={styles.plusFill} />
                  <View style={styles.plusIcon}><Plus color={colors.white} size={13} strokeWidth={3} /></View>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.name, ring === 'unseen' && styles.nameUnseen]}>{item.isMine ? t('stories.yours') : item.authorName}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  item: { alignItems: 'center', gap: 5, width: 72 },
  plus: { alignItems: 'center', borderColor: colors.background, borderRadius: radii.pill, borderWidth: 2.5, bottom: 0, height: 24, justifyContent: 'center', overflow: 'hidden', position: 'absolute', right: 0, width: 24 },
  plusFill: { borderRadius: radii.pill, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  plusIcon: { zIndex: 1 },
  name: { ...typography.caption, color: colors.textSecondary, maxWidth: 72 },
  nameUnseen: { color: colors.text },
});
