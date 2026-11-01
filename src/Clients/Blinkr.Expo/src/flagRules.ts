/** Feature flag names and defaults (plan Faz 0.5). Pure, so plain-node tests run it; `flags.ts` adds the env override. */
export type Flag = 'heatLayer';

export const FLAG_DEFAULTS: Readonly<Record<Flag, boolean>> = {
  heatLayer: true, // D-045
};

/** "a,-b" -> { a: true, b: false }; unknown names are ignored. */
export const parseFlagOverrides = (raw: string | null | undefined): Partial<Record<Flag, boolean>> => {
  const result: Partial<Record<Flag, boolean>> = {};
  for (const part of (raw ?? '').split(',').map((item) => item.trim()).filter(Boolean)) {
    const off = part.startsWith('-');
    const name = (off ? part.slice(1) : part) as Flag;
    if (name in FLAG_DEFAULTS) result[name] = !off;
  }
  return result;
};
