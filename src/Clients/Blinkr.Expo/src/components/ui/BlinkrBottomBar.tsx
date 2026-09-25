import { LinearGradient } from 'expo-linear-gradient';
import { Compass, Map as MapIcon, MessageCircle, Plus, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradientDirection, gradients, radii, sizes, spacing } from '../../theme';
import { Avatar } from '../Avatar';
import { GradientRing } from './GradientRing';
import { AnimatedPressable } from '../AnimatedPressable';
import { useKeyboardVisible } from './useKeyboardVisible';
import { tx } from '../../i18n/tx';

export type BlinkrTab = 'chat' | 'map' | 'nearby' | 'profile';

type Props = {
  active: BlinkrTab;
  onTab: (tab: BlinkrTab) => void;
  /** (+) tap opens the camera; a long press opens the text-only composer (sinyal-mvp-plan P5.1). */
  onShare: (mode: 'camera' | 'text') => void;
  /** Shows the red dot on Sohbet. Only pass true when a real unread message exists. */
  chatUnread?: boolean;
  /** Shows the dot on Profil. Only pass true while a friend request really waits for an answer. */
  profileDot?: boolean;
  shareDisabled?: boolean;
  /** A sheet or the composer owns the screen; two stacked bars are never shown. */
  hidden?: boolean;
  /** The signed-in person: Profil shows their avatar (Instagram), with a gradient ring while selected. */
  me?: { userId: string; avatarKey?: string | null } | null;
};

const tabIcons = { chat: MessageCircle, map: MapIcon, nearby: Compass, profile: UserRound } as const;
// "nearby" still points at the existing Yakında screen for now (sinyal-mvp-plan 00_START_HERE §1: Keşfet
// "şimdilik mevcut 'Yakında' ekranını gösterir"); only the tab's own label has moved to the plan's name.
// Maps to common.json's tab.* keys (P1.4): the first real, end-to-end i18n usage in the app.
const tabLabelKeys: Record<BlinkrTab, string> = { chat: 'tab.chat', map: 'tab.map', nearby: 'tab.explore', profile: 'tab.profile' };

function TabItem({ tab, active, unread, me, onPress }: { tab: BlinkrTab; active: boolean; unread?: boolean; me?: Props['me']; onPress: () => void }) {
  const { t } = useTranslation('common');
  const label = t(tabLabelKeys[tab]);
  const Icon = tabIcons[tab];
  const color = active ? colors.text : colors.textSecondary;
  return (
    <AnimatedPressable
      accessibilityLabel={unread ? (tab === 'profile' ? tx('common:tabs.profileDot', '{{label}}, bekleyen arkadaş isteği var', { label }) : tx('common:tabs.chatDot', '{{label}}, okunmamış mesaj var', { label })) : label}
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      pressScale={0.9}
      style={styles.item}
      testID={`tab-${tab}`}
    >
      <View style={styles.iconTile}>
        {tab === 'profile' && me ? (
          // Instagram: the profile tab is your own face; selected = the brand ring around it.
          <GradientRing gapColor={colors.surface} hidden={!active} size={30} thickness={2}>
            <Avatar avatarKey={me.avatarKey} seed={me.userId} size={active ? 22 : 26} />
          </GradientRing>
        ) : (
          <Icon color={color} size={25} strokeWidth={active ? 2.5 : 1.9} />
        )}
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
      {/* Selected: a small gradient dot under the icon instead of a label (labels stay for screen readers). */}
      {active ? <LinearGradient colors={gradients.brand} end={gradientDirection.end} start={gradientDirection.start} style={styles.activeDot} /> : <View style={styles.activeDotSpace} />}
    </AnimatedPressable>
  );
}

/**
 * The one bottom navigation for the whole app: Harita | Keşfet | Paylaş | Sohbet | Profil.
 * Paylaş is an action, not a tab - it never shows as "selected".
 */
export function BlinkrBottomBar({ active, onTab, onShare, chatUnread = false, profileDot = false, shareDisabled = false, hidden = false, me = null }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  if (keyboardVisible || hidden) return null;
  return (
    // Edge to edge at the very bottom (Instagram, Snapchat): the bar owns the safe area under it.
    <View pointerEvents="box-none" style={styles.wrap}>
      {/* Sıra sinyal-mvp-plan 02_INFORMATION_ARCHITECTURE §1: Harita · Keşfet · (+) · Sohbet · Profil. */}
      <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: insets.bottom, height: BAR_ROW + insets.bottom }]}>
        <TabItem active={active === 'map'} onPress={() => onTab('map')} tab="map" />
        <TabItem active={active === 'nearby'} onPress={() => onTab('nearby')} tab="nearby" />
        <View style={styles.cameraSlot}>
          <AnimatedPressable
            accessibilityHint={tx('common:tabs.createHint', 'Kamera açılır. Basılı tutarsan yalnız yazılı sinyal.')}
            accessibilityLabel={tx('common:tabs.create', 'Yeni sinyal paylaş')}
            accessibilityRole="button"
            aria-disabled={shareDisabled}
            disabled={shareDisabled}
            delayLongPress={350}
            onLongPress={() => onShare('text')}
            onPress={() => onShare('camera')}
            pressScale={0.95}
            style={[styles.camera, shareDisabled && styles.cameraDisabled]}
            testID="tab-create"
          >
            <LinearGradient colors={gradients.brand} end={gradientDirection.end} pointerEvents="none" start={gradientDirection.start} style={styles.cameraFill} />
            <View style={styles.cameraIcon}><Plus color={colors.white} size={26} strokeWidth={2.6} /></View>
          </AnimatedPressable>
        </View>
        <TabItem active={active === 'chat'} onPress={() => onTab('chat')} tab="chat" unread={chatUnread} />
        <TabItem active={active === 'profile'} me={me} onPress={() => onTab('profile')} tab="profile" unread={profileDot} />
      </View>
    </View>
  );
}

/** Height a screen must reserve at its bottom so content is not hidden behind the bar. */
export const bottomBarClearance = (bottomInset: number) => BAR_ROW + bottomInset + spacing.sm;

/** The tappable row of the bar; the safe area below it is added on top. */
const BAR_ROW = sizes.bottomBar + 4;

const styles = StyleSheet.create({
  wrap: { bottom: 0, left: 0, position: 'absolute', right: 0, zIndex: 20 },
  bar: { alignItems: 'center', backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingHorizontal: spacing.sm, width: '100%' },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: sizes.touch, paddingTop: 4 },
  iconTile: { alignItems: 'center', height: 32, justifyContent: 'center', width: 44 },
  activeDot: { borderRadius: 2, height: 4, marginTop: 4, width: 4 },
  activeDotSpace: { height: 4, marginTop: 4 },
  unreadDot: { backgroundColor: colors.danger, borderColor: colors.surface, borderRadius: 5, borderWidth: 2, height: 10, position: 'absolute', right: 6, top: 1, width: 10 },
  cameraSlot: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  // The one bright thing on the bar: the brand gradient disc with a warm glow (V2 D-024).
  camera: { alignItems: 'center', borderRadius: radii.pill, elevation: 8, height: 52, justifyContent: 'center', overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, width: 52 },
  cameraFill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, borderRadius: radii.pill },
  cameraIcon: { zIndex: 1 },
  cameraDisabled: { opacity: 0.5 },
});
