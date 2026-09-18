import Svg, { Circle, Path } from 'react-native-svg';
export function BlinkrMark({ size = 32, inverse = false }: { size?: number; inverse?: boolean }) {
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="blinkr">
    <Path fill={inverse ? '#FFFFFF' : '#064832'} d="M32 3C17 3 7 14 7 28c0 17 25 34 25 34s25-17 25-34C57 14 47 3 32 3Z" />
    <Path fill="#D8F65A" d="M14 28c5-8 11-12 18-12s13 4 18 12c-5 8-11 12-18 12S19 36 14 28Z" />
    <Circle cx={32} cy={28} r={7} fill="#064832" /><Circle cx={35} cy={25} r={2.5} fill="#FFFFFF" />
  </Svg>;
}
