import { chunks } from './framing';
import type { ConnectionMode, RpcMessage } from './protocol';
import type { TransferProgress } from './uploadProgress';
import { attachmentUploadReporter } from './attachmentUploadProgress';

const MAX_QUEUED_MESSAGES = 512;
// The receiver allows eight partial assemblies. Reserve one for ordered events/requests.
const INTERLEAVED_RESPONSES = 4;
const UI_WORK_SLICE_MS = 8;
interface Pending {
  awaitingAck?: boolean;
  progress?: TransferProgress;
  parts: Generator<string>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** Share available capacity without letting an old history response block new replies. */
export class SendQueue {
  private readonly ordered: Pending[] = [];
  private readonly responses: Pending[] = [];
  private serial = 0;
  private running = false;
  private closed = false;

  constructor(private readonly transport: {
    capacity: () => Promise<void>; send: (part: string, delivered?: () => void) => void;
    acknowledgedResponses?: boolean;
    mode?: () => ConnectionMode;
    prefix?: string;
  }) {}

  send(message: RpcMessage, progress?: TransferProgress): Promise<void> {
    if (this.closed) return Promise.reject(new Error('电脑已断开连接。'));
    if (this.ordered.length + this.responses.length >= MAX_QUEUED_MESSAGES) {
      return Promise.reject(new Error('连接繁忙，请稍后重试。'));
    }
    const result = new Promise<void>((resolve, reject) => {
      const queue = message.kind === 'response' ? this.responses : this.ordered;
      const id = `${this.transport.prefix ?? ''}${++this.serial}`;
      let report = progress;
      const parts = chunks(message, id, this.transport.mode?.(), progress ? text => {
        report = attachmentUploadReporter(message, text, progress);
      } : undefined);
      queue.push({ parts, resolve, reject, progress: progress ? fraction => report?.(fraction) : undefined });
    });
    if (!this.running) void this.drain();
    return result;
  }

  private async drain() {
    this.running = true;
    let started = performance.now();
    try {
      while (!this.closed && (this.ordered.length || this.responses.length)) {
        await this.transport.capacity();
        if (this.closed) break;
        if (!this.sendNext()) break;
        // Yield only after actual CPU work, never impose a delay on every fragment.
        if (performance.now() - started >= UI_WORK_SLICE_MS) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          started = performance.now();
        }
      }
    } catch (error) {
      this.rejectPending(error);
    } finally { this.running = false; }
  }

  private sendNext() {
    const queue = this.ordered.length ? this.ordered : this.responses;
    const pending = queue === this.ordered ? queue[0]
      : queue.slice(0, INTERLEAVED_RESPONSES).find(entry => !entry.awaitingAck);
    if (!pending) return false;
    try {
      const part = pending.parts.next();
      if (part.done) { this.remove(queue, pending); pending.resolve(); return true; }
      const delivered = this.deliveryProgress(part.value, pending.progress);
      const tracked = queue === this.responses && this.transport.acknowledgedResponses;
      const frame = tracked ? JSON.parse(part.value) as { index: number; total: number } : undefined;
      // Enqueueing the last fragment does not free the receiver's assembly. Keep its slot
      // until cumulative delivery acknowledges it, including every earlier fragment.
      pending.awaitingAck = !!frame && frame.index === frame.total - 1;
      this.transport.send(part.value, pending.awaitingAck ? () => {
        delivered?.(); this.remove(queue, pending);
        if (!this.running && !this.closed) void this.drain();
      } : delivered);
      if (pending.awaitingAck) pending.resolve();
      if (queue === this.responses && queue.includes(pending)) {
        this.remove(queue, pending);
        queue.splice(Math.min(INTERLEAVED_RESPONSES - 1, queue.length), 0, pending);
      }
    } catch (error) { this.remove(queue, pending); pending.reject(error); }
    return true;
  }

  private remove(queue: Pending[], pending: Pending) {
    const index = queue.indexOf(pending);
    if (index !== -1) queue.splice(index, 1);
  }

  private deliveryProgress(part: string, progress?: TransferProgress) {
    if (!progress) return undefined;
    const { index, total } = JSON.parse(part) as { index: number; total: number };
    return () => progress((index + 1) / total);
  }

  private rejectPending(error: unknown) {
    for (const pending of [...this.ordered.splice(0), ...this.responses.splice(0)]) pending.reject(error);
  }

  close() {
    this.closed = true;
    this.rejectPending(new Error('电脑已断开连接。'));
  }
}
