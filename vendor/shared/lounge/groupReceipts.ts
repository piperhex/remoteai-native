import { parseAccount } from './contacts';
import type { LoungeDelivery } from './delivery';
import type { LoungeAccount, LoungeMessage } from './types';

export const MAX_GROUP_RECEIPT_LENGTH = 2048;

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
