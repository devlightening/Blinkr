import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { listStoryTray } from '../../api';
import { trayRing, type StoryTrayItem } from '../../stories';
import { colors, radii, spacing, typography } from '../../theme';
import type { AuthResponse } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { Avatar } from '../Avatar';

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
            <View style={[styles.ring, ring === 'unseen' && styles.ringUnseen, ring === 'seen' && styles.ringSeen]}>
              <Avatar avatarKey={item.isMine ? auth.avatarKey : undefined} seed={item.authorId} size={54} />
              {item.isMine && ring === 'add' ? <View style={styles.plus}><Plus color={colors.ink} size={14} strokeWidth={3} /></View> : null}
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
  item: { alignItems: 'center', gap: 4, width: 66 },
  ring: { alignItems: 'center', borderColor: 'transparent', borderRadius: radii.pill, borderWidth: 2.5, height: 64, justifyContent: 'center', width: 64 },
  ringUnseen: { borderColor: colors.primary },
  ringSeen: { borderColor: colors.border },
  plus: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.background, borderRadius: radii.pill, borderWidth: 2, bottom: 0, height: 22, justifyContent: 'center', position: 'absolute', right: 0, width: 22 },
  name: { ...typography.micro, color: colors.textSecondary, maxWidth: 66 },
  nameUnseen: { color: colors.text },
});
