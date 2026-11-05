import { queueTextPreview, type QueueDraft, type QueueMessage, type QueueSnapshot } from '../queue';
import type { ComposerSettings } from '../composer';
import type { SendInput, Thread } from './types';

const MAX_LOCAL_MESSAGES = 100;

export interface OutboxTarget {
  scope: string;
  thread: Thread | null;
  cwd?: string;
  selectionGeneration: number;
  synchronization: number;
}

export interface OutboxMessage {
  id: string;
  target: OutboxTarget;
  input: SendInput;
  settings: ComposerSettings;
  busy: boolean;
  error?: string;
}

/** Own the complete draft until the PC acknowledges it; never replay an uncertain submission. */
export class LocalOutbox {
  private sequence = 0;
  private readonly prefix = `local-outbox:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  private messages: OutboxMessage[] = [];
  private readonly acknowledged = new WeakSet<OutboxMessage>();
  private running = false;
  constructor(private readonly host: {
    deliver: (message: OutboxMessage) => Promise<void>;
    changed: (queues: Record<string, QueueMessage[]>) => void;
  }) {}

  enqueue(target: OutboxTarget, input: SendInput, settings: ComposerSettings) {
    if (this.messages.length >= MAX_LOCAL_MESSAGES) return false;
    const previous = this.messages.find(message => message.target.scope === target.scope
      || (target.thread && message.target.thread?.id === target.thread.id));
    this.messages.push({ id: `${this.prefix}:${++this.sequence}`, target: previous?.target ?? target,
      input: { ...input, images: [...(input.images ?? [])], skills: input.skills?.map(skill => ({ ...skill })),
        attachments: input.attachments?.map(attachment => ({ ...attachment })) }, settings: { ...settings },
      busy: !previous?.error, error: previous?.error });
    this.publish();
    void this.drain();
    return true;
  }

  has(id: string) { return this.messages.some(message => message.id === id); }

  observe(queue: QueueSnapshot) {
    const receipts = new Set(Object.values(queue.threads).flatMap(messages => messages.map(message => message.clientId)));
    for (const message of this.messages) {
      if (receipts.has(message.id)) this.acknowledged.add(message);
    }
  }

  remove(id: string): QueueDraft | undefined {
    const message = this.messages.find(entry => entry.id === id);
    if (!message || message.busy) return;
    this.messages = this.messages.filter(entry => entry !== message);
    this.publish();
    return { ...message.input, images: message.input.images ?? [], skills: message.input.skills ?? [] };
  }

  private publish() {
    const queues: Record<string, QueueMessage[]> = {};
    for (const message of this.messages) {
      const { input, target } = message;
      (queues[target.scope] ??= []).push({ id: message.id,
        text: queueTextPreview(input.text || input.attachments?.map(file => file.name).join('、') || ''),
        imageCount: input.images?.length ?? 0, attachmentCount: input.attachments?.length ?? 0,
        busy: message.busy, error: message.error, local: true });
    }
    for (const { target } of this.messages) {
      if (target.thread && target.thread.id !== target.scope) queues[target.thread.id] = queues[target.scope];
    }
    this.host.changed(queues);
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (let message = this.messages.find(entry => entry.busy); message;
        message = this.messages.find(entry => entry.busy)) {
        try {
          await this.host.deliver(message);
          this.messages = this.messages.filter(entry => entry !== message);
        } catch (error) {
          this.failed(message, error);
        }
        this.publish();
      }
    } finally { this.running = false; }
  }

  private failed(message: OutboxMessage, error: unknown) {
    // The PC may broadcast acceptance, then lose the RPC response. Keep its authoritative queue entry.
    if (this.acknowledged.has(message)) {
      this.messages = this.messages.filter(entry => entry !== message);
      return;
    }
    for (const pending of this.messages.filter(entry => entry.target === message.target)) {
      pending.busy = false;
      pending.error = error instanceof Error ? error.message : String(error);
    }
  }
}
