import { useSyncExternalStore } from 'react';
import type { SearchStorage } from '../searchPreference';

const preferenceKey = 'remoteai:browser-mouse-controls';

export function mousePreference(storage: () => SearchStorage) {
  const listeners = new Set<() => void>();
  let enabled: boolean | undefined;
  const snapshot = () => {
    if (enabled !== undefined) return enabled;
    try { enabled = storage().getItem(preferenceKey) === 'true'; } catch { enabled = false; }
    return enabled;
  };
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const set = (value: boolean) => {
    enabled = value;
    try { storage().setItem(preferenceKey, String(value)); } catch { /* Keep the selection for this session. */ }
    listeners.forEach(listener => listener());
  };
  return function useMousePreference() { return [useSyncExternalStore(subscribe, snapshot), set] as const; };
}
