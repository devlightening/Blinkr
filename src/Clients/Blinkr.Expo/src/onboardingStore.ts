import * as SecureStore from 'expo-secure-store';

import { onboardingKey } from './onboardingContent';

/** True once this person has seen the introduction. A storage failure counts as "seen": never trap anyone behind it. */
export const hasSeenOnboarding = async (userId: string) => {
  try {
    return (await SecureStore.getItemAsync(onboardingKey(userId))) === '1';
  } catch {
    return true;
  }
};

export const markOnboardingSeen = async (userId: string) => {
  try {
    await SecureStore.setItemAsync(onboardingKey(userId), '1');
  } catch {
    /* worst case the introduction shows once more */
  }
};
