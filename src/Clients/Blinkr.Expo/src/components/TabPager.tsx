import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { colors } from '../theme';
import type { BlinkrTab } from './ui/BlinkrBottomBar';

/** The bottom bar's order; a swipe moves to the neighbour, like Instagram. */
export const TAB_ORDER: BlinkrTab[] = ['map', 'nearby', 'chat', 'profile'];
const indexOf = (tab: BlinkrTab) => Math.max(0, TAB_ORDER.indexOf(tab));

type Props = {
  active: BlinkrTab;
  onChange: (tab: BlinkrTab) => void;
  /** Off while the active page shows an overlay (a conversation, a sheet): the swipe must not leave it. */
  swipeEnabled: boolean;
  renderPage: (tab: BlinkrTab) => ReactNode;
};

/**
 * Swipe between the tabs with a native pager (the OS settles it against the lists and carousels inside a page).
 * The map stays mounted underneath the pager: its page here is transparent, so swiping right from Keşfet slides the
 * map into view, and while the map is active the pager steps aside completely (no touches, no paging) so panning the
 * map never changes tabs. A tab-bar tap jumps without animation; only a finger swipe animates. Only the active page and
 * its neighbours are rendered, so tabs out of reach stop their work as before.
 */
export function TabPager({ active, onChange, swipeEnabled, renderPage }: Props) {
  const pager = useRef<PagerView>(null);
  const shown = useRef(indexOf(active));

  useEffect(() => {
    const target = indexOf(active);
    if (shown.current === target) return;
    shown.current = target;
    pager.current?.setPageWithoutAnimation(target);
  }, [active]);

  const onMap = active === 'map';
  const current = indexOf(active);
  return (
    <View pointerEvents={onMap ? 'none' : 'auto'} style={styles.host}>
      <PagerView
        initialPage={current}
        onPageSelected={(event) => {
          const position = event.nativeEvent.position;
          shown.current = position;
          const tab = TAB_ORDER[position];
          if (tab && tab !== active) onChange(tab);
        }}
        overdrag={false}
        ref={pager}
        scrollEnabled={!onMap && swipeEnabled}
        style={styles.pager}
      >
        {TAB_ORDER.map((tab, index) => (
          <View collapsable={false} key={tab} style={tab === 'map' ? styles.see : styles.page}>
            {tab !== 'map' && Math.abs(index - current) <= 1 ? renderPage(tab) : null}
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, zIndex: 10 },
  pager: { flex: 1 },
  see: { backgroundColor: 'transparent', flex: 1 },
  page: { backgroundColor: colors.background, flex: 1 },
});
