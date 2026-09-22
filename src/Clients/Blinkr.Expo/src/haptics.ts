import * as Haptics from 'expo-haptics';

/** Small, quiet confirmations. Never required for anything to work: a device without haptics simply does nothing. */
const safely = (run: () => Promise<unknown>) => { try { void run().catch(() => {}); } catch { /* no haptics on this device */ } };

export const tap = () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const success = () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
