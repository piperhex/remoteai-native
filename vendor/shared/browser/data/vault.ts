import { createVault, newDataId, seal, unlockVault, unseal, validateLogin, type RandomBytes, type DeriveVaultKey } from './crypto';
import { type BrowserEdits, type Login, type PasswordRecord, type VaultHeader } from './model';
import type { BrowserDataStore } from './store';
export interface SavedLogin extends Login { id: string; at: number }
interface Snapshot { unlocked: boolean; entries: SavedLogin[]; error: boolean }
const AUTO_LOCK_MS = 5 * 60 * 1000;

/** Only ciphertext is persisted or synchronized. The key and decrypted entries have a bounded memory lifetime. */
export class PasswordVault {
  private key?: Uint8Array;
  private salt = '';
  private state: Snapshot = { unlocked: false, entries: [], error: false };
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  constructor(private store: BrowserDataStore, private random: RandomBytes, private derive?: DeriveVaultKey) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  header = () => this.store.snapshot().entries.find((entry): entry is VaultHeader => entry.kind === 'vault');
  start = () => {
    const stop = this.store.subscribe(this.refresh);
    return () => { stop(); this.lock(); };
  };
  lock = () => {
    this.generation++; clearTimeout(this.timer); this.key?.fill(0); this.key = undefined; this.salt = '';
    this.state = { unlocked: false, entries: [], error: false }; this.publish();
  };
  unlock = async (passphrase: string) => {
    const generation = ++this.generation, header = this.header();
    if (!header && !this.store.snapshot().hydrated) throw new Error('vault-sync-required');
    const result = header ? { header, key: await unlockVault(passphrase, header, this.derive) }
      : await createVault(passphrase, this.random, this.derive);
    if (generation !== this.generation) { result.key.fill(0); return; }
    if (this.header()?.salt !== header?.salt) { result.key.fill(0); throw new Error('vault-changed'); }
    if (!header) {
      try { this.store.edit({ vault: result.header }); }
      catch (error) { result.key.fill(0); throw error; }
    }
    this.key?.fill(0); this.key = result.key; this.salt = result.header.salt;
    this.refresh(); this.touch();
  };
  touch = () => { clearTimeout(this.timer); if (this.key) this.timer = setTimeout(this.lock, AUTO_LOCK_MS); };
  save = (login: Login, id?: string) => {
    if (!this.key || this.header()?.salt !== this.salt || !validateLogin(login)) throw new Error('vault-locked');
    const existing = id ? this.state.entries.find(entry => entry.id === id)
      : this.state.entries.find(entry => entry.origin === login.origin && entry.username === login.username);
    const recordId = existing?.id ?? newDataId(this.random);
    const { origin, username, password } = login;
    const record: PasswordRecord = { id: recordId, kind: 'password', salt: this.salt, at: Date.now(),
      secret: seal(this.key, JSON.stringify({ origin, username, password }), `${this.salt}:${recordId}`, this.random) };
    this.store.edit({ [recordId]: record }); this.touch();
  };
  remove = (ids: string[]) => {
    if (!this.key) throw new Error('vault-locked');
    this.store.remove(ids.filter(id => this.state.entries.some(entry => entry.id === id))); this.touch();
  };
  mergeConflict = async (passphrase: string) => {
    const document = this.store.conflictingVault();
    const header = document?.entries.find((entry): entry is VaultHeader => entry.kind === 'vault');
    if (!document || !header || !this.key || this.state.error) throw new Error('vault-locked');
    const generation = this.generation, key = await unlockVault(passphrase, header, this.derive);
    try {
      if (generation !== this.generation) throw new Error('vault-locked');
      const edits: BrowserEdits = {};
      for (const { id, at, origin, username, password } of this.state.entries) {
        edits[id] = { id, at, kind: 'password', salt: header.salt,
          secret: seal(key, JSON.stringify({ origin, username, password }), `${header.salt}:${id}`, this.random) };
      }
      this.key?.fill(0); this.key = key.slice(); this.salt = header.salt;
      this.store.resolveVaultConflict(document, edits); this.refresh(); this.touch();
    } finally { key.fill(0); }
  };
  private refresh = () => {
    if (!this.key) return;
    if (this.header()?.salt !== this.salt) { this.lock(); return; }
    const entries: SavedLogin[] = [];
    let error = false;
    for (const record of this.store.snapshot().entries) {
      if (record.kind !== 'password') continue;
      try {
        const login: unknown = JSON.parse(unseal(this.key, record.secret, `${this.salt}:${record.id}`));
        if (!validateLogin(login)) throw new Error('vault-record');
        entries.push({ ...login, id: record.id, at: record.at });
      } catch { error = true; }
    }
    this.state = { unlocked: true, entries, error }; this.publish();
  };
  private publish() { this.listeners.forEach(listener => listener()); }
}
