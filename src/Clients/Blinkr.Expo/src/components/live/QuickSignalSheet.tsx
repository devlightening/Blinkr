import * as ImagePicker from 'expo-image-picker';
import {
  Camera, DoorOpen, Eye, Flame, Hourglass, Image as ImageIcon, MapPin, Send, ShieldCheck, Sparkles, Tag, Users, X, type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { capturedAtOf } from '../../galleryCapture';
import i18n from 'i18next';
import { tx } from '../../i18n/tx';
import type { LiveKind, LiveState } from '../../live/liveState';
import {
  NOTE_MAX, NOTE_REQUIRED, QUICK_TILES, TILE_TYPE, TILE_VALUES, canSubmit, initialQuick, quickReducer, type QuickDisclosure, type QuickState, type QuickTile,
} from '../../live/quickSignal';
import { mediaAllowedAt } from '../../placeSafety';
import { formatDistance } from '../../presentation';
import { friendlyError } from '../../productPresentation';
import { SIGNAL_TTL_MINUTES, formatLifetime } from '../../signalCatalog';
import { colors, liveColors, liveRingSize, liveTones, radii, spacing, typography, withAlpha } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceSymbol } from '../PlaceSymbol';
import { BlinkrButton } from '../ui/BlinkrButton';
import { SegmentedControl } from '../ui/BlinkrSegmentedControl';
import { LiveRing } from './LiveRing';

export type QuickMedia = { uri: string; kind: 'image' | 'video'; mimeType?: string | null; fileName?: string | null; capturedAt: Date | null };

const TILES: Record<QuickTile, { Icon: LucideIcon; label: () => string }> = {
  Open: { Icon: DoorOpen, label: () => tx('quick:kindOpen', 'Açık / Kapalı') },
  Crowd: { Icon: Users, label: () => tx('quick:kindCrowd', 'Doluluk') },
  Queue: { Icon: Hourglass, label: () => tx('quick:kindQueue', 'Bekleme') },
  Event: { Icon: Sparkles, label: () => tx('quick:kindEvent', 'Etkinlik') },
  Offer: { Icon: Tag, label: () => tx('quick:kindOffer', 'Fırsat') },
  Temp: { Icon: Flame, label: () => tx('quick:kindTemp', 'Geçici durum') },
  NewOpening: { Icon: MapPin, label: () => tx('quick:kindNew', 'Yeni açılış') },
  Observation: { Icon: Eye, label: () => tx('quick:kindObs', 'Gözlem') },
};

const VALUES: Record<string, { kind: LiveKind; label: () => string }> = {
  Open: { kind: 'info', label: () => tx('quick:vOpen', 'Açık') },
  Closed: { kind: 'closed', label: () => tx('quick:vClosed', 'Kapalı') },
  Calm: { kind: 'calm', label: () => tx('quick:vCalm', 'Sakin') },
  Moderate: { kind: 'busy', label: () => tx('quick:vModerate', 'Hareketli') },
  Busy: { kind: 'crowded', label: () => tx('quick:vBusy', 'Kalabalık') },
  None: { kind: 'calm', label: () => tx('quick:vNone', 'Sıra yok') },
  '5To15': { kind: 'busy', label: () => tx('quick:v5To15', '5–15 dk') },
  Over15: { kind: 'crowded', label: () => tx('quick:vOver15', '15 dk+') },
};

type Props = {
  /** The place the signal goes to: found from the position (within 100 m) or chosen. Null while locating or when none is near. */
  place: { name: string; category?: string | null; distanceMeters?: number | null; state: LiveState } | null;
  locating: boolean;
  /** Start on a tile and value ("Hâlâ böyle" / "Değişti"). */
  initial?: QuickState | null;
  submitting: boolean;
  error?: string | null;
  onChangePlace: (state: QuickState) => void;
  onClose: () => void;
  onSubmit: (state: QuickState, media: QuickMedia[]) => void;
};

/**
 * Yeni sinyal in two taps (v4 brief §3.4): what is happening → how it is → Paylaş. The place comes from the position;
 * a note or photo is optional except where the type needs words. Content only - the caller owns the sheet shell, the
 * position, the place and the publishing (share outbox).
 */
export function QuickSignalSheet({ place, locating, initial, submitting, error, onChangePlace, onClose, onSubmit }: Props) {
  const [state, dispatch] = useReducer(quickReducer, initial ?? initialQuick);
  const [media, setMedia] = useState<QuickMedia[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  useEffect(() => { dispatch({ t: 'setMediaCount', count: media.length }); }, [media.length]);

  const values = state.tile ? TILE_VALUES[state.tile] : [];
  const noteRequired = !!state.tile && (NOTE_REQUIRED.has(state.tile) || (state.tile === 'Observation' && media.length === 0));
  const canAttach = mediaAllowedAt(place?.category);
  const ready = canSubmit(state) && !!place && !submitting;
  const valueLabel = state.value ? VALUES[state.value]?.label() : null;
  const cta = !canSubmit(state) ? tx('quick:ctaIdle', 'Bir durum seç')
    : valueLabel ? tx('quick:ctaShareValue', 'Paylaş · {{v}}', { v: valueLabel }) : tx('quick:ctaShare', 'Paylaş');
  const lifetime = useMemo(() => {
    if (!state.tile) return null;
    const minutes = SIGNAL_TTL_MINUTES[TILE_TYPE[state.tile]];
    return tx('quick:lifetime', 'Haritada {{t}} kalır', { t: formatLifetime(minutes, i18n.language === 'en' ? 'en' : 'tr') });
  }, [state.tile]);

  const addMedia = async (source: 'camera' | 'library') => {
    setMediaError(null);
    try {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setMediaError(tx(source === 'camera' ? 'create:media.cameraPermission' : 'create:media.libraryPermission', 'Bu izin olmadan medya eklenemez.'));
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 0.84 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 0.84, exif: true });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      setMedia((current) => (current.length >= 4 ? current : [...current, {
        uri: asset.uri, kind: 'image', mimeType: asset.mimeType, fileName: asset.fileName,
        capturedAt: capturedAtOf(asset as { exif?: Record<string, unknown> | null }),
      }]));
    } catch (err) {
      setMediaError(friendlyError(err, tx('create:media.pickFailed', 'Medya eklenemedi.')));
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <AnimatedPressable accessibilityLabel={tx('common:actions.close', 'Kapat')} accessibilityRole="button" hitSlop={8} onPress={onClose} pressScale={0.9} style={styles.close}>
          <X color={colors.text} size={20} />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.title}>{tx('quick:title', 'Yeni sinyal')}</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.placeCard}>
          {place ? (
            <LiveRing estimated={place.state.source === 'hours'} freshness={place.state.freshness} kind={place.state.kind} size={liveRingSize.card}>
              <PlaceSymbol category={place.category} color={place.state.source === 'none' ? colors.textSecondary : liveColors[place.state.kind]} size={20} />
            </LiveRing>
          ) : (
            <View style={styles.placeIcon}>{locating ? <ActivityIndicator color={colors.textSecondary} /> : <MapPin color={colors.textSecondary} size={20} />}</View>
          )}
          <View style={styles.placeText}>
            <Text numberOfLines={1} style={styles.placeName}>{place?.name ?? (locating ? tx('map:composer.locating', 'Konumun alınıyor…') : tx('quick:noPlace', 'Yakınında yer bulunamadı'))}</Text>
            {place?.distanceMeters != null ? (
              <View style={styles.atPlace}>
                <ShieldCheck color={colors.mint} size={14} />
                <Text style={styles.atPlaceText}>{[tx('quick:atPlace', 'Konumda'), formatDistance(place.distanceMeters)].filter(Boolean).join(' · ')}</Text>
              </View>
            ) : null}
          </View>
          <AnimatedPressable accessibilityRole="button" onPress={() => onChangePlace(state)} pressScale={0.95} style={styles.change}>
            <Text style={styles.changeText}>{place ? tx('quick:change', 'Değiştir') : tx('quick:pickPlace', 'Yer seç')}</Text>
          </AnimatedPressable>
        </View>

        <Text style={styles.section}>{tx('quick:q1', 'Ne oluyor?')}</Text>
        <View style={styles.grid}>
          {QUICK_TILES.map((tile) => {
            const on = state.tile === tile;
            const { Icon, label } = TILES[tile];
            return (
              <AnimatedPressable accessibilityLabel={label()} accessibilityRole="button" accessibilityState={{ selected: on }} key={tile}
                onPress={() => dispatch({ t: 'pickTile', tile })} pressScale={0.95} style={[styles.tile, on && styles.tileOn]}>
                <Icon color={on ? colors.mint : colors.textSecondary} size={22} strokeWidth={2} />
                <Text numberOfLines={2} style={[styles.tileText, on && styles.tileTextOn]}>{label()}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {values.length > 0 ? (
          <>
            <Text style={styles.section}>{tx('quick:q2', 'Şu an nasıl?')}</Text>
            <View style={styles.values}>
              {values.map((value) => {
                const on = state.value === value;
                const meta = VALUES[value];
                const color = liveColors[meta.kind];
                return (
                  <AnimatedPressable accessibilityLabel={meta.label()} accessibilityRole="button" accessibilityState={{ selected: on }} key={value}
                    onPress={() => dispatch({ t: 'pickValue', value })} pressScale={0.95}
                    style={[styles.value, on && { backgroundColor: withAlpha(color, liveTones.chipAlpha), borderColor: color }]}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text numberOfLines={2} style={[styles.valueText, on && { color }]}>{meta.label()}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </>
        ) : null}

        {state.tile ? (
          <View style={styles.note}>
            <TextInput
              accessibilityLabel={noteRequired ? tx('quick:noteReq', 'Kısaca yaz (zorunlu)') : tx('quick:noteOpt', 'İstersen kısa not ekle…')}
              maxLength={NOTE_MAX} multiline onChangeText={(note) => dispatch({ t: 'setNote', note })}
              placeholder={noteRequired ? tx('quick:noteReq', 'Kısaca yaz (zorunlu)') : tx('quick:noteOpt', 'İstersen kısa not ekle…')}
              placeholderTextColor={colors.textMuted} style={styles.input} value={state.note}
            />
            {canAttach ? (
              <View style={styles.mediaButtons}>
                {media.length > 0 ? <Text style={styles.mediaCount}>{`${media.length}/4`}</Text> : null}
                <AnimatedPressable accessibilityLabel={tx('quick:camera', 'Kamera')} accessibilityRole="button" hitSlop={8} onPress={() => { void addMedia('camera'); }} pressScale={0.9}>
                  <Camera color={colors.textSecondary} size={22} />
                </AnimatedPressable>
                <AnimatedPressable accessibilityLabel={tx('quick:gallery', 'Galeri')} accessibilityRole="button" hitSlop={8} onPress={() => { void addMedia('library'); }} pressScale={0.9}>
                  <ImageIcon color={colors.textSecondary} size={22} />
                </AnimatedPressable>
              </View>
            ) : null}
          </View>
        ) : null}
        {mediaError ? <Text style={styles.error}>{mediaError}</Text> : null}

        <View style={styles.audience}>
          <View style={styles.audienceText}>
            <Text style={styles.audienceTitle}>{tx('quick:public', 'Herkese açık')}</Text>
            {lifetime ? <Text style={styles.audienceSub}>{lifetime}</Text> : null}
          </View>
          <View style={styles.segment}>
            <SegmentedControl<QuickDisclosure>
              onChange={(d) => dispatch({ t: 'setDisclosure', d })}
              options={[{ value: 'LimitedProfile', label: tx('quick:limited', 'Sınırlı profil') }, { value: 'AnonymousMap', label: tx('quick:anon', 'Anonim') }]}
              value={state.disclosure}
            />
          </View>
        </View>
        <View style={styles.privacy}>
          <ShieldCheck color={colors.mint} size={16} />
          <Text style={styles.privacyText}>{tx('quick:privacy', 'Kesin konumun hiçbir yerde gösterilmez.')}</Text>
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BlinkrButton
        disabled={!ready} icon={<Send color={colors.onCreate} size={18} />} label={cta} loading={submitting}
        onPress={() => { if (ready) onSubmit(state, media); }} size="lg" style={styles.cta} variant="create"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  close: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  spacer: { width: 40 },
  title: { ...typography.title, color: colors.text },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  placeCard: { alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  placeIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, height: liveRingSize.card, justifyContent: 'center', width: liveRingSize.card },
  placeText: { flex: 1, gap: 2 },
  placeName: { ...typography.heading, color: colors.text },
  atPlace: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  atPlaceText: { ...typography.caption, color: colors.mint, fontWeight: '700' },
  change: { backgroundColor: colors.surface, borderRadius: radii.pill, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  changeText: { ...typography.callout, color: colors.text, fontWeight: '700' },
  section: { ...typography.callout, color: colors.textSecondary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceElevated, borderRadius: radii.md, borderWidth: 1.5,
    flexBasis: '22%', flexGrow: 1, gap: 6, justifyContent: 'center', minHeight: 76, paddingHorizontal: 4, paddingVertical: spacing.sm,
  },
  tileOn: { backgroundColor: withAlpha(colors.mint, 0.14), borderColor: colors.mint },
  tileText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', textAlign: 'center' },
  tileTextOn: { color: colors.text },
  values: { flexDirection: 'row', gap: spacing.sm },
  value: {
    alignItems: 'center', backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceElevated, borderRadius: radii.md, borderWidth: 1.5,
    flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 56, paddingHorizontal: spacing.sm,
  },
  dot: { borderRadius: 4, height: 8, width: 8 },
  valueText: { ...typography.bodyStrong, color: colors.text, flexShrink: 1, textAlign: 'center' },
  note: { alignItems: 'flex-start', backgroundColor: colors.surfaceElevated, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  input: { ...typography.body, color: colors.text, flex: 1, minHeight: 44, textAlignVertical: 'top' },
  mediaButtons: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: 10 },
  mediaCount: { ...typography.caption, color: colors.textSecondary },
  audience: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  audienceText: { flex: 1 },
  audienceTitle: { ...typography.heading, color: colors.text },
  audienceSub: { ...typography.caption, color: colors.textSecondary },
  segment: { flex: 1.3 },
  privacy: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  privacyText: { ...typography.callout, color: colors.text, flex: 1 },
  error: { ...typography.callout, color: colors.danger },
  cta: { marginTop: spacing.sm },
});
