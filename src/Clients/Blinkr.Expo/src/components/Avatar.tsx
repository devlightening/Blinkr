import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AVATAR_COLORS, resolveAvatar, type AvatarConfig } from '../avatars';
import { colors } from '../theme';

const INK = colors.ink;
const BODY = '#F7FBF8';
const LEAF = colors.darkGreen;

type Props = {
  /** The chosen catalogue key; anything invalid falls back to the default for `seed`. */
  avatarKey?: string | null;
  /** Stable identity (user id) that decides the default avatar. */
  seed: string;
  size?: number;
  /** Ring around the avatar, e.g. lime for unread. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
};

function Eyes({ face }: { face: number }) {
  const stroke = { fill: 'none', stroke: INK, strokeLinecap: 'round' as const, strokeWidth: 3.2 };
  if (face === 1) return (<><Path d="M35.5 43 Q40 38 44.5 43" {...stroke} /><Circle cx={60} cy={42} fill={INK} r={3.4} /></>);
  if (face === 2) return (<><Circle cx={40} cy={42} fill={INK} r={4} /><Circle cx={60} cy={42} fill={INK} r={4} /></>);
  if (face === 3) return (<><Path d="M35.5 42 Q40 47 44.5 42" {...stroke} /><Path d="M55.5 42 Q60 47 64.5 42" {...stroke} /></>);
  return (<><Circle cx={40} cy={42} fill={INK} r={3.4} /><Circle cx={60} cy={42} fill={INK} r={3.4} /></>);
}

function Mouth({ face }: { face: number }) {
  const stroke = { fill: 'none', stroke: INK, strokeLinecap: 'round' as const, strokeWidth: 3.2 };
  if (face === 2) return <Circle cx={50} cy={57} fill={INK} r={4.2} />;
  if (face === 3) return <Path d="M45 57 L55 57" {...stroke} />;
  if (face === 4) return <Path d="M38 52 Q50 69 62 52 Z" fill={INK} stroke={INK} strokeLinejoin="round" strokeWidth={2} />;
  if (face === 5) return <Path d="M41 57 Q52 61 61 52" {...stroke} />;
  return <Path d="M40 54 Q50 63 60 54" {...stroke} />;
}

function Accessory({ accessory }: { accessory: number }) {
  switch (accessory) {
    case 1: return (
      <>
        <Circle cx={40} cy={42} fill="none" r={8.5} stroke={INK} strokeWidth={3} />
        <Circle cx={60} cy={42} fill="none" r={8.5} stroke={INK} strokeWidth={3} />
        <Path d="M48.5 42 L51.5 42" stroke={INK} strokeLinecap="round" strokeWidth={3} />
      </>
    );
    case 2: return (
      <>
        <Path d="M24 31 C24 9 76 9 76 31 Z" fill={INK} />
        <Path d="M17 31 H83 Q86 31 86 34 Q86 37.5 81 37.5 H17 Z" fill={INK} />
      </>
    );
    case 3: return (
      <>
        <Path d="M22.5 45 C22.5 12 77.5 12 77.5 45" fill="none" stroke={INK} strokeLinecap="round" strokeWidth={5} />
        <Rect fill={INK} height={17} rx={5} width={10} x={16} y={39} />
        <Rect fill={INK} height={17} rx={5} width={10} x={74} y={39} />
      </>
    );
    case 4: return (
      <>
        <Path d="M50 19 L50 11" fill="none" stroke={LEAF} strokeLinecap="round" strokeWidth={3} />
        <Path d="M50 12 C41 3 32 8 35 15 C41 17 47 16 50 12 Z" fill={LEAF} />
        <Path d="M50 12 C59 3 68 8 65 15 C59 17 53 16 50 12 Z" fill={LEAF} />
      </>
    );
    case 5: return (
      <>
        <Circle cx={32} cy={53} fill={colors.pink} fillOpacity={0.6} r={5.5} />
        <Circle cx={68} cy={53} fill={colors.pink} fillOpacity={0.6} r={5.5} />
      </>
    );
    default: return null;
  }
}

/** A drawn character: colour background, round head, one of six faces and one of six accessories. */
export function Avatar({ avatarKey, seed, size = 44, ringColor, style }: Props) {
  const config: AvatarConfig = resolveAvatar(avatarKey, seed);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.round, { borderColor: ringColor ?? 'transparent', borderRadius: size / 2, borderWidth: ringColor ? Math.max(2, size / 24) : 0, height: size, width: size }, style]}
    >
      <Svg height="100%" viewBox="0 0 100 100" width="100%">
        <Rect fill={AVATAR_COLORS[config.color]} height={100} width={100} x={0} y={0} />
        <Path d="M12 100 C12 76 30 69 50 69 C70 69 88 76 88 100 Z" fill="#000000" fillOpacity={0.22} />
        <Circle cx={50} cy={44} fill={BODY} r={27} />
        <Eyes face={config.face} />
        <Mouth face={config.face} />
        <Accessory accessory={config.accessory} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { overflow: 'hidden' },
});
