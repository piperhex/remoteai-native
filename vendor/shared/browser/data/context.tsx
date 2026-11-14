import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { BrowserDataStore, type BrowserStorage } from './store';
import type { BrowserDataChannel } from './channel';
import { PasswordVault } from './vault';
import { browserRandom, type RandomBytes, type DeriveVaultKey } from './crypto';
import { browserVaultKeyStorage } from './browserVaultKeyStorage';
import type { VaultKeyStorageFactory } from './vaultKeyStorage';

function createStore({ scope, storage, channel, random = browserRandom, derive,
  keyStorage = browserVaultKeyStorage }: {
  scope: string; storage?: BrowserStorage; channel?: BrowserDataChannel; random?: RandomBytes; derive?: DeriveVaultKey;
  keyStorage?: VaultKeyStorageFactory;
}) {
  const store = new BrowserDataStore(scope, storage, channel);
  return { store, vault: new PasswordVault(store, random, derive, keyStorage(scope)), random };
}
const Context = createContext<ReturnType<typeof createStore> | null>(null);
let fallback: ReturnType<typeof createStore> | undefined;
function webStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function BrowserDataProvider({ scope, storage, channel, random, derive, keyStorage, children }: {
  scope: string; storage?: BrowserStorage; channel?: BrowserDataChannel; random?: RandomBytes;
  derive?: DeriveVaultKey; keyStorage?: VaultKeyStorageFactory; children: ReactNode;
}) {
  const value = useMemo(() => createStore({ scope, storage: storage ?? webStorage(), channel, random, derive, keyStorage }),
    [scope, storage, channel, random, derive, keyStorage]);
  useEffect(() => value.store.start(), [value]);
  useEffect(() => value.vault.start(), [value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBrowserData() {
  const context = useContext(Context) ?? (fallback ??= createStore({ scope: 'guest', storage: webStorage() }));
  const state = useSyncExternalStore(context.store.subscribe, context.store.snapshot, context.store.snapshot);
  const passwords = useSyncExternalStore(context.vault.subscribe, context.vault.snapshot, context.vault.snapshot);
  return { ...context, ...state, passwords };
}
