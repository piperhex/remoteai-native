import type { LoungeHistoryStore } from './archive';
import type { LoungeMessage } from './types';

export interface LoungeDeletionPage { entries: Record<string, number>; next?: string }
const DELETION_PAGE_SIZE = 25;

export function parseDeletions(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-chat-deletions');
  const entries = Object.entries(value);
  if (entries.some(([peer, time]) => !peer || peer.length > 80
    || !Number.isSafeInteger(time) || Number(time) <= 0)) throw new Error('invalid-chat-deletions');
  return Object.fromEntries(entries) as Record<string, number>;
}

export function parseDeletionPage(value: unknown): LoungeDeletionPage {
  if (!value || typeof value !== 'object') throw new Error('invalid-deletion-page');
  const page = value as LoungeDeletionPage;
  const entries = parseDeletions(page.entries);
  const peers = Object.keys(entries);
  if (peers.length > DELETION_PAGE_SIZE || page.next !== undefined
    && (typeof page.next !== 'string' || !page.next || page.next !== peers.at(-1))) {
    throw new Error('invalid-deletion-page');
  }
  return { entries, next: page.next };
}

/** Account-local tombstones survive removal of the contact and merge by maximum deletion time. */
export class LoungeDeletions {
  private times: Record<string, number> = {};
  constructor(private readonly store?: LoungeHistoryStore) {}
  snapshot = () => ({ ...this.times });
  clear() { this.times = {}; }
  time(peer: string) { return Object.hasOwn(this.times, peer) ? this.times[peer] : 0; }
  async restore(current = () => true) {
    const times = parseDeletions(await this.store?.deletions?.() ?? {});
    if (current()) this.times = times;
  }
  remember(peer: string, deletedAt: number) { this.times = { ...this.times, [peer]: Math.max(this.time(peer), deletedAt) }; }
  accepts(message: LoungeMessage) {
    return !message.conversation || Date.parse(message.sentAt) > this.time(message.conversation);
  }
  page(after = ''): LoungeDeletionPage {
    const peers = Object.keys(this.times).sort().filter(peer => peer > after);
    const selected = peers.slice(0, DELETION_PAGE_SIZE);
    return { entries: Object.fromEntries(selected.map(peer => [peer, this.times[peer]])),
      ...(peers.length > selected.length ? { next: selected.at(-1) } : {}) };
  }
}
