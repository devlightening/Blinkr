import { StyleSheet, View } from 'react-native';
import { Bookmark, Grid3x3 } from 'lucide-react-native';

import { colors, spacing } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { tx } from '../../i18n/tx';

export type ProfileTab = 'signals' | 'places';

/**
 * Doc P4: full-width icon tabs with an underline (grid = signals, bookmark = saved places), Instagram's layout. The
 * profile keeps it pinned at the top while the content scrolls (sticky header). No sideways swipe between them: the
 * profile already lives in the app's horizontal tab pager, and the two would fight.
 */
export function ProfileTabs({ value, onChange, signalCount, placeCount }: { value: ProfileTab; onChange: (tab: ProfileTab) => void; signalCount: number | null; placeCount: number }) {
  const tab = (id: ProfileTab, label: string, icon: (color: string) => React.ReactNode) => {
    const selected = value === id;
    return (
      <AnimatedPressable
        accessibilityLabel={label}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        key={id}
        onPress={() => onChange(id)}
        pressScale={0.96}
        style={styles.tab}
        testID={`profile-tab-${id}`}
      >
        {icon(selected ? colors.text : colors.textSecondary)}
        <View style={[styles.underline, selected && styles.underlineOn]} />
      </AnimatedPressable>
    );
  };
  return (
    <View accessibilityLabel={tx('profile:me.tabs', 'Profil bölümleri')} accessibilityRole="tablist" style={styles.bar}>
      {tab('signals', signalCount ? tx('profile:me.tabSignalsCount', 'Sinyaller · {{count}}', { count: signalCount }) : tx('profile:me.tabSignals', 'Sinyaller'), (c) => <Grid3x3 color={c} size={22} />)}
      {tab('places', placeCount ? tx('profile:me.tabPlacesCount', 'Yerler · {{count}}', { count: placeCount }) : tx('profile:me.tabPlaces', 'Yerler'), (c) => <Bookmark color={c} size={22} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width under the screen's side padding, and opaque: content scrolls underneath while it is stuck to the top.
  bar: { backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginHorizontal: -spacing.lg },
  tab: { alignItems: 'center', flex: 1, gap: spacing.sm, paddingTop: spacing.md },
  underline: { backgroundColor: 'transparent', height: 2, width: '100%' },
  underlineOn: { backgroundColor: colors.text },
});
