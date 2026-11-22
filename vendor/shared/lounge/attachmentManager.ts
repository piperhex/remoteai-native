import { AttachmentConnection } from './attachmentConnection';
import { authorize } from './authorize';
import { ATTACHMENT_CHUNK_BYTES, MAX_ATTACHMENTS, checkAttachmentSize, parseAttachments, type AttachmentSource,
  type AttachmentSink, type LoungeAttachment } from './attachments';
import type { LoungeDraft, LoungeMessage, LoungeSession } from './types';
import { imageAttachmentSource } from './imageAttachmentSource';

export class LoungeAttachmentManager {
  private readonly pendingImages = new Map<string, Promise<string>>();
  private readonly sources = new Map<string, { source: AttachmentSource; peer?: string; sentAt?: number }>();
  private readonly connection?: AttachmentConnection;
  private available = false;
  constructor(private readonly options: { session?: LoungeSession; randomId: () => string }) {
    const { session, randomId } = options;
    this.device = randomId();
    if (session?.sync) this.connection = new AttachmentConnection({ baseUrl: session.baseUrl,
      deviceId: this.device, transport: session.sync, authorize: () => authorize(session),
      source: id => this.source(id) });
  }
  readonly device: string;
  retryNow() { this.connection?.retryNow(); }
  private async source(id: string) {
    return this.sources.get(id)?.source ?? await this.options.session?.attachmentImages?.source?.(id);
  }
  /** The app binds its persistent download manager for the lifetime of the signed-in lounge. */
  enqueue?: (file: LoungeAttachment) => Promise<string>;
  async openReader(file: LoungeAttachment, signal?: AbortSignal) {
    const source = await this.source(file.id);
    if (signal?.aborted) throw new Error('client.lounge.fileUnavailable');
    if (source) return { read: source.read, close: () => {} };
    const connection = this.connection;
    if (!connection) throw new Error('client.lounge.fileUnavailable');
    const peer = await connection.open(file, signal);
    const close = () => { signal?.removeEventListener('abort', close); connection.release(peer); };
    signal?.addEventListener('abort', close, { once: true });
    if (signal?.aborted) { close(); throw new Error('client.lounge.fileUnavailable'); }
    return { read: (offset: number, length: number) => peer.exchange.read(offset, length), close };
  }
  image(file: LoungeAttachment): Promise<string> {
    const previous = this.pendingImages.get(file.id);
    if (previous) return previous;
    const store = this.options.session?.attachmentImages;
    if (!store) return Promise.reject(new Error('client.lounge.fileUnavailable'));
    const pending = (async () => {
      const cached = await store.get(file.id);
      if (cached) return cached;
      const sink = await store.sink(file);
      const uri = await this.download(file, sink);
      try { await store.put(file.id, uri); }
      catch (error) { await sink.abort(); throw error; }
      return uri;
    })().finally(() => {
      // The durable store owns completed images. Browser stores can return a full data URL here.
      if (this.pendingImages.get(file.id) === pending) this.pendingImages.delete(file.id);
    });
    this.pendingImages.set(file.id, pending);
    return pending;
  }
  prefetch(files?: LoungeAttachment[]) {
    for (const file of files ?? []) if (file.kind === 'image') {
      // The image card exposes retry when a sender goes offline or local storage is unavailable.
      void this.image(file).catch(() => {});
    }
  }
  ready(available: boolean) {
    this.available = available && !!this.connection;
    if (this.available) this.connection?.start();
    else this.connection?.stop();
  }
  prepare(draft: LoungeDraft): LoungeDraft {
    const { files = [], ...rest } = draft;
    if (!files.length && !draft.images.length) return rest;
    if (!this.available) {
      if (files.length) throw new Error('client.lounge.fileUnavailable');
      return rest;
    }
    const images = draft.images.map(imageAttachmentSource);
    if (images.length + files.length + (rest.attachments?.length ?? 0) > MAX_ATTACHMENTS) {
      throw new Error('client.lounge.attachmentLimit');
    }
    const prepared: { file: LoungeAttachment; source: AttachmentSource }[] = [];
    for (const [source, kind] of [...images.map(source => [source, 'image'] as const),
      ...files.map(source => [source, 'file'] as const)]) {
      checkAttachmentSize(source, kind, draft.to);
      const id = this.options.randomId();
      const file: LoungeAttachment = { id, device: this.device, name: source.name,
        mime: source.mime, size: source.size, kind };
      if (!parseAttachments([file])) throw new Error('client.lounge.fileUnavailable');
      prepared.push({ file, source });
    }
    for (const { file, source } of prepared) this.sources.set(file.id, { source });
    return { ...rest, attachments: [...(rest.attachments ?? []), ...prepared.map(({ file }) => file)], images: [] };
  }
  async persistImages(files: LoungeAttachment[], created: LoungeAttachment[] = []) {
    // Persist outgoing images before publication, including when the sender leaves the conversation immediately.
    const store = this.options.session?.attachmentImages;
    if (!store) return;
    const results = await Promise.allSettled(files.filter(file => file.kind === 'image').map(async file => {
      await this.image(file);
      if (store.source) this.sources.delete(file.id);
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      await Promise.all(created.filter(file => file.kind === 'image').map(file => store.remove?.(file.id)));
      throw failure.reason;
    }
  }
  discardUnpublished(files: LoungeAttachment[]) {
    for (const file of files) if (this.sources.get(file.id)?.sentAt === undefined) this.sources.delete(file.id);
  }
  published(message: Pick<LoungeMessage, 'attachments' | 'conversation' | 'sentAt'>) {
    for (const file of message.attachments ?? []) {
      const entry = this.sources.get(file.id);
      if (entry && entry.sentAt === undefined && file.device === this.device) {
        entry.peer = message.conversation; entry.sentAt = Date.parse(message.sentAt);
      }
    }
  }
  removeBefore(peer: string, deletedAt: number) {
    for (const [id, entry] of this.sources) {
      if (entry.peer === peer && entry.sentAt !== undefined && entry.sentAt <= deletedAt) this.sources.delete(id);
    }
  }
  async download(file: LoungeAttachment, sink: AttachmentSink, options: {
    signal?: AbortSignal; progress?: (fraction: number) => void;
  } = {}) {
    const source = await this.source(file.id).catch(async error => { await sink.abort(); throw error; });
    if (source) {
      try {
        if (options.signal?.aborted) throw new Error('client.lounge.fileUnavailable');
        for (let offset = 0; offset < source.size; offset += ATTACHMENT_CHUNK_BYTES) {
          if (options.signal?.aborted) throw new Error('client.lounge.fileUnavailable');
          const size = Math.min(ATTACHMENT_CHUNK_BYTES, source.size - offset);
          await sink.write(await source.read(offset, size)); options.progress?.((offset + size) / source.size);
        }
        if (options.signal?.aborted) throw new Error('client.lounge.fileUnavailable');
        return await sink.finish();
      } catch (error) { await sink.abort(); throw error; }
    }
    if (!this.connection) { await sink.abort(); throw new Error('client.lounge.fileUnavailable'); }
    const peer = await this.connection.open(file, options.signal).catch(async error => { await sink.abort(); throw error; });
    try { return await peer.exchange.download(file, sink, options); }
    finally { this.connection.release(peer); }
  }
  stop() { this.connection?.stop(); this.available = false; this.sources.clear(); this.pendingImages.clear(); }
}
