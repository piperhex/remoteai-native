import { DIRECTORY_SCHEMA, sameDirectory, validCheckpoint, type DirectoryBatch, type DirectoryCheckpoint,
  type DirectoryEntry, type DirectoryRemoval, type DirectoryReply, type DirectorySnapshot } from './protocol';

const DEFAULT_LOG_ENTRIES = 512;
const DEFAULT_LOG_BYTES = 2 * 1024 * 1024;
interface JournalOptions { epoch: string; stream: string; scope: string; maxEntries?: number; maxBytes?: number }

/** State and its log advance synchronously; callers perform I/O before this commit boundary. */
export class DirectoryJournal<T extends DirectoryEntry> {
  readonly entries = new Map<string, T>();
  private revision = 0;
  private bytes = 0;
  private log: { batch: DirectoryBatch<T>; bytes: number }[] = [];
  constructor(private readonly options: JournalOptions) {}

  checkpoint = (): DirectoryCheckpoint => ({ schema: DIRECTORY_SCHEMA, epoch: this.options.epoch,
    stream: this.options.stream, scope: this.options.scope, revision: this.revision });
  snapshot = (): DirectorySnapshot<T> => ({ kind: 'snapshot', checkpoint: this.checkpoint(),
    entries: [...this.entries.values()] });

  commit(upserts: T[], removals: DirectoryRemoval[] = []): DirectoryBatch<T> | undefined {
    const incoming = new Map(upserts.map(entry => [entry.key, entry]));
    const removed = removals.filter(entry => !incoming.has(entry.key) && this.entries.has(entry.key));
    const changed = [...incoming.values()].filter(entry =>
      JSON.stringify(entry) !== JSON.stringify(this.entries.get(entry.key)));
    if (!changed.length && !removed.length) return;
    const from = this.revision++;
    for (const entry of removed) this.entries.delete(entry.key);
    for (const entry of changed) this.entries.set(entry.key, entry);
    const batch: DirectoryBatch<T> = { kind: 'changes', from, checkpoint: this.checkpoint(),
      upserts: changed, removals: removed };
    const bytes = new TextEncoder().encode(JSON.stringify(batch)).byteLength;
    this.log.push({ batch, bytes });
    this.bytes += bytes;
    while (this.log.length > (this.options.maxEntries ?? DEFAULT_LOG_ENTRIES)
      || this.bytes > (this.options.maxBytes ?? DEFAULT_LOG_BYTES)) this.bytes -= this.log.shift()!.bytes;
    return batch;
  }

  resume(checkpoint: DirectoryCheckpoint): DirectoryReply<T> {
    const current = this.checkpoint();
    const oldest = this.log[0]?.batch.from ?? current.revision;
    if (!validCheckpoint(checkpoint) || !sameDirectory(checkpoint, current)
      || checkpoint.revision > current.revision || checkpoint.revision < oldest) return { kind: 'resetRequired' };
    const upserts = new Map<string, T>();
    const removals = new Map<string, DirectoryRemoval>();
    for (const { batch } of this.log) {
      if (batch.checkpoint.revision <= checkpoint.revision) continue;
      for (const entry of batch.removals) { upserts.delete(entry.key); removals.set(entry.key, entry); }
      for (const entry of batch.upserts) { removals.delete(entry.key); upserts.set(entry.key, entry); }
    }
    return { kind: 'changes', from: checkpoint.revision, checkpoint: current,
      upserts: [...upserts.values()], removals: [...removals.values()] };
  }
}
