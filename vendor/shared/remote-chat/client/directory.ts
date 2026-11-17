import { DirectoryReplica } from '../../chat/directory/replica';
import { DirectoryIcons, DIRECTORY_ICON_PREFIX } from '../../chat/directory/icons';
import { DirectoryWriter, readDirectoryValue, type DirectoryStorage } from '../../chat/directory/storage';
import { directoryScope, projectDirectory, validChatDirectoryEntry,
  type ChatDirectoryEntry, type DirectoryQuery } from '../../chat/directory/documents';
import { DIRECTORY_OPERATION, sameDirectory, type DirectoryBatch, type DirectoryEvent,
  type DirectoryReply, type DirectorySnapshot } from '../../chat/directory/protocol';
import { CONNECTION_ERRORS } from '../connectionErrors';

type Projection = ReturnType<typeof projectDirectory>;
interface Context {
  request: <T>(body: object) => Promise<T>;
  apply: (query: DirectoryQuery, projection: Projection) => void;
  failed: () => void;
}
interface View {
  replica: DirectoryReplica<ChatDirectoryEntry>;
  query: DirectoryQuery;
  pending?: Promise<Projection>;
  invalidated?: boolean;
  buffered: DirectoryBatch<ChatDirectoryEntry>[];
  projected?: { snapshot: DirectorySnapshot<ChatDirectoryEntry>; icons: number; value: Projection };
}
const MAX_CACHED_VIEWS = 8;

export class RemoteDirectory {
  private listeners = new Set<(query: DirectoryQuery, projection: Projection) => void>();
  subscribe = (listener: (query: DirectoryQuery, projection: Projection) => void) => {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  enabled = false;
  private views = new Map<string, View>();
  private icons = new DirectoryIcons();
  private iconRequests = new Map<string, Promise<void>>();
  private store?: DirectoryStorage;
  private writer?: DirectoryWriter;
  private generation = 0;
  private restored?: Promise<void>;
  constructor(private readonly context: Context) {}

  set storage(store: DirectoryStorage | undefined) {
    this.disconnect(); this.views.clear(); this.icons = new DirectoryIcons(); this.restored = undefined;
    this.store = store;
    this.writer = store ? new DirectoryWriter(store, this.context.failed) : undefined;
  }
  flush = () => this.writer?.flush() ?? Promise.resolve();
  disconnect() { this.generation++; }

  async read(query: DirectoryQuery, more = false, force = false): Promise<Projection> {
    const generation = this.generation;
    this.restored ??= this.restore();
    await this.restored;
    if (generation !== this.generation) throw new Error(CONNECTION_ERRORS.interrupted);
    const scope = directoryScope(query);
    let view = this.views.get(scope);
    if (!view) {
      view = { query, replica: new DirectoryReplica(), buffered: [] };
      if (this.views.size >= MAX_CACHED_VIEWS) this.views.delete(this.views.keys().next().value!);
      this.views.set(scope, view);
    }
    if (view.pending) return view.pending;
    const pending = this.synchronize(view, { more, force, generation }).finally(() => {
      if (view!.pending === pending) view!.pending = undefined;
      if (view!.invalidated && generation === this.generation) {
        view!.invalidated = false;
        void this.read(view!.query).catch(this.context.failed);
      }
    });
    view.pending = pending;
    return pending;
  }

  private async synchronize(view: View, options: { more: boolean; force: boolean; generation: number }): Promise<Projection> {
    const { more, force, generation } = options;
    let checkpoint = view.replica.snapshot?.checkpoint;
    let reply = await this.context.request<DirectoryReply<ChatDirectoryEntry>>({ operation: DIRECTORY_OPERATION,
      action: more && checkpoint ? 'page' : 'sync', query: view.query, checkpoint, ...(force ? { force: true } : {}) });
    if (generation !== this.generation) throw new Error(CONNECTION_ERRORS.interrupted);
    if (reply.kind === 'resetRequired') {
      view.replica = new DirectoryReplica(); view.buffered = []; checkpoint = undefined;
      reply = await this.context.request<DirectoryReply<ChatDirectoryEntry>>({ operation: DIRECTORY_OPERATION,
        action: 'sync', query: view.query });
    }
    if (generation !== this.generation) throw new Error(CONNECTION_ERRORS.interrupted);
    if (view.replica.apply(reply) === 'resetRequired') throw new Error(CONNECTION_ERRORS.invalid);
    if (!checkpoint || reply.kind === 'snapshot') {
      // Register the stream, then cover the snapshot/registration interval up to a definite high-water.
      const tail = await this.context.request<DirectoryReply<ChatDirectoryEntry>>({ operation: DIRECTORY_OPERATION,
        action: 'sync', query: view.query, checkpoint: view.replica.snapshot!.checkpoint });
      if (generation !== this.generation) throw new Error(CONNECTION_ERRORS.interrupted);
      if (view.replica.apply(tail) === 'resetRequired') throw new Error(CONNECTION_ERRORS.interrupted);
    }
    await this.loadIcons(view);
    if (generation !== this.generation) throw new Error(CONNECTION_ERRORS.interrupted);
    const buffered = view.buffered.splice(0).sort((a, b) => a.checkpoint.revision - b.checkpoint.revision);
    for (const batch of buffered) {
      if (!sameDirectory(batch.checkpoint, view.replica.snapshot!.checkpoint)) continue;
      if (view.replica.apply(batch) === 'resetRequired') throw new Error(CONNECTION_ERRORS.interrupted);
    }
    return this.publish(view);
  }

  receive(batch: DirectoryEvent<ChatDirectoryEntry>) {
    if (!this.enabled || !batch?.checkpoint) return;
    const view = this.views.get(batch.checkpoint.scope);
    if (!view) return;
    if (batch.kind === 'resetRequired') {
      if (view.pending) { view.invalidated = true; return; }
      void this.read(view.query).catch(this.context.failed); return;
    }
    if (view.pending) { view.buffered.push(batch); return; }
    const result = view.replica.apply(batch);
    if (result === 'duplicate') return;
    if (result === 'resetRequired') {
      void this.read(view.query).catch(this.context.failed);
      return;
    }
    this.publish(view);
    const generation = this.generation;
    void this.loadIcons(view).then(() => {
      if (generation === this.generation) this.publish(view);
    }).catch(this.context.failed);
  }

  private publish(view: View) {
    const snapshot = view.replica.snapshot!;
    if (view.projected?.snapshot === snapshot && view.projected.icons === this.icons.revision) {
      this.context.apply(view.query, view.projected.value);
      return view.projected.value;
    }
    const projected = projectDirectory(snapshot.entries, this.icons.get);
    view.projected = { snapshot, icons: this.icons.revision, value: projected };
    this.context.apply(view.query, projected);
    this.listeners.forEach(listener => listener(view.query, projected));
    this.save();
    return projected;
  }

  private async loadIcons(view: View) {
    const references = view.replica.snapshot!.entries.flatMap(entry => entry.kind === 'group'
      && entry.value.icon?.startsWith(DIRECTORY_ICON_PREFIX) ? [entry.value.icon] : []);
    await Promise.all([...new Set(references)].filter(reference => !this.icons.get(reference)).map(reference => {
      let pending = this.iconRequests.get(reference);
      if (!pending) {
        pending = this.context.request<{ source?: string }>({ operation: DIRECTORY_OPERATION, action: 'icon', reference })
          .then(result => { if (result.source) this.icons.put(reference, result.source); })
          .finally(() => { this.iconRequests.delete(reference); });
        this.iconRequests.set(reference, pending);
      }
      return pending;
    }));
  }

  private save() {
    this.writer?.write('codex', { views: [...this.views.values()].filter(view => view.replica.snapshot)
      .map(view => ({ query: view.query, snapshot: view.replica.snapshot })), icons: this.icons.export() });
  }

  private async restore() {
    if (!this.store) return;
    const generation = this.generation;
    try {
      const raw = await this.store.read('codex');
      if (generation !== this.generation) return;
      if (!raw) return;
      const saved = readDirectoryValue<{ views: { query: DirectoryQuery;
        snapshot: DirectorySnapshot<ChatDirectoryEntry> }[]; icons: Record<string, string> }>(raw);
      if (!saved || !Array.isArray(saved.views) || saved.views.length > MAX_CACHED_VIEWS) return;
      for (const { query, snapshot } of saved.views) {
        const replica = new DirectoryReplica<ChatDirectoryEntry>();
        if (!replica.restore(snapshot, validChatDirectoryEntry) || snapshot.checkpoint.scope !== directoryScope(query)
          || !snapshot.entries.some(entry => entry.kind === 'page')) continue;
        this.views.set(snapshot.checkpoint.scope, { query, replica, buffered: [] });
      }
      for (const [reference, source] of Object.entries(saved.icons ?? {})) {
        if (typeof source === 'string') this.icons.put(reference, source);
      }
    } catch { this.context.failed(); }
  }
}
