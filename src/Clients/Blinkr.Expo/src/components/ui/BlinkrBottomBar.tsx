import { Compass, Map as MapIcon, MessageCircle, Plus, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, shadowSoft, sizes, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { useKeyboardVisible } from './useKeyboardVisible';

export type BlinkrTab = 'chat' | 'map' | 'nearby' | 'profile';

type Props = {
  active: BlinkrTab;
  onTab: (tab: BlinkrTab) => void;
  /** Opens the share hub (camera, gallery or a plain signal). */
  onShare: () => void;
  /** Shows the red dot on Sohbet. Only pass true when a real unread message exists. */
  chatUnread?: boolean;
  /** Shows the dot on Profil. Only pass true while a friend request really waits for an answer. */
  profileDot?: boolean;
  shareDisabled?: boolean;
  /** A sheet or the composer owns the screen; two stacked bars are never shown. */
  hidden?: boolean;
};

const tabIcons = { chat: MessageCircle, map: MapIcon, nearby: Compass, profile: UserRound } as const;
// "nearby" still points at the existing Yakında screen for now (sinyal-mvp-plan 00_START_HERE §1: Keşfet
// "şimdilik mevcut 'Yakında' ekranını gösterir"); only the tab's own label has moved to the plan's name.
// Maps to common.json's tab.* keys (P1.4): the first real, end-to-end i18n usage in the app.
const tabLabelKeys: Record<BlinkrTab, string> = { chat: 'tab.chat', map: 'tab.map', nearby: 'tab.explore', profile: 'tab.profile' };

function TabItem({ tab, active, unread, onPress }: { tab: BlinkrTab; active: boolean; unread?: boolean; onPress: () => void }) {
  const { t } = useTranslation('common');
  const label = t(tabLabelKeys[tab]);
  const Icon = tabIcons[tab];
  const color = active ? colors.primary : colors.textSecondary;
  return (
    <AnimatedPressable
      accessibilityLabel={unread ? `${label}, ${tab === 'profile' ? 'bekleyen arkadaş isteği var' : 'okunmamış mesaj var'}` : label}
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      pressScale={0.96}
      style={styles.item}
    >
      <View style={[styles.iconTile, active && styles.iconTileActive]}>
        <Icon color={color} size={22} strokeWidth={active ? 2.3 : 2} />
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/**
 * The one bottom navigation for the whole app: Harita | Keşfet | Paylaş | Sohbet | Profil.
 * Paylaş is an action, not a tab - it never shows as "selected".
 */
export function BlinkrBottomBar({ active, onTab, onShare, chatUnread = false, profileDot = false, shareDisabled = false, hidden = false }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  if (keyboardVisible || hidden) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.sm) }]}>
      {/* Sıra sinyal-mvp-plan 02_INFORMATION_ARCHITECTURE §1: Harita · Keşfet · (+) · Sohbet · Profil. */}
      <View accessibilityRole="tablist" style={styles.bar}>
        <TabItem active={active === 'map'} onPress={() => onTab('map')} tab="map" />
        <TabItem active={active === 'nearby'} onPress={() => onTab('nearby')} tab="nearby" />
        <View style={styles.cameraSlot}>
          <AnimatedPressable
            accessibilityLabel="Yeni sinyal paylaş"
            accessibilityRole="button"
            aria-disabled={shareDisabled}
            disabled={shareDisabled}
            onPress={onShare}
            pressScale={0.95}
            style={[styles.camera, shareDisabled && styles.cameraDisabled]}
          >
            <View style={styles.cameraRing} />
            <Plus color={colors.ink} size={24} strokeWidth={2.6} />
          </AnimatedPressable>
        </View>
        <TabItem active={active === 'chat'} onPress={() => onTab('chat')} tab="chat" unread={chatUnread} />
        <TabItem active={active === 'profile'} onPress={() => onTab('profile')} tab="profile" unread={profileDot} />
      </View>
    </View>
  );
}

/** Height a screen must reserve at its bottom so content is not hidden behind the bar. */
export const bottomBarClearance = (bottomInset: number) => sizes.bottomBar + Math.max(bottomInset, spacing.sm) + spacing.md;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', left: spacing.md, position: 'absolute', right: spacing.md, zIndex: 20 },
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, flexDirection: 'row', height: sizes.bottomBar, maxWidth: 460, paddingHorizontal: spacing.sm, width: '100%', ...shadow },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: sizes.touch },
  iconTile: { alignItems: 'center', borderRadius: radii.md, height: 30, justifyContent: 'center', width: 48 },
  iconTileActive: { backgroundColor: 'rgba(95, 211, 160, 0.14)' },
  label: { ...typography.micro, marginTop: 1 },
  unreadDot: { backgroundColor: colors.danger, borderColor: colors.surface, borderRadius: 5, borderWidth: 2, height: 10, position: 'absolute', right: 12, top: 2, width: 10 },
  cameraSlot: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  camera: { alignItems: 'center', backgroundColor: colors.flare, borderRadius: radii.pill, height: sizes.camera + 6, justifyContent: 'center', width: sizes.camera + 6, ...shadowSoft },
  cameraRing: { borderColor: 'rgba(255, 200, 69, 0.35)', borderRadius: radii.pill, borderWidth: 2, bottom: -4, left: -4, position: 'absolute', right: -4, top: -4 },
  cameraDisabled: { opacity: 0.5 },
});
