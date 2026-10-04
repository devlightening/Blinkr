import { ChevronDown, ChevronUp, List } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { tx } from '../../i18n/tx';
import type { LiveState } from '../../live/liveState';
import { formatCategory, formatDistance } from '../../presentation';
import { colors, radii, shadowFloat, spacing, typography } from '../../theme';
import type { BlinkrPlace } from '../../types';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceStatusCard } from './PlaceStatusCard';

export type NearbyNowItem = { place: BlinkrPlace; state: LiveState; distanceMeters: number | null };

const CARD_WIDTH = 288;

/**
 * "Yakınında şu an" (v4 brief §3.1): a low panel over the map with the places that have live information in view,
 * fresh first, then nearest (the caller sorts). It folds down to its header so the map stays usable.
 */
export const NearbyNowSheet = memo(function NearbyNowSheet({ items, areaName, bottom, onOpen, onShowList, onHeight }: {
  items: NearbyNowItem[]; bottom: number; onOpen: (place: BlinkrPlace) => void; onShowList?: () => void;
  /** Short catalogue address (for example "Fatih, Osmaniye"); exact device coordinates are never shown. */
  areaName?: string | null;
  /** Toasts and the share chip sit above the panel. */
  onHeight?: (height: number) => void;
}) {
  const [folded, setFolded] = useState(false);
  const renderItem = useCallback(({ item }: { item: NearbyNowItem }) => (
    <View style={styles.cardSlot}>
      <PlaceStatusCard
        category={item.place.category} meta={[formatCategory(item.place.category), formatDistance(item.distanceMeters)].filter(Boolean).join(' · ')}
        name={item.place.name} onPress={() => onOpen(item.place)} state={item.state} trailing={null}
      />
    </View>
  ), [onOpen]);
  return (
    <View onLayout={(e) => onHeight?.(Math.round(e.nativeEvent.layout.height))} pointerEvents="box-none" style={[styles.panel, { bottom }]}>
      <View style={styles.header}>
        <AnimatedPressable
          accessibilityLabel={folded ? tx('map:now.expand', 'Yakınındaki canlı yerleri göster') : tx('map:now.fold', 'Yakınındaki canlı yerleri gizle')}
          accessibilityRole="button" accessibilityState={{ expanded: !folded }} onPress={() => setFolded((v) => !v)} pressScale={0.98} style={styles.titleButton}
        >
          <View style={styles.titleText}>
            <Text numberOfLines={1} style={styles.title}>{tx('live:nearbyNow', 'Yakınında şu an')}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {areaName
                ? tx('live:nearbyAreaCount', '{{area}} · {{n}} yer canlı', { area: areaName, n: items.length })
                : tx('live:nearbyCount', '{{n}} yer canlı', { n: items.length })}
            </Text>
          </View>
          {folded ? <ChevronUp color={colors.textSecondary} size={20} /> : <ChevronDown color={colors.textSecondary} size={20} />}
        </AnimatedPressable>
        {onShowList ? (
          <AnimatedPressable accessibilityLabel={tx('map:a11y.showList', 'Liste olarak göster')} accessibilityRole="button" onPress={onShowList} pressScale={0.95} style={styles.listButton}>
            <List color={colors.text} size={16} />
            <Text style={styles.listText}>{tx('map:now.list', 'Liste')}</Text>
          </AnimatedPressable>
        ) : null}
      </View>
      {folded ? null : (
        <FlatList
          contentContainerStyle={styles.row} data={items} horizontal initialNumToRender={3} keyExtractor={(item) => item.place.id}
          renderItem={renderItem} showsHorizontalScrollIndicator={false} snapToInterval={CARD_WIDTH + spacing.sm} decelerationRate="fast"
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.background, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, left: 0, paddingBottom: spacing.md,
    paddingTop: spacing.md, position: 'absolute', right: 0, ...shadowFloat,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  titleButton: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  titleText: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  listButton: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: spacing.md },
  listText: { ...typography.callout, color: colors.text, fontWeight: '700' },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  cardSlot: { width: CARD_WIDTH },
});
