import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { agoLabel, confirmLabel, liveA11yLabel, stateLabel } from '../../live/liveLabels';
import { isEstimated, shouldPulse, type LiveState } from '../../live/liveState';
import { colors, liveColors, liveRingSize, radii, shadowSoft, spacing, typography } from '../../theme';
import { AnimatedPressable } from '../AnimatedPressable';
import { PlaceSymbol } from '../PlaceSymbol';
import { LiveRing } from './LiveRing';
import { StatusPill } from './StatusPill';

export type PlaceStatusCardProps = {
  name: string;
  /** Drawn instead of `name` (a search match in bold); `name` still feeds the accessibility label. */
  nameNode?: ReactNode;
  /** Already translated, e.g. "Kafe · 120 m". */
  meta: string;
  state: LiveState;
  category?: string | null;
  onPress?: () => void;
  /** Replaces the chevron; `null` shows nothing. */
  trailing?: ReactNode;
  /** Rows in a list or inside a bubble: no surface of its own. */
  flat?: boolean;
  /** The disc behind the icon; defaults to the card surface (flat rows: surfaceElevated). */
  centerColor?: string;
  /** The word shown, as plain text, when nothing is known about the place. Without it a no-info row is just ring + name + meta. */
  noInfoLabel?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * One place card for Search, Chat and the map sheet: ring (state + freshness) with the place-type icon, name, meta, then
 * the state word and how old / how many people stand behind it. A closed place is muted but still worded.
 */
function PlaceStatusCardBase({
  name, nameNode, meta, state, category, onPress, trailing, flat = false, noInfoLabel, centerColor, accessibilityLabel, accessibilityHint, testID,
}: PlaceStatusCardProps) {
  const estimated = isEstimated(state);
  const live = state.source === 'live';
  const noInfo = state.source === 'none';
  const detail = live ? [agoLabel(state.ageMinutes), confirmLabel(state.confirmations)].filter(Boolean).join(' · ') : '';
  const pressable = Boolean(onPress);
  const end = trailing === undefined ? (pressable ? <ChevronRight color={colors.textSecondary} size={18} /> : null) : trailing;

  const body = (
    <>
      <LiveRing
        centerColor={centerColor ?? (flat ? colors.surfaceElevated : undefined)}
        estimated={estimated}
        freshness={live ? state.freshness : 0}
        kind={state.kind}
        pulse={shouldPulse(state)}
        size={liveRingSize.card}
      >
        <PlaceSymbol category={category} color={noInfo ? colors.textSecondary : liveColors[state.kind]} size={20} />
      </LiveRing>
      <View style={styles.copy}>
        {nameNode ?? <Text numberOfLines={1} style={styles.name}>{name}</Text>}
        <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
        {noInfo ? (
          noInfoLabel ? <Text numberOfLines={2} style={styles.meta}>{noInfoLabel}</Text> : null
        ) : (
          <View style={styles.status}>
            <StatusPill estimated={estimated} kind={state.kind} label={stateLabel(state)} style={styles.pill} />
            {detail ? <Text numberOfLines={2} style={styles.detail}>{detail}</Text> : null}
          </View>
        )}
      </View>
      {end}
    </>
  );

  const style = [styles.base, flat ? styles.flat : styles.card, state.kind === 'closed' && styles.muted];
  const label = accessibilityLabel ?? liveA11yLabel(name, state);
  if (!pressable) {
    return <View accessible accessibilityLabel={label} style={style} testID={testID}>{body}</View>;
  }
  return (
    <AnimatedPressable accessibilityHint={accessibilityHint} accessibilityLabel={label} accessibilityRole="button" onPress={onPress} pressScale={0.99} style={style} testID={testID}>
      {body}
    </AnimatedPressable>
  );
}

export const PlaceStatusCard = memo(PlaceStatusCardBase);

const styles = StyleSheet.create({
  base: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, ...shadowSoft },
  flat: { paddingVertical: spacing.sm },
  muted: { opacity: 0.6 },
  copy: { flex: 1, flexShrink: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  status: { alignItems: 'center', columnGap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, rowGap: 2 },
  pill: { alignSelf: 'center' },
  detail: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
});
