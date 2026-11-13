import { isBrowserRecord, MAX_DATA_BYTES, MAX_PASSWORDS, mergeBrowserData, readBrowserDocument,
  type BrowserDocument, type BrowserEdits, type BrowserRecord, type Visit } from './model';
import type { BrowserDataChannel } from './channel';
export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type DataStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'storage-error' | 'conflict' | 'capacity';
interface Snapshot { entries: BrowserRecord[]; status: DataStatus; hydrated: boolean }

/** Compare-and-swap plus durable pending edits prevents offline devices resurrecting deleted records. */
export class BrowserDataStore {
  private remote: BrowserDocument = { revision: 0, entries: [] };
  private pending: BrowserEdits = {};
  private conflict?: BrowserDocument;
  private state: Snapshot = { entries: [], status: 'local', hydrated: false };
  private listeners = new Set<() => void>();
  private running = false;
  private busy = false;
  private again = false;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private key: string;
  constructor(scope: string, private storage?: BrowserStorage, private channel?: BrowserDataChannel) {
    this.key = `remoteai:browser-data:${scope}`;
    try {
      const saved = JSON.parse(storage?.getItem(this.key) ?? 'null');
      this.remote = readBrowserDocument(saved?.document) ?? this.remote;
      this.conflict = readBrowserDocument(saved?.conflict);
      if (saved?.pending && typeof saved.pending === 'object') {
        for (const [id, entry] of Object.entries(saved.pending)) {
          if (/^[\w-]{1,80}$/.test(id) && (entry === null || isBrowserRecord(entry) && entry.id === id)) {
            this.pending[id] = entry;
          }
        }
      }
      this.state = { entries: mergeBrowserData(this.remote.entries, this.pending),
        status: this.conflict ? 'conflict' : channel ? 'offline' : 'local', hydrated: !channel };
    } catch { this.state.status = 'storage-error'; }
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  start = () => {
    this.running = true;
    const generation = ++this.generation;
    const stop = this.channel?.subscribe(document => {
      if (document) this.accept(document);
      else this.state = { ...this.state, hydrated: false };
      this.refresh();
    });
    this.refresh();
    return () => {
      if (generation !== this.generation) return;
      this.running = false; this.generation++; clearTimeout(this.timer); stop?.();
    };
  };
  edit = (edits: BrowserEdits) => {
    if (Object.entries(edits).some(([id, entry]) => entry !== null && (!isBrowserRecord(entry) || entry.id !== id))) {
      throw new Error('browser-data-invalid');
    }
    const pending = { ...this.pending, ...edits }, entries = mergeBrowserData(this.remote.entries, pending);
    if (entries.filter(entry => entry.kind === 'password').length > MAX_PASSWORDS
      || new TextEncoder().encode(JSON.stringify(entries)).length > MAX_DATA_BYTES) {
      this.status('capacity'); throw new Error('browser-data-capacity');
    }
    this.pending = pending;
    this.state = { ...this.state, entries, status: this.conflict ? 'conflict' : this.channel ? 'syncing' : 'local' };
    if (!this.channel) { this.remote = { revision: 0, entries }; this.pending = {}; }
    if (!this.publish()) throw new Error('browser-data-storage');
    this.refresh();
  };
  visit = (entry: Visit) => this.edit({ [entry.id]: entry });
  remove = (ids: string[]) => this.edit(Object.fromEntries(ids.map(id => [id, null])));
  conflictingVault = () => this.conflict;
  resolveVaultConflict = (document: BrowserDocument, encrypted: BrowserEdits) => {
    if (this.conflict !== document) throw new Error('vault-changed');
    const pending = { ...this.pending, ...encrypted }; delete pending.vault;
    this.remote = document; this.conflict = undefined; this.pending = pending;
    this.state = { entries: mergeBrowserData(document.entries, pending), status: 'syncing', hydrated: true };
    if (!this.publish()) throw new Error('browser-data-storage');
    this.refresh();
  };
  private accept(document: BrowserDocument) {
    if (document.revision < this.remote.revision) return;
    const localVault = this.pending.vault, remoteVault = document.entries.find(entry => entry.kind === 'vault');
    if (localVault?.kind === 'vault' && remoteVault?.kind === 'vault' && localVault.salt !== remoteVault.salt) {
      // Preserve the local encrypted edits; never silently overwrite another device's newly created vault.
      this.conflict = document; this.status('conflict'); return;
    }
    this.remote = document;
    this.state = { ...this.state, entries: mergeBrowserData(document.entries, this.pending) };
    this.publish();
  }
  refresh = () => {
    if (!this.running || !this.channel || this.state.status === 'conflict') return;
    if (this.busy) { this.again = true; return; }
    clearTimeout(this.timer);
    if (!this.channel.available) { this.status('offline'); return; }
    void this.synchronize();
  };
  private async synchronize() {
    const channel = this.channel!, generation = this.generation;
    const current = () => this.running && generation === this.generation && this.state.status !== 'conflict';
    this.busy = true; this.again = false; this.status('syncing');
    try {
      if (!this.state.hydrated) {
        const reply = await channel.exchange();
        if (!current()) return;
        this.accept(reply.document);
        this.state = { ...this.state, hydrated: true };
      }
      if (!current()) return;
      if (Object.keys(this.pending).length) {
        const sent = this.pending;
        const reply = await channel.exchange({ revision: this.remote.revision,
          entries: mergeBrowserData(this.remote.entries, sent) });
        if (!current()) return;
        if (reply.accepted) {
          const remaining = { ...this.pending };
          Object.entries(sent).forEach(([id, entry]) => { if (remaining[id] === entry) delete remaining[id]; });
          this.pending = remaining;
        } else this.again = true;
        this.accept(reply.document);
      }
      if (current()) this.status(Object.keys(this.pending).length ? 'syncing' : 'synced');
    } catch { if (current()) this.status('offline'); }
    finally {
      this.busy = false;
      if (current() && (this.again || Object.keys(this.pending).length || this.state.status === 'offline')) {
        this.timer = setTimeout(this.refresh, this.again ? 0 : 5000);
      }
    }
  }
  private status(status: DataStatus) { this.state = { ...this.state, status }; this.publish(); }
  private publish() {
    let saved = true;
    try { this.storage?.setItem(this.key, JSON.stringify({ document: this.remote, pending: this.pending,
      ...(this.conflict ? { conflict: this.conflict } : {}) })); }
    catch { saved = false; this.state = { ...this.state, status: 'storage-error' }; }
    this.listeners.forEach(listener => listener());
    return saved;
  }
}
