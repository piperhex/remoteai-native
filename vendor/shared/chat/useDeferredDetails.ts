import { useEffect, useRef, useState } from 'react';
import { isItemFinished } from '../conversation/itemStatus';
import type { Item } from '../conversation/types';

type Target = NonNullable<Item['detailsRef']>;
export type ToolDetailsLoader = (target: Target) => Promise<{ item: Item }> & { cancel?: () => void };
export type ProcessDetailsLoader = (target: NonNullable<Item['processRef']>) => Promise<{ items: Item[] }>;

const REFRESH_MS = 1000;

export function useToolDetails(item: Item, load: ToolDetailsLoader, active: boolean, onLoad?: (item: Item) => void) {
  const target = item.detailsRef!;
  const [loaded, setLoaded] = useState<Item>();
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  const pending = useRef<Promise<unknown>>();
  const report = useRef(onLoad);
  report.current = onLoad;
  useEffect(() => { setLoaded(undefined); }, [load]);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    const refresh = async () => {
      // A completion or retry waits for the previous refresh, then reads the authoritative final result.
      await pending.current;
      if (disposed) return;
      const request = load({ threadId: target.threadId, turnId: target.turnId, itemId: target.itemId });
      cancel = request.cancel;
      pending.current = request.catch(() => undefined);
      try {
        const result = await request;
        if (disposed) return;
        setLoaded(result.item); setError(false);
        report.current?.(result.item);
        if (item.status === 'inProgress' && !isItemFinished(result.item.status)) {
          timer = setTimeout(() => void refresh(), REFRESH_MS);
        }
      } catch {
        if (!disposed) setError(true);
      }
    };
    setError(false);
    void refresh();
    return () => { disposed = true; clearTimeout(timer); cancel?.(); };
  }, [load, active, target.threadId, target.turnId, target.itemId, item.status, attempt]);
  return { loaded, error, retry: () => retry(value => value + 1) };
}

const requests = new WeakMap<ProcessDetailsLoader, Map<string, Promise<Item[]>>>();

function read(load: ProcessDetailsLoader, target: NonNullable<Item['processRef']>) {
  const pending = requests.get(load) ?? new Map<string, Promise<Item[]>>();
  requests.set(load, pending);
  const key = JSON.stringify(target);
  const previous = pending.get(key);
  if (previous) return previous;
  const result = load(target).then(response => response.items).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}

export function useProcessDetails(items: Item[], load: ProcessDetailsLoader, active: boolean) {
  const [loaded, setLoaded] = useState<Item[]>();
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  const currentItems = useRef(items);
  currentItems.current = items;
  const key = JSON.stringify(items.map(item => item.processRef ?? item.id));
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    setError(false);
    setLoaded(undefined);
    void Promise.all(currentItems.current.map(item => item.processRef ? read(load, item.processRef) : [item]))
      .then(groups => { if (!disposed) setLoaded(groups.flat()); })
      .catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; };
    // Payload identity is the stable reference; history refreshes may recreate summary objects.
  }, [load, active, key, attempt]);
  return { loaded, error, retry: () => retry(value => value + 1) };
}
