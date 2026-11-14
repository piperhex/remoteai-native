import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { BookmarkChannel } from './channel';
import { BookmarkStore } from './store';
import { BrowserDataProvider } from '../data/context';
import type { RandomBytes, DeriveVaultKey } from '../data/crypto';
import type { VaultKeyStorageFactory } from '../data/vaultKeyStorage';

type BookmarkStorage = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage() {
  try { return window.localStorage; } catch { return undefined; }
}
const Context = createContext<BookmarkStore | null>(null);
let guest: BookmarkStore | undefined;

export function BookmarkProvider({ scope, channel, storage, random, derive, keyStorage, children }: {
  scope: string; channel?: BookmarkChannel; storage?: BookmarkStorage; random?: RandomBytes;
  derive?: DeriveVaultKey; keyStorage?: VaultKeyStorageFactory; children: ReactNode;
}) {
  const store = useMemo(() => new BookmarkStore(scope || 'guest', storage ?? browserStorage(), channel),
    [scope, channel, storage]);
  useEffect(() => store.start(), [store]);
  return <Context.Provider value={store}><BrowserDataProvider scope={scope} channel={channel?.browserData}
    storage={storage} random={random} derive={derive} keyStorage={keyStorage}>{children}</BrowserDataProvider></Context.Provider>;
}

export function useBookmarks() {
  const context = useContext(Context);
  const store = context ?? (guest ??= new BookmarkStore('guest', browserStorage()));
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { ...state, store };
}
