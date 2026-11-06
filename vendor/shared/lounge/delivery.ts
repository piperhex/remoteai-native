import { INVALID_GROUP_RECEIPT, parseGroupReaders, mergeGroupReaders } from './groupReceipts';
import type { LoungeAccount } from './types';

export type ReceiptStatus = 'delivered' | 'read';
export interface LoungeDelivery {
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'rejected' | ReceiptStatus;
  retry?: boolean;
  confirmed?: ReceiptStatus;
  attemptedAt?: number;
  readers?: LoungeAccount[];
  /** A permanent capability failure, separate from actual read/confirmation status. */
  groupReceiptError?: typeof INVALID_GROUP_RECEIPT;
}
export const DIRECT_RETRY_MS = 5000;
export const receiptRank = (status?: string) => status === 'read' ? 2 : status === 'delivered' ? 1 : 0;
export const isReceiptStatus = (value: unknown): value is ReceiptStatus => value === 'delivered' || value === 'read';

export function parseDelivery(value: unknown): LoungeDelivery | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as Partial<LoungeDelivery>;
  if (!['incoming', 'outgoing'].includes(item.direction ?? '')
    || item.status !== 'pending' && item.status !== 'rejected' && !isReceiptStatus(item.status)) return;
  return { direction: item.direction!, status: item.status, retry: item.retry === true,
    groupReceiptError: item.groupReceiptError === INVALID_GROUP_RECEIPT ? INVALID_GROUP_RECEIPT : undefined,
    readers: parseGroupReaders(item.readers),
    confirmed: isReceiptStatus(item.confirmed) ? item.confirmed : undefined,
    attemptedAt: typeof item.attemptedAt === 'number' && Number.isFinite(item.attemptedAt) ? item.attemptedAt : undefined };
}

export function needsDeliveryWork(delivery?: LoungeDelivery) {
  if (!delivery || delivery.groupReceiptError) return false;
  return delivery.direction === 'outgoing' ? delivery.retry === true && delivery.status === 'pending'
    : receiptRank(delivery.status) > receiptRank(delivery.confirmed);
}

/** Multiple windows can share a local archive. A late write must not undo a received/read acknowledgement. */
export function mergeDelivery(previous: LoungeDelivery | undefined, incoming: LoungeDelivery | undefined) {
  if (!previous || !incoming || previous.direction !== incoming.direction) return incoming ?? previous;
  const rejected = previous.status === 'rejected' && incoming.status === 'pending';
  return { ...incoming,
    groupReceiptError: previous.groupReceiptError ?? incoming.groupReceiptError,
    readers: mergeGroupReaders(previous.readers, incoming.readers),
    status: rejected || receiptRank(previous.status) > receiptRank(incoming.status) ? previous.status : incoming.status,
    confirmed: receiptRank(previous.confirmed) > receiptRank(incoming.confirmed) ? previous.confirmed : incoming.confirmed,
    retry: previous.retry || incoming.retry,
    attemptedAt: Math.max(previous.attemptedAt ?? 0, incoming.attemptedAt ?? 0),
  };
}

export const deliveryLabel = (status: LoungeDelivery['status']) => ({
  pending: 'client.lounge.awaitingReceipt', delivered: 'client.lounge.delivered', read: 'client.lounge.read',
  rejected: 'client.lounge.awaitingReply',
} as const)[status];
