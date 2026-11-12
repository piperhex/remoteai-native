import { useSyncExternalStore } from 'react';
import { SearchPreference } from './searchPreference';

let browserPreference: SearchPreference | undefined;
function preference() {
  if (!browserPreference) {
    let storage;
    try { storage = window.localStorage; } catch { /* Default remains available without browser storage. */ }
    browserPreference = new SearchPreference(storage);
  }
  return browserPreference;
}

export function useSearchEngine(store = preference()) {
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { ...state, select: store.select };
}
