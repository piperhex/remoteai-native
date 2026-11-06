import { parseAccount } from './contacts';
import type { LoungeDelivery } from './delivery';
import type { LoungeAccount, LoungeMessage } from './types';

export const MAX_GROUP_RECEIPT_LENGTH = 2048;
export const INVALID_GROUP_RECEIPT = 'invalid-group-receipt';

export interface GroupReceiptRejection {
  type: 'group-receipt-rejected';
  code: typeof INVALID_GROUP_RECEIPT;
  receiptType: 'group-read' | 'group-read-confirm';
  id: string; from: string; to: string; groupReceipt: string;
}

export function parseGroupReceipt(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_GROUP_RECEIPT_LENGTH ? value : undefined;
}

export function parseGroupReaders(value: unknown): LoungeAccount[] | undefined {
  if (!Array.isArray(value)) return;
  const readers = value.map(parseAccount);
  if (readers.some(reader => !reader)) return;
  return mergeGroupReaders([], readers as LoungeAccount[]);
}

export function mergeGroupReaders(previous?: LoungeAccount[], incoming?: LoungeAccount[]) {
  if (!previous && !incoming) return;
  return [...new Map([...(previous ?? []), ...(incoming ?? [])].map(reader => [reader.id, reader])).values()];
}

export function initialGroupDelivery(message: LoungeMessage, self: string): LoungeDelivery | undefined {
  if (message.recipient || !message.groupReceipt) return;
  return message.sender.id === self
    ? { direction: 'outgoing', status: 'delivered', readers: [] }
    : { direction: 'incoming', status: 'delivered', confirmed: 'delivered' };
}

export function applyGroupReceipt(options: {
  message: LoungeMessage; frame: Record<string, unknown>; self: LoungeAccount;
}): LoungeMessage | undefined {
  const { message, frame, self } = options;
  if (message.recipient || !message.groupReceipt || frame.groupReceipt !== message.groupReceipt) return;
  if (frame.type === 'group-receipt-rejected') return rejectGroupReceipt(options);
  if (message.delivery?.groupReceiptError) return;
  if (frame.type === 'group-read-confirm') {
    if (message.sender.id !== frame.from || message.delivery?.direction !== 'incoming'
      || message.delivery.status !== 'read') return;
    return { ...message, delivery: { ...message.delivery, confirmed: 'read' } };
  }
  const reader = parseAccount(frame.reader);
  if (!self.moderator || message.sender.id !== self.id || !reader || reader.id !== frame.from
    || reader.id === self.id || message.delivery?.direction !== 'outgoing') return;
  return { ...message, delivery: { ...message.delivery, status: 'read',
    readers: mergeGroupReaders(message.delivery.readers, [reader]) } };
}

function rejectGroupReceipt(options: {
  message: LoungeMessage; frame: Record<string, unknown>; self: LoungeAccount;
}): LoungeMessage | undefined {
  const { message, frame, self } = options;
  if (!message.delivery || frame.code !== INVALID_GROUP_RECEIPT || frame.to !== self.id
    || frame.id !== message.id || typeof frame.from !== 'string' || frame.from === self.id) return;
  const incoming = frame.receiptType === 'group-read' && message.delivery.direction === 'incoming'
    && message.sender.id === frame.from;
  const outgoing = frame.receiptType === 'group-read-confirm' && message.delivery.direction === 'outgoing'
    && message.sender.id === self.id;
  if (!incoming && !outgoing) return;
  return { ...message, delivery: { ...message.delivery, groupReceiptError: INVALID_GROUP_RECEIPT } };
}
