import { bookmarkDescendants, isBookmark, MAX_BOOKMARKS, mergeBookmarks, readBookmarkDocument, reorderBookmarks,
  type Bookmark, type BookmarkDocument, type BookmarkEdits } from './model';
import type { BookmarkChannel } from './channel';

export type BookmarkStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'storage-error' | 'capacity';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
const RETRY_MS = 5_000;
interface Snapshot { entries: Bookmark[]; status: BookmarkStatus; showBar: boolean }

/** One account store for every browser surface. Pending edits survive offline restarts. */
export class BookmarkStore {
  private remote: BookmarkDocument = { revision: 0, entries: [] };
  private pending: BookmarkEdits = {};
  private state: Snapshot = { entries: [], status: 'local', showBar: true };
  private listeners = new Set<() => void>();
  private running = false;
  private busy = false;
  private again = false;
  private hydrated = false;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private key: string;
  constructor(scope: string, private readonly storage?: Storage, private readonly channel?: BookmarkChannel) {
    this.key = `remoteai:browser-bookmarks:${scope}`;
    try {
      const value = JSON.parse(storage?.getItem(this.key) ?? 'null');
      this.remote = readBookmarkDocument(value?.document) ?? this.remote;
      if (value?.pending && typeof value.pending === 'object') {
        for (const [id, entry] of Object.entries(value.pending)) {
          if (/^[\w-]{1,80}$/.test(id) && (entry === null || isBookmark(entry) && entry.id === id)) this.pending[id] = entry;
        }
      }
      this.state = { entries: mergeBookmarks(this.remote.entries, this.pending),
        status: channel ? 'offline' : 'local', showBar: value?.showBar !== false };
    } catch { this.state.status = 'storage-error'; }
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  start = () => {
    this.running = true;
    const generation = ++this.generation;
    const stop = this.channel?.subscribe(document => {
      if (document) this.accept(document);
      else this.hydrated = false;
      this.refresh();
    });
    this.refresh();
    return () => {
      if (generation !== this.generation) return;
      this.running = false; this.generation++; clearTimeout(this.timer); stop?.();
    };
  };
  setShowBar = (showBar: boolean) => { this.state = { ...this.state, showBar }; this.publish(); };
  save = (entry: Bookmark) => {
    if (!isBookmark(entry) || !this.state.entries.some(item => item.id === entry.id)
      && this.state.entries.length >= MAX_BOOKMARKS) return false;
    this.pending = { ...this.pending, [entry.id]: entry };
    this.changed(); return true;
  };
  remove = (id: string) => {
    const edits = { ...this.pending };
    bookmarkDescendants(this.state.entries, id).forEach(key => { edits[key] = null; });
    this.pending = edits; this.changed();
  };
  reorder = (id: string, targetId: string, after: boolean) => {
    const edits = reorderBookmarks(this.state.entries, id, targetId, after);
    if (!Object.keys(edits).length) return;
    this.pending = { ...this.pending, ...edits }; this.changed();
  };
  private changed() {
    this.state = { ...this.state, entries: mergeBookmarks(this.remote.entries, this.pending),
      status: this.channel ? 'syncing' : 'local' };
    if (!this.channel) { this.remote = { revision: 0, entries: this.state.entries }; this.pending = {}; }
    this.publish(); this.refresh();
  }
  private accept(document: BookmarkDocument) {
    if (document.revision < this.remote.revision) return;
    this.remote = document;
    this.state = { ...this.state, entries: mergeBookmarks(document.entries, this.pending) };
    this.publish();
  }
  refresh = () => {
    if (!this.running || !this.channel) return;
    if (this.busy) { this.again = true; return; }
    clearTimeout(this.timer);
    if (!this.channel.available) { this.status('offline'); return; }
    void this.synchronize();
  };
  private async synchronize() {
    const channel = this.channel!;
    const generation = this.generation;
    const current = () => this.running && generation === this.generation;
    this.busy = true; this.again = false; this.status('syncing');
    try {
      if (!this.hydrated) {
        const reply = await channel.exchange();
        if (!current()) return;
        this.accept(reply.document); this.hydrated = true;
      }
      if (Object.keys(this.pending).length) await this.upload(channel, current);
      if (current()) this.status(Object.keys(this.pending).length ? 'syncing' : 'synced');
    } catch { if (current() && this.state.status !== 'capacity') this.status('offline'); }
    finally {
      this.busy = false;
      if (this.running && (this.again || Object.keys(this.pending).length || this.state.status === 'offline')) {
        this.timer = setTimeout(this.refresh, this.again ? 0 : RETRY_MS);
      }
    }
  }
  private async upload(channel: BookmarkChannel, current: () => boolean) {
    const sent = this.pending;
    const entries = mergeBookmarks(this.remote.entries, sent);
    if (entries.length > MAX_BOOKMARKS) { this.status('capacity'); throw new Error('Bookmark capacity'); }
    const reply = await channel.exchange({ revision: this.remote.revision, entries });
    if (!current()) return;
    if (reply.accepted) {
      const remaining = { ...this.pending };
      Object.entries(sent).forEach(([id, entry]) => { if (remaining[id] === entry) delete remaining[id]; });
      this.pending = remaining;
    } else this.again = true;
    this.accept(reply.document);
  }
  private status(status: BookmarkStatus) { this.state = { ...this.state, status }; this.publish(); }
  private publish() {
    try {
      this.storage?.setItem(this.key, JSON.stringify({ document: this.remote, pending: this.pending,
        showBar: this.state.showBar }));
    } catch { this.state = { ...this.state, status: 'storage-error' }; }
    this.listeners.forEach(listener => listener());
  }
}
