import { StyleSheet, Text, View } from 'react-native';
import { Radio } from 'lucide-react-native';

import { placeCard } from '../../placeShare';
import { categoryTone, colors, radii, spacing, typography } from '../../theme';
import type { BlinkrPlace, PlaceShare } from '../../types';
import { PlaceSymbol } from '../PlaceSymbol';
import { tx } from '../../i18n/tx';

/**
 * Doc B1, the inside of a shared-place bubble: the place, and how it is doing right now. "Orası nasıl?" answered in the
 * chat itself. The live line appears only for verified, fresh activity; otherwise it says plainly that there is no
 * current information, never an old state presented as new. The bubble around it (press, long press, swipe to reply)
 * belongs to the conversation.
 */
export function PlaceShareCard({ share, place }: { share: PlaceShare; place?: BlinkrPlace | null }) {
  const card = placeCard(share, place);
  const tone = categoryTone(place?.category ?? share.category);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: `${tone}26` }]}>
          <PlaceSymbol category={place?.category ?? share.category} color={tone} size={20} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>{card.name}</Text>
          <Text numberOfLines={1} style={styles.category}>{card.category}</Text>
        </View>
      </View>
      {card.liveLine ? (
        <View style={styles.live}>
          <Radio color={colors.primary} size={13} />
          <Text numberOfLines={2} style={styles.liveText}>{tx('chat:place.live', 'Şu an · {{live}}', { live: card.liveLine })}</Text>
        </View>
      ) : (
        <Text style={styles.quiet}>{card.known ? tx('chat:place.noLive', 'Güncel bilgi yok') : tx('chat:place.loading', 'Durumu yükleniyor…')}</Text>
      )}
      <Text style={styles.open}>{tx('chat:place.open', 'Haritada aç')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, minWidth: 220 },
  head: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  tile: { alignItems: 'center', borderRadius: radii.sm, height: 40, justifyContent: 'center', width: 40 },
  copy: { flexShrink: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  category: { ...typography.caption, color: colors.textSecondary },
  live: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  liveText: { ...typography.label, color: colors.primary, flexShrink: 1 },
  quiet: { ...typography.caption, color: colors.textSecondary },
  open: { ...typography.label, color: colors.primary },
});
