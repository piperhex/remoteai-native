import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { LoungeDraft } from './types';
import type { LoungeAttachmentManager } from './attachmentManager';

export interface GroupAttempt { id: string; device: string; imageIds: string[] }
export interface GroupAttemptStore {
  claim(key: string, candidate: GroupAttempt): Promise<GroupAttempt>;
  finish(key: string, id: string): Promise<void>;
}

export function groupDraftKey(draft: LoungeDraft) {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify([draft.text, draft.images, draft.reply, draft.attachments]))));
}

/** A timeout or disconnect after socket.send leaves the result unknown. */
export class UnconfirmedGroupSend extends Error {
  constructor() { super('client.lounge.sendFailed'); }
}

export class LoungeGroupSender {
  private readonly attempts = new Map<string, GroupAttempt>();
  private readonly sending = new Set<string>();
  constructor(private readonly host: {
    store?: GroupAttemptStore; attachments: LoungeAttachmentManager; randomId(): string;
    submit(draft: LoungeDraft, id: string, retry: boolean): Promise<void>;
  }) {}

  async send(input: LoungeDraft, current: () => boolean) {
    const key = groupDraftKey(input);
    if (this.sending.has(key)) throw new Error('client.lounge.sendFailed');
    this.sending.add(key);
    try { await this.trySend(input, key, current); }
    finally { this.sending.delete(key); }
  }

  private async trySend(input: LoungeDraft, key: string, current: () => boolean) {
    const { store, attachments } = this.host;
    const candidate = { id: this.host.randomId(), device: attachments.device,
      imageIds: attachments.groupImageIds(input.images.length) };
    const attempt = store ? await store.claim(key, candidate) : this.attempts.get(key) ?? candidate;
    const retry = attempt.id !== candidate.id;
    if (!store) this.attempts.set(key, attempt);
    const finish = () => store ? store.finish(key, attempt.id) : this.attempts.delete(key);
    try {
      if (!current()) throw new Error('client.lounge.sendFailed');
      const draft = attachments.prepare(input, attempt);
      if (draft.attachments?.length) await attachments.persistImages(draft.attachments);
      if (!current()) throw new Error('client.lounge.sendFailed');
      await this.host.submit(draft, attempt.id, retry);
    } catch (error) {
      // A rejected retry cannot establish whether the original copy reached other clients.
      if (!retry && !(error instanceof UnconfirmedGroupSend)) await finish();
      throw error;
    }
    await finish();
  }
}
