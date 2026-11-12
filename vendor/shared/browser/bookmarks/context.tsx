import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { BookmarkChannel } from './channel';
import { BookmarkStore } from './store';

type BookmarkStorage = Pick<Storage, 'getItem' | 'setItem'>;
function browserStorage() {
  try { return window.localStorage; } catch { return undefined; }
}
const Context = createContext<BookmarkStore | null>(null);
let guest: BookmarkStore | undefined;

export function BookmarkProvider({ scope, channel, storage, children }: {
  scope: string; channel?: BookmarkChannel; storage?: BookmarkStorage; children: ReactNode;
}) {
  const store = useMemo(() => new BookmarkStore(scope || 'guest', storage ?? browserStorage(), channel),
    [scope, channel, storage]);
  useEffect(() => store.start(), [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useBookmarks() {
  const context = useContext(Context);
  const store = context ?? (guest ??= new BookmarkStore('guest', browserStorage()));
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return { ...state, store };
}
