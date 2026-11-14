import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { isRememberedVaultKey, serializeVaultKeyStorage,
  type VaultKeyStorage } from '../../vendor/shared/browser/data/vaultKeyStorage';

const stores = new Map<string, VaultKeyStorage>();
export function nativeVaultKeyStorage(scope: string): VaultKeyStorage {
  const existing = stores.get(scope);
  if (existing) return existing;
  const name = `remoteai.browser-vault.v1.${bytesToHex(sha256(utf8ToBytes(scope)))}`;
  const storage = serializeVaultKeyStorage({
    read: async () => {
      const raw = await SecureStore.getItemAsync(name);
      if (!raw) return;
      const value: unknown = JSON.parse(raw);
      if (!isRememberedVaultKey(value)) throw new Error('vault-key-storage');
      return value;
    },
    write: value => SecureStore.setItemAsync(name, JSON.stringify(value), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
    remove: () => SecureStore.deleteItemAsync(name),
  });
  stores.set(scope, storage);
  return storage;
}
