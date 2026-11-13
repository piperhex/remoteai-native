import { NativeModules } from 'react-native';
import { hexToBytes } from '@noble/hashes/utils';
import type { DeriveVaultKey } from '../../vendor/shared/browser/data/crypto';

interface VaultCryptoBridge { derive: (passphrase: string, salt: string) => Promise<string> }
const bridge = NativeModules.BrowserData as VaultCryptoBridge | undefined;
// Platform cryptography runs on a worker, keeping Hermes and touch input responsive during PBKDF2.
export const deriveNativeVaultKey: DeriveVaultKey = async (passphrase, salt) => {
  if (!bridge?.derive) throw new Error('vault-crypto-unavailable');
  const result = await bridge.derive(passphrase, salt);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('vault-crypto-invalid');
  return hexToBytes(result);
};
