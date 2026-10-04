import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { placeCard, placeCardLabel } from '../../placeShare';
import { colors } from '../../theme';
import type { BlinkrPlace, PlaceShare } from '../../types';
import { PlaceStatusCard } from '../live/PlaceStatusCard';
import { tx } from '../../i18n/tx';

/**
 * Doc B1, the inside of a shared-place bubble: the place with its Canlı Halka, how it is doing right now and how old
 * that is. Without verified, fresh information the ring is empty and says plainly there is no current information,
 * never an old state presented as new. The bubble around it (press, long press, swipe to reply) belongs to the
 * conversation, so the card itself is not pressable.
 */
export function PlaceShareCard({ share, place }: { share: PlaceShare; place?: BlinkrPlace | null }) {
  const card = useMemo(() => placeCard(share, place), [share, place]);
  return (
    <View style={styles.wrap}>
      <PlaceStatusCard
        accessibilityLabel={placeCardLabel(card)}
        category={place?.category ?? share.category}
        centerColor={colors.surface}
        flat
        meta={card.category}
        name={card.name}
        noInfoLabel={card.known ? tx('chat:place.noLive', 'Güncel bilgi yok') : tx('chat:place.loading', 'Durumu yükleniyor…')}
        state={card.state}
        trailing={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { minWidth: 240 } });
