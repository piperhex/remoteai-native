export interface RememberedVaultKey { salt: string; key: string }
export interface VaultKeyStorage {
  read: () => Promise<RememberedVaultKey | undefined>;
  write: (value: RememberedVaultKey) => Promise<void>;
  remove: () => Promise<void>;
}
export type VaultKeyStorageFactory = (scope: string) => VaultKeyStorage | undefined;

export function isRememberedVaultKey(value: unknown): value is RememberedVaultKey {
  if (!value || typeof value !== 'object') return false;
  const data = value as RememberedVaultKey;
  return typeof data.salt === 'string' && /^[a-f0-9]{32}$/.test(data.salt)
    && typeof data.key === 'string' && /^[a-f0-9]{64}$/.test(data.key);
}

/** An explicit lock must finish deleting the remembered key before a remounted vault reads it. */
export function serializeVaultKeyStorage(storage: VaultKeyStorage): VaultKeyStorage {
  let pending: Promise<unknown> = Promise.resolve();
  const run = <T>(operation: () => Promise<T>) => {
    const result = pending.then(operation, operation);
    pending = result.catch(() => undefined);
    return result;
  };
  return { read: () => run(storage.read), write: value => run(() => storage.write(value)),
    remove: () => run(storage.remove) };
}
