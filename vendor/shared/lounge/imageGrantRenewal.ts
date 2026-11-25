import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { LoungeAttachment } from './attachments';
import type { LoungeMessage } from './types';

const RENEW_MS = 10_000;
const proof = (grant: string) => bytesToHex(sha256(utf8ToBytes(grant)));
export class InvalidImageGrant extends Error {}

interface Pending {
  owner: string; messageId: string; fileId: string; complete(grant?: string): void;
}

export class ImageGrantRenewal {
  private pending = new Map<string, Pending>();
  constructor(private readonly host: {
    self: () => string | undefined; randomId: () => string;
    find: (key: string) => Promise<LoungeMessage | undefined>;
    send: (frame: Record<string, unknown>) => boolean;
  }) {}

  request(message: LoungeMessage, file: LoungeAttachment): Promise<string> {
    const id = this.host.randomId();
    return new Promise((resolve, reject) => {
      const complete = (grant?: string) => {
        this.pending.delete(id); clearTimeout(timer);
        if (grant) resolve(grant); else reject(new Error('client.lounge.fileUnavailable'));
      };
      const timer = setTimeout(complete, RENEW_MS);
      const owner = message.sender.id;
      this.pending.set(id, { owner, messageId: message.id, fileId: file.id, complete });
      if (!this.host.send({ type: 'image-grant-request', id, to: owner, messageId: message.id,
        fileId: file.id, proof: proof(file.grant ?? '') })) complete();
    });
  }

  receive(frame: Record<string, unknown>) {
    if (frame.type === 'image-grant-request') {
      // A failed archive read cannot authorize an image.
      void this.approve(frame).catch(() => {}); return true;
    }
    if (frame.type !== 'image-grant') return false;
    const pending = this.pending.get(String(frame.id));
    if (pending && pending.owner === frame.from && pending.messageId === frame.messageId
      && pending.fileId === frame.fileId && typeof frame.grant === 'string' && frame.grant.length <= 8192) {
      pending.complete(frame.grant);
    }
    return true;
  }

  private async approve(frame: Record<string, unknown>) {
    const self = this.host.self();
    if (!self || typeof frame.from !== 'string' || typeof frame.messageId !== 'string') return;
    const message = await this.host.find(JSON.stringify([self, frame.messageId]));
    if (this.host.self() !== self || message?.sender.id !== self) return;
    const file = message.attachments?.find(item => item.id === frame.fileId && item.kind === 'image');
    if (!file) return;
    if (message.recipient) {
      if (frame.from !== self && frame.from !== message.recipient.id) return;
    } else if (!file.grant || frame.proof !== proof(file.grant)) return;
    this.host.send({ type: 'image-grant-approve', id: frame.id, to: frame.from, messageId: message.id,
      fileId: file.id, attachments: [{ ...file, grant: undefined }], conversation: message.recipient?.id ?? '',
      generation: message.generation ?? 0 });
  }

  disconnect() { for (const request of this.pending.values()) request.complete(); }
}
