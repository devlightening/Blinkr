import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DISCOVER_RADIUS_METERS } from '../../discoverFeed';
import { liveA11yLabel, stateLabel } from '../../live/liveLabels';
import { compareByLiveness, isEstimated, liveStateFromCurrent, shouldPulse } from '../../live/liveState';
import { tx } from '../../i18n/tx';
import { colors, liveColors, liveRingSize, spacing, typography } from '../../theme';
import type { BlinkrPlace } from '../../types';
import { usePlacesLive } from '../../usePlacesLive';
import { AnimatedPressable } from '../AnimatedPressable';
import { LiveRing } from '../live/LiveRing';
import { PlaceSymbol } from '../PlaceSymbol';

const MAX_PLACES = 12;
const ITEM = 76;

type Props = {
  /** Place ids of the loaded Yakınımda feed; the strip shows those that have verified live information. */
  placeIds: string[];
  onOpenPlace: (place: BlinkrPlace) => void;
};

/**
 * "Şimdi çevrende": the places around the person that have live state right now, as Canlı Halka avatars. One batched
 * place read (shared hook, refreshed once a minute); with nothing live, or when the read fails, the strip is absent.
 */
function NowAroundStripBase({ placeIds, onOpenPlace }: Props) {
  const ids = useMemo(() => [...new Set(placeIds)].slice(0, MAX_PLACES), [placeIds]);
  const places = usePlacesLive(ids);
  const items = ids
    .map((id) => places[id])
    .filter((place): place is BlinkrPlace => Boolean(place))
    .map((place) => ({ place, state: liveStateFromCurrent(place.currentState, Date.now()) }))
    .filter((item) => item.state.source === 'live')
    .sort(compareByLiveness);
  if (items.length === 0) return null;

  return (
    <View testID="now-around">
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>{tx('feed:discover.nowAround', 'Şimdi çevrende')}</Text>
        <Text style={styles.hint}>{tx('feed:discover.nowAroundHint', '{{km}} km · en tazesi önce', { km: DISCOVER_RADIUS_METERS / 1000 })}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.row} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {items.map(({ place, state }) => (
          <AnimatedPressable
            accessibilityHint={tx('feed:discover.nowAroundA11y', 'Haritada gösterir')}
            accessibilityLabel={liveA11yLabel(place.name, state)}
            accessibilityRole="button"
            key={place.id}
            onPress={() => onOpenPlace(place)}
            pressScale={0.94}
            style={styles.item}
            testID={`now-around-${place.id}`}
          >
            <View style={styles.ringRoom}>
              <LiveRing estimated={isEstimated(state)} freshness={state.freshness} kind={state.kind} pulse={shouldPulse(state)} size={liveRingSize.tray}>
                <PlaceSymbol category={place.category} color={liveColors[state.kind]} size={22} />
              </LiveRing>
            </View>
            <Text numberOfLines={1} style={styles.name}>{place.name}</Text>
            <Text numberOfLines={1} style={[styles.state, { color: liveColors[state.kind] }]}>{stateLabel(state)}</Text>
          </AnimatedPressable>
        ))}
      </ScrollView>
    </View>
  );
}

export const NowAroundStrip = memo(NowAroundStripBase);

const styles = StyleSheet.create({
  head: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
  title: { ...typography.heading, color: colors.text },
  hint: { ...typography.caption, color: colors.textSecondary },
  scroll: { flexGrow: 0, marginHorizontal: -spacing.lg },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  item: { alignItems: 'center', gap: 2, width: ITEM },
  ringRoom: { padding: 6 },
  name: { ...typography.caption, color: colors.text, maxWidth: ITEM },
  state: { ...typography.micro, fontWeight: '700', maxWidth: ITEM },
});
