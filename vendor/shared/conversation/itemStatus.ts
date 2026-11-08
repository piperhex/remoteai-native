import type { Item } from './types';

const FINISHED = new Set(['completed', 'failed', 'declined', 'interrupted']);

export function isItemFinished(status: Item['status']): boolean {
  return FINISHED.has(status ?? '');
}

/** A cached start or delayed notification cannot restart the same completed execution. */
export function mergeItemLifecycle(previous: Item, incoming: Item): Item {
  if (previous.id === incoming.id && isItemFinished(previous.status) && incoming.status === 'inProgress') {
    return previous;
  }
  return { ...previous, ...incoming };
}
