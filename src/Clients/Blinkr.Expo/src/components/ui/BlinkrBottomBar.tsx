import { Camera, Compass, Map as MapIcon, MessageCircle, UserRound } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, shadow, sizes, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { useKeyboardVisible } from './useKeyboardVisible';

export type BlinkrTab = 'chat' | 'map' | 'nearby' | 'profile';

type Props = {
  active: BlinkrTab;
  onTab: (tab: BlinkrTab) => void;
  onCamera: () => void;
  /** Shows the red dot on Sohbet. Only pass true when a real unread message exists. */
  chatUnread?: boolean;
  cameraDisabled?: boolean;
  /** A sheet or the composer owns the screen; two stacked bars are never shown. */
  hidden?: boolean;
};

const tabIcons = { chat: MessageCircle, map: MapIcon, nearby: Compass, profile: UserRound } as const;
const tabLabels: Record<BlinkrTab, string> = { chat: 'Sohbet', map: 'Harita', nearby: 'Yakında', profile: 'Profil' };

function TabItem({ tab, active, unread, onPress }: { tab: BlinkrTab; active: boolean; unread?: boolean; onPress: () => void }) {
  const Icon = tabIcons[tab];
  const color = active ? colors.mint : colors.textSecondary;
  return (
    <AnimatedPressable
      accessibilityLabel={unread ? `${tabLabels[tab]}, okunmamış mesaj var` : tabLabels[tab]}
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      pressScale={0.92}
      style={styles.item}
    >
      <View style={[styles.iconTile, active && styles.iconTileActive]}>
        <Icon color={color} size={25} strokeWidth={active ? 2.5 : 2.2} />
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <Text style={[styles.label, { color }]}>{tabLabels[tab]}</Text>
    </AnimatedPressable>
  );
}

/**
 * The one bottom navigation for the whole app: Sohbet | Harita | Kamera | Yakında | Profil.
 * The camera is an action, not a tab - it never shows as "selected".
 */
export function BlinkrBottomBar({ active, onTab, onCamera, chatUnread = false, cameraDisabled = false, hidden = false }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  if (keyboardVisible || hidden) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View accessibilityRole="tablist" style={styles.bar}>
        <TabItem active={active === 'chat'} onPress={() => onTab('chat')} tab="chat" unread={chatUnread} />
        <TabItem active={active === 'map'} onPress={() => onTab('map')} tab="map" />
        <View style={styles.cameraSlot}>
          <AnimatedPressable
            accessibilityLabel="Kamerayla sinyal paylaş"
            accessibilityRole="button"
            aria-disabled={cameraDisabled}
            disabled={cameraDisabled}
            onPress={onCamera}
            pressScale={0.9}
            style={[styles.camera, cameraDisabled && styles.cameraDisabled]}
          >
            <Camera color={colors.ink} size={32} strokeWidth={2.4} />
          </AnimatedPressable>
        </View>
        <TabItem active={active === 'nearby'} onPress={() => onTab('nearby')} tab="nearby" />
        <TabItem active={active === 'profile'} onPress={() => onTab('profile')} tab="profile" />
      </View>
    </View>
  );
}

/** Height a screen must reserve at its bottom so content is not hidden behind the bar. */
export const bottomBarClearance = (bottomInset: number) => sizes.bottomBar + Math.max(bottomInset, spacing.sm) + spacing.md;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', left: spacing.md, position: 'absolute', right: spacing.md, zIndex: 20 },
  bar: { alignItems: 'center', backgroundColor: colors.glass, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, flexDirection: 'row', height: sizes.bottomBar, maxWidth: 460, paddingHorizontal: spacing.sm, width: '100%', ...shadow },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: sizes.touch + 8 },
  iconTile: { alignItems: 'center', borderRadius: radii.md, height: 36, justifyContent: 'center', width: 48 },
  iconTileActive: { backgroundColor: colors.greenSoft },
  label: { ...typography.caption, fontWeight: '700', marginTop: 2 },
  unreadDot: { backgroundColor: colors.danger, borderColor: colors.surface, borderRadius: 6, borderWidth: 2, height: 12, position: 'absolute', right: 10, top: 2, width: 12 },
  cameraSlot: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  camera: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: (sizes.camera + 6) / 2, borderWidth: 3, height: sizes.camera + 6, justifyContent: 'center', width: sizes.camera + 6, ...shadow },
  cameraDisabled: { opacity: 0.5 },
});
