import { sameDirectory, validCheckpoint, type DirectoryBatch, type DirectoryEntry,
  type DirectoryReply, type DirectorySnapshot } from './protocol';

/** Only successfully applied coverage advances the cursor. Overlapping replay is idempotent. */
export class DirectoryReplica<T extends DirectoryEntry> {
  private value?: DirectorySnapshot<T>;
  private entries = new Map<string, T>();
  get snapshot() { return this.value; }

  restore(snapshot: DirectorySnapshot<T>, validate: (entry: unknown) => entry is T): boolean {
    if (snapshot?.kind !== 'snapshot' || !validCheckpoint(snapshot.checkpoint)
      || !Array.isArray(snapshot.entries) || !snapshot.entries.every(validate)
      || new Set(snapshot.entries.map(entry => entry.key)).size !== snapshot.entries.length) return false;
    this.entries = new Map(snapshot.entries.map(entry => [entry.key, entry]));
    this.value = snapshot;
    return true;
  }

  apply(reply: DirectoryReply<T>): 'applied' | 'duplicate' | 'resetRequired' {
    if (!reply || typeof reply !== 'object') return 'resetRequired';
    if (reply.kind === 'resetRequired') return 'resetRequired';
    if (!validCheckpoint(reply.checkpoint)) return 'resetRequired';
    if (reply.kind === 'snapshot') {
      if (!Array.isArray(reply.entries) || !reply.entries.every(entry => entry && typeof entry.key === 'string')) {
        return 'resetRequired';
      }
      if (this.value && sameDirectory(this.value.checkpoint, reply.checkpoint)
        && this.value.checkpoint.revision >= reply.checkpoint.revision) return 'duplicate';
      this.entries = new Map(reply.entries.map(entry => [entry.key, entry]));
      this.value = reply;
      return 'applied';
    }
    if (reply.kind !== 'changes' || !Array.isArray(reply.upserts) || !Array.isArray(reply.removals)
      || !Number.isSafeInteger(reply.from) || reply.from < 0) return 'resetRequired';
    return this.changes(reply);
  }

  private changes(batch: DirectoryBatch<T>): 'applied' | 'duplicate' | 'resetRequired' {
    const checkpoint = this.value?.checkpoint;
    if (!checkpoint || !sameDirectory(checkpoint, batch.checkpoint)) return 'resetRequired';
    if (batch.checkpoint.revision <= checkpoint.revision) return 'duplicate';
    // A batch covers (from, checkpoint], including any filtered or coalesced sequence numbers.
    if (batch.from > checkpoint.revision || batch.from > batch.checkpoint.revision) return 'resetRequired';
    for (const entry of batch.removals) this.entries.delete(entry.key);
    for (const entry of batch.upserts) this.entries.set(entry.key, entry);
    this.value = { kind: 'snapshot', checkpoint: batch.checkpoint, entries: [...this.entries.values()] };
    return 'applied';
  }
}
