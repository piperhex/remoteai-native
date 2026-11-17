import { DirectoryReplica } from '../chat/directory/replica';
import { DirectoryWriter, readDirectoryValue } from '../chat/directory/storage';
import { sameDirectory, type DirectoryReply, type DirectorySnapshot } from '../chat/directory/protocol';
import { cliKey, cliScope } from './summary';
import type { CliChange, CliDirectoryEntry, CliSession, CliTransport, ExternalEngine } from './types';

interface Query { engine: ExternalEngine; archived: boolean; search: string }
interface View { query: Query; replica: DirectoryReplica<CliDirectoryEntry>;
  pending?: Promise<void>; buffered: NonNullable<CliChange['batch']>[] }

export class CliListDirectory {
  private views = new Map<string, View>();
  private writer?: DirectoryWriter;
  private restored?: Promise<void>;
  private generation = 0;
  constructor(private readonly context: { transport: CliTransport;
    apply: (query: Query, sessions: CliSession[], more: boolean) => void; failed: (error: unknown) => void }) {
    if (context.transport.directoryStorage) this.writer = new DirectoryWriter(context.transport.directoryStorage,
      () => context.failed(new Error('client.cliGui.requestFailed')));
  }
  disconnect() { this.generation++; }

  async read(query: Query, more = false) {
    const generation = this.generation;
    this.restored ??= this.restore(); await this.restored;
    if (generation !== this.generation) return;
    const scope = cliScope(query.engine, query.archived, query.search);
    let view = this.views.get(scope);
    if (!view) {
      view = { query, replica: new DirectoryReplica(), buffered: [] };
      if (this.views.size >= 8) this.views.delete(this.views.keys().next().value!);
      this.views.set(scope, view);
    }
    if (view.pending) return view.pending;
    const pending = this.synchronize(view, more).finally(() => { if (view!.pending === pending) view!.pending = undefined; });
    view.pending = pending; return pending;
  }

  private async synchronize(view: View, more: boolean) {
    const generation = this.generation;
    let checkpoint = view.replica.snapshot?.checkpoint;
    const request = () => this.context.transport.request<DirectoryReply<CliDirectoryEntry>>({
      action: 'syncList', ...view.query, more: more && !!checkpoint, checkpoint });
    let result = await request();
    if (generation !== this.generation) return;
    if (result.kind === 'resetRequired') {
      checkpoint = undefined; view.replica = new DirectoryReplica(); view.buffered = [];
      result = await request();
    }
    if (generation !== this.generation) return;
    if (view.replica.apply(result) === 'resetRequired') throw new Error('client.cliGui.requestFailed');
    if (!checkpoint) {
      checkpoint = view.replica.snapshot!.checkpoint;
      const tail = await this.context.transport.request<DirectoryReply<CliDirectoryEntry>>({
        action: 'syncList', ...view.query, checkpoint });
      if (generation !== this.generation) return;
      if (view.replica.apply(tail) === 'resetRequired') throw new Error('client.cliGui.requestFailed');
    }
    for (const batch of view.buffered.splice(0).sort((a, b) => a.checkpoint.revision - b.checkpoint.revision)) {
      if (!sameDirectory(batch.checkpoint, view.replica.snapshot!.checkpoint)) continue;
      if (view.replica.apply(batch) === 'resetRequired') throw new Error('client.cliGui.requestFailed');
    }
    this.publish(view);
  }

  receive(change: CliChange) {
    if (!change.batch) return;
    const view = this.views.get(change.batch.checkpoint.scope);
    if (!view) return;
    if (view.pending) { view.buffered.push(change.batch); return; }
    const applied = view.replica.apply(change.batch);
    if (applied === 'duplicate') return;
    if (applied === 'resetRequired') { void this.read(view.query).catch(this.context.failed); return; }
    this.publish(view);
  }

  private publish(view: View) {
    const entries = view.replica.snapshot!.entries;
    const sessions = entries.flatMap(entry => entry.kind === 'session' ? [entry.value] : []);
    const page = entries.find(entry => entry.kind === 'page');
    this.context.apply(view.query, sessions, page?.kind === 'page' && !page.complete);
    this.writer?.write('cli', [...this.views.values()].filter(entry => entry.replica.snapshot)
      .map(entry => ({ query: entry.query, snapshot: entry.replica.snapshot })));
  }

  private async restore() {
    try {
      const raw = await this.context.transport.directoryStorage?.read('cli');
      if (!raw) return;
      const saved = readDirectoryValue<{ query: Query; snapshot: DirectorySnapshot<CliDirectoryEntry> }[]>(raw);
      if (!Array.isArray(saved) || saved.length > 8) return;
      for (const { query, snapshot } of saved) {
        const replica = new DirectoryReplica<CliDirectoryEntry>();
        if (!replica.restore(snapshot, validEntry) || !snapshot.entries.some(entry => entry.kind === 'page')
          || snapshot.checkpoint.scope !== cliScope(query.engine, query.archived, query.search)) continue;
        this.views.set(snapshot.checkpoint.scope, { query, replica, buffered: [] });
      }
    } catch (error) { this.context.failed(error); }
  }
}

function validEntry(value: unknown): value is CliDirectoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as CliDirectoryEntry;
  if (entry.kind === 'page') return entry.key === '@page' && typeof entry.complete === 'boolean'
    && (entry.cursor === null || typeof entry.cursor === 'string');
  if (entry.kind !== 'session' || !entry.value) return false;
  const session = entry.value;
  return ['claude', 'gemini'].includes(session.engine) && typeof session.id === 'string'
    && entry.key === cliKey(session) && typeof session.title === 'string' && typeof session.cwd === 'string'
    && typeof session.archived === 'boolean' && typeof session.updatedAt === 'string' && Array.isArray(session.permissions);
}
