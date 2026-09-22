import * as SecureStore from 'expo-secure-store';

import { parseTypeFilter, serializeTypeFilter } from './mapTypeFilter';
import type { SignalType } from './types';

const STORAGE_KEY = 'blinkr.map.signalTypeFilter.v1';

/** Reads the persisted selection; an empty set (including "never saved before") means "no filter". */
export const loadTypeFilter = async (): Promise<Set<SignalType>> => {
  try {
    return parseTypeFilter(await SecureStore.getItemAsync(STORAGE_KEY));
  } catch {
    return new Set();
  }
};

export const saveTypeFilter = async (types: ReadonlySet<SignalType>): Promise<void> => {
  try {
    if (types.size === 0) await SecureStore.deleteItemAsync(STORAGE_KEY);
    else await SecureStore.setItemAsync(STORAGE_KEY, serializeTypeFilter(types));
  } catch {
    // The selection still applies for this session even if it could not be persisted.
  }
};
