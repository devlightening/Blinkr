import { Clock3, Heart, MapPin, MessageCircle, ShieldCheck, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '../theme';
import type { BlinkrPost } from '../types';

type Props = { onClose: () => void; post: BlinkrPost | null };

const formatAge = (post: BlinkrPost) => {
  if (post.freshnessSec != null) {
    if (post.freshnessSec < 60) return 'Az önce';
    if (post.freshnessSec < 3600) return `${Math.round(post.freshnessSec / 60)} dk önce`;
    return `${Math.round(post.freshnessSec / 3600)} sa önce`;
  }

  if (!post.createdAtUtc) return 'Şimdi';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(post.createdAtUtc).getTime()) / 60_000));
  return minutes < 60 ? `${minutes} dk önce` : `${Math.round(minutes / 60)} sa önce`;
};

const signalLabels: Record<string, string> = {
  Crowd: 'DOLULUK',
  Queue: 'BEKLEME',
  Event: 'ETKİNLİK',
  Offer: 'FIRSAT',
  NewOpening: 'YENİ AÇILIŞ',
  TemporaryStatus: 'GEÇİCİ DURUM',
  GeneralObservation: 'GÖZLEM',
};

const formatExpiry = (post: BlinkrPost) => {
  if (!post.expiresAt) return '3 saatlik sinyal';
  const remainingMinutes = Math.max(0, Math.round((new Date(post.expiresAt).getTime() - Date.now()) / 60_000));
  if (remainingMinutes < 60) return `${remainingMinutes} dk daha yayında`;
  if (remainingMinutes < 1440) return `${Math.round(remainingMinutes / 60)} sa daha yayında`;
  return `${Math.round(remainingMinutes / 1440)} gün daha yayında`;
};

export function PostDetailSheet({ onClose, post }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(post)}>
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.scrim} />
        {post && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.placeIcon}>
                <MapPin color={colors.greenDark} fill={colors.lime} size={22} />
              </View>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={styles.placeName}>
                  {post.locationName || 'Yakındaki bir yer'}
                </Text>
                <Text style={styles.placeContext}>Yakın çevre sinyali</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" hitSlop={10} onPress={onClose} style={styles.close}>
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>

            <View style={styles.freshRow}>
              <View style={styles.freshBadge}><Text style={styles.freshText}>{signalLabels[post.signalType ?? 'GeneralObservation']}</Text></View>
              <Clock3 color={colors.muted} size={15} />
              <Text style={styles.age}>{formatAge(post)}</Text>
            </View>

            <Text style={styles.title}>{post.title || 'Yeni bir yer sinyali'}</Text>
            <Text style={styles.content}>{post.content || 'Bu sinyal için açıklama bulunmuyor.'}</Text>

            <View style={styles.trustRow}>
              <ShieldCheck color={colors.greenDark} size={17} />
              <View style={styles.trustCopy}>
                <Text style={styles.trustTitle}>{post.sourceType === 'VerifiedBusiness' ? 'Doğrulanmış kaynak' : 'Topluluk kaynağı'}</Text>
                <Text style={styles.trustText}>Yaklaşık alan · {formatExpiry(post)}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text numberOfLines={1} style={styles.author}>{post.authorName || 'Blinkr kullanıcısı'}</Text>
              <View style={styles.stats}>
                <Heart color={colors.muted} size={17} />
                <Text style={styles.statText}>{post.likeCount ?? 0}</Text>
                <MessageCircle color={colors.muted} size={17} />
                <Text style={styles.statText}>{post.commentCount ?? 0}</Text>
              </View>
            </View>

          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    backgroundColor: 'rgba(16,28,20,0.2)', bottom: 0, left: 0,
    position: 'absolute', right: 0, top: 0,
  },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8,
    paddingHorizontal: 20, paddingTop: 10, ...shadow,
  },
  handle: {
    alignSelf: 'center', backgroundColor: colors.line, borderRadius: 2, height: 4,
    marginBottom: 18, width: 38,
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  placeIcon: {
    alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8,
    height: 44, justifyContent: 'center', width: 44,
  },
  headerText: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  placeContext: { color: colors.muted, fontSize: 11, marginTop: 3 },
  close: {
    alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8,
    height: 40, justifyContent: 'center', width: 40,
  },
  freshRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 20 },
  freshBadge: { backgroundColor: colors.lime, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  freshText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  age: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900', lineHeight: 27, marginTop: 13 },
  content: { color: '#465049', fontSize: 15, lineHeight: 23, marginTop: 9 },
  trustRow: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 8, flexDirection: 'row', gap: 9, marginTop: 18, padding: 11 },
  trustCopy: { flex: 1 },
  trustTitle: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  trustText: { color: colors.greenDark, fontSize: 10, marginTop: 2 },
  footer: {
    alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1,
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 14,
  },
  author: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '800' },
  stats: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  statText: { color: colors.muted, fontSize: 12, fontWeight: '800', marginRight: 5 },
});
