import { StyleSheet, Text, View } from 'react-native';

import { agoLabel, stateLabel } from '../../live/liveLabels';
import type { LiveState } from '../../live/liveState';
import { colors, spacing, typography } from '../../theme';
import { StatusPill } from './StatusPill';

/** A row's live line: the state pill and how old it is. Nothing unless the place has verified live information. */
export function LiveStateLine({ state }: { state: LiveState }) {
  if (state.source !== 'live') return null;
  return (
    <View style={styles.row}>
      <StatusPill kind={state.kind} label={stateLabel(state)} />
      <Text numberOfLines={1} style={styles.age}>{agoLabel(state.ageMinutes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', columnGap: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  age: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
});
