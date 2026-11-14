import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { createVault, newDataId, seal, unlockVault, unseal, validateLogin, validateVaultKey,
  type RandomBytes, type DeriveVaultKey } from './crypto';
import { type BrowserEdits, type Login, type PasswordRecord, type VaultHeader } from './model';
import type { BrowserDataStore } from './store';
import { isRememberedVaultKey, type VaultKeyStorage } from './vaultKeyStorage';
export interface SavedLogin extends Login { id: string; at: number }
interface Snapshot { unlocked: boolean; entries: SavedLogin[]; error: boolean }

/** Synced records remain encrypted; the host stores a remembered key only on this device. */
export class PasswordVault {
  private key?: Uint8Array;
  private salt = '';
  private state: Snapshot = { unlocked: false, entries: [], error: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private attemptedSalt = '';
  constructor(private store: BrowserDataStore, private random: RandomBytes, private derive?: DeriveVaultKey,
    private keyStorage?: VaultKeyStorage) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  header = () => this.store.snapshot().entries.find((entry): entry is VaultHeader => entry.kind === 'vault');
  start = () => {
    this.attemptedSalt = '';
    const stop = this.store.subscribe(this.refresh);
    this.refresh();
    return () => { stop(); this.clearMemory(); };
  };
  private clearMemory = () => {
    this.generation++; this.key?.fill(0); this.key = undefined; this.salt = '';
    this.state = { unlocked: false, entries: [], error: false }; this.publish();
  };
  lock = async () => {
    this.attemptedSalt = this.header()?.salt ?? '';
    this.clearMemory();
    await this.keyStorage?.remove();
  };
  unlock = async (passphrase: string) => {
    const generation = ++this.generation, header = this.header();
    if (!header && !this.store.snapshot().hydrated) throw new Error('vault-sync-required');
    const result = header ? { header, key: await unlockVault(passphrase, header, this.derive) }
      : await createVault(passphrase, this.random, this.derive);
    if (generation !== this.generation) { result.key.fill(0); return; }
    if (this.header()?.salt !== header?.salt) { result.key.fill(0); throw new Error('vault-changed'); }
    this.attemptedSalt = result.header.salt;
    if (!header) {
      try { this.store.edit({ vault: result.header }); }
      catch (error) { result.key.fill(0); throw error; }
    }
    try { await this.keyStorage?.write({ salt: result.header.salt, key: bytesToHex(result.key) }); }
    catch (error) { result.key.fill(0); throw error; }
    if (generation !== this.generation || this.header()?.salt !== result.header.salt) { result.key.fill(0); return; }
    this.key?.fill(0); this.key = result.key; this.salt = result.header.salt;
    this.refresh();
  };
  save = (login: Login, id?: string) => {
    if (!this.key || this.header()?.salt !== this.salt || !validateLogin(login)) throw new Error('vault-locked');
    const existing = id ? this.state.entries.find(entry => entry.id === id)
      : this.state.entries.find(entry => entry.origin === login.origin && entry.username === login.username);
    const recordId = existing?.id ?? newDataId(this.random);
    const { origin, username, password } = login;
    const record: PasswordRecord = { id: recordId, kind: 'password', salt: this.salt, at: Date.now(),
      secret: seal(this.key, JSON.stringify({ origin, username, password }), `${this.salt}:${recordId}`, this.random) };
    this.store.edit({ [recordId]: record });
  };
  remove = (ids: string[]) => {
    if (!this.key) throw new Error('vault-locked');
    this.store.remove(ids.filter(id => this.state.entries.some(entry => entry.id === id)));
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
      await this.keyStorage?.write({ salt: header.salt, key: bytesToHex(key) });
      if (generation !== this.generation) return;
      this.key?.fill(0); this.key = key.slice(); this.salt = header.salt;
      this.store.resolveVaultConflict(document, edits); this.refresh();
    } finally { key.fill(0); }
  };
  private refresh = () => {
    if (!this.key) { void this.restore(); return; }
    if (this.header()?.salt !== this.salt) {
      this.clearMemory(); this.attemptedSalt = ''; void this.restore(); return;
    }
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
  private restore = async () => {
    const header = this.header(), generation = this.generation;
    if (!header || !this.keyStorage || this.attemptedSalt === header.salt) return;
    this.attemptedSalt = header.salt;
    let key: Uint8Array | undefined;
    try {
      const saved = await this.keyStorage.read();
      if (!isRememberedVaultKey(saved) || saved.salt !== header.salt) return;
      key = hexToBytes(saved.key);
      validateVaultKey(key, header);
      if (generation !== this.generation || this.header()?.salt !== header.salt) return;
      this.key = key; this.salt = header.salt; key = undefined;
      this.refresh();
    } catch { /* An unavailable or outdated device key falls back to the existing unlock form. */ }
    finally { key?.fill(0); }
  };
  private publish() { this.listeners.forEach(listener => listener()); }
}
