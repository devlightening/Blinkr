import { Text, type TextProps } from 'react-native';

import { colors, displayTypography, typography } from '../../theme';

const STEPS = { ...typography, ...displayTypography };
export type TextVariant = keyof typeof STEPS;

type Props = TextProps & { variant?: TextVariant; color?: string };

/**
 * A `Text` with the design system's named type steps (03_DESIGN_SYSTEM.md §3): `display`/`title1`/
 * `title2` render in Bricolage Grotesque (loaded in `App.tsx`), everything else in the platform system
 * font, exactly as before. An unloaded/failed custom font name is not an error - the platform silently
 * falls back to its default font for an unregistered `fontFamily`, so this needs no separate fallback.
 *
 * Existing screens keep writing `style={typography.heading}` directly; nothing was migrated to this
 * (P1.3, sinyal-mvp-plan) - it is here for new screens that want the shorthand, and for anywhere a
 * `display`/`title1`/`title2` step is used for the first time.
 */
export function BlinkrText({ variant = 'body', color = colors.text, style, ...rest }: Props) {
  return <Text style={[STEPS[variant], { color }, style]} {...rest} />;
}
