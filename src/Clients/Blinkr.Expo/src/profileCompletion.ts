/**
 * Doc P8: the "complete your profile" card. Three real steps - a photo, a short bio, a first signal - each done or not,
 * read from what the account already says. The card shows only while something is missing and disappears once all
 * three are done; it never invents progress. Pure, no React Native imports.
 */
export type CompletionStep = 'photo' | 'bio' | 'signal';

export type ProfileCompletion = { steps: Array<{ step: CompletionStep; done: boolean }>; done: number; total: number; complete: boolean };

export const profileCompletion = (profile: { hasPhoto: boolean; bio: string | null | undefined; signalCount: number | null }): ProfileCompletion | null => {
  // Until the signal count is known the card would flicker in and out; it waits.
  if (profile.signalCount === null) return null;
  const steps: ProfileCompletion['steps'] = [
    { step: 'photo', done: profile.hasPhoto },
    { step: 'bio', done: Boolean(profile.bio?.trim()) },
    { step: 'signal', done: profile.signalCount > 0 },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
};
