import type { SignalType } from './types';

/*
 * Pure logic only - no expo-secure-store import here. That native module's binding cannot resolve
 * outside the Expo runtime (confirmed: it breaks the plain tsc+node test pipeline exactly like
 * lucide-react-native did for signalCatalog.ts earlier in this project - see PROGRESS.md P1.6). The
 * actual persistence lives in `mapTypeFilterStorage.ts`, which only screens import.
 */

const ALL_TYPES: readonly SignalType[] = ['Crowd', 'Queue', 'TemporaryStatus', 'Event', 'Offer', 'NewOpening', 'GeneralObservation'];
const isSignalType = (value: string): value is SignalType => (ALL_TYPES as readonly string[]).includes(value);

/** Ordered chips for the map's type-filter row (04 §1.2). Order is fixed so the row does not reshuffle. */
export const MAP_FILTER_TYPES = ALL_TYPES;

/** Turns a stored comma-separated string back into a set, dropping anything that is not a real type. */
export const parseTypeFilter = (raw: string | null | undefined): Set<SignalType> => {
  if (!raw) return new Set();
  return new Set(raw.split(',').filter(isSignalType));
};

export const serializeTypeFilter = (types: ReadonlySet<SignalType>): string => Array.from(types).join(',');
