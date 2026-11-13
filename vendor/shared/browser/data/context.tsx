import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { BrowserDataStore, type BrowserStorage } from './store';
import type { BrowserDataChannel } from './channel';
import { PasswordVault } from './vault';
import { browserRandom, type RandomBytes, type DeriveVaultKey } from './crypto';

function createStore({ scope, storage, channel, random = browserRandom, derive }: {
  scope: string; storage?: BrowserStorage; channel?: BrowserDataChannel; random?: RandomBytes; derive?: DeriveVaultKey;
}) {
  const store = new BrowserDataStore(scope, storage, channel);
  return { store, vault: new PasswordVault(store, random, derive), random };
}
const Context = createContext<ReturnType<typeof createStore> | null>(null);
let fallback: ReturnType<typeof createStore> | undefined;
function webStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function BrowserDataProvider({ scope, storage, channel, random, derive, children }: {
  scope: string; storage?: BrowserStorage; channel?: BrowserDataChannel; random?: RandomBytes;
  derive?: DeriveVaultKey; children: ReactNode;
}) {
  const value = useMemo(() => createStore({ scope, storage: storage ?? webStorage(), channel, random, derive }),
    [scope, storage, channel, random, derive]);
  useEffect(() => value.store.start(), [value]);
  useEffect(() => value.vault.start(), [value]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const lock = () => { if (document.hidden) value.vault.lock(); };
    document.addEventListener('visibilitychange', lock);
    return () => document.removeEventListener('visibilitychange', lock);
  }, [value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBrowserData() {
  const context = useContext(Context) ?? (fallback ??= createStore({ scope: 'guest', storage: webStorage() }));
  const state = useSyncExternalStore(context.store.subscribe, context.store.snapshot, context.store.snapshot);
  const passwords = useSyncExternalStore(context.vault.subscribe, context.vault.snapshot, context.vault.snapshot);
  return { ...context, ...state, passwords };
}
