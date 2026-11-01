import { Send } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { StatusIcon, StatusTone } from '../../snapPresentation';
import { colors } from '../../theme';

/** Snap red, chat blue, and a quiet grey for everything that is already handled. */
export const statusColor = (tone: StatusTone) => (tone === 'snap' ? colors.danger : tone === 'chat' ? colors.blue : colors.textSecondary);

/**
 * The small status glyph of the chat list: a square (received) or an arrow (sent), filled while something is new or
 * waiting and outlined once it has been handled. Drawn from views so it stays crisp at 14px.
 */
export function SnapStatusIcon({ icon, tone, filled, size = 14 }: { icon: StatusIcon; tone: StatusTone; filled: boolean; size?: number }) {
  if (icon === 'none') return null;
  const color = statusColor(tone);
  if (icon === 'arrow') return <Send color={color} fill={filled ? color : 'none'} size={size} strokeWidth={2.2} />;
  return <View style={[styles.square, { borderColor: color, height: size, width: size }, filled && { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  square: { borderRadius: 4, borderWidth: 2 },
});
