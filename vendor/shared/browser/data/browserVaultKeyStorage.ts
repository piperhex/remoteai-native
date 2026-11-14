import { isRememberedVaultKey, serializeVaultKeyStorage, type VaultKeyStorage } from './vaultKeyStorage';

const DATABASE = 'remoteai-browser-vault-keys';
const STORE = 'keys';
interface WrappedKey { wrapping: CryptoKey; nonce: Uint8Array; ciphertext: ArrayBuffer }
const stores = new Map<string, VaultKeyStorage>();

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('vault-key-storage'));
  });
}

async function record<T>(operation: (store: IDBObjectStore) => IDBRequest<T>, write = false) {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, write ? 'readwrite' : 'readonly');
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new Error('vault-key-storage'));
    });
  } finally { db.close(); }
}

/** Web keeps only a wrapped vault key beside a non-exportable, origin-scoped Web Crypto key. */
export function browserVaultKeyStorage(scope: string): VaultKeyStorage | undefined {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return;
  const existing = stores.get(scope);
  if (existing) return existing;
  const context = new TextEncoder().encode(scope);
  const storage = serializeVaultKeyStorage({
    read: async () => {
      const saved = await record<WrappedKey | undefined>(store => store.get(scope));
      if (!saved) return;
      if (!saved.wrapping || saved.wrapping.extractable) throw new Error('vault-key-storage');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: saved.nonce,
        additionalData: context }, saved.wrapping, saved.ciphertext);
      const value: unknown = JSON.parse(new TextDecoder().decode(plain));
      new Uint8Array(plain).fill(0);
      if (!isRememberedVaultKey(value)) throw new Error('vault-key-storage');
      return value;
    },
    write: async value => {
      const wrapping = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify(value));
      try {
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce,
          additionalData: context }, wrapping, plain);
        await record(store => store.put({ wrapping, nonce, ciphertext } satisfies WrappedKey, scope), true);
      } finally { plain.fill(0); }
    },
    remove: async () => { await record(store => store.delete(scope), true); },
  });
  stores.set(scope, storage);
  return storage;
}
