import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { loginOrigin, type Login, type Sealed, type VaultHeader } from './model';

const ITERATIONS = 600000;
const CHECK = 'remoteai-browser-passwords-v1';
export type RandomBytes = (length: number) => Uint8Array;
export type DeriveVaultKey = (passphrase: string, salt: string) => Promise<Uint8Array>;
export const browserRandom: RandomBytes = length => crypto.getRandomValues(new Uint8Array(length));
export const newDataId = (random: RandomBytes) => bytesToHex(random(16));
export async function deriveVaultKey(passphrase: string, salt: string) {
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', new Uint8Array(utf8ToBytes(passphrase)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(hexToBytes(salt)),
      iterations: ITERATIONS, hash: 'SHA-256' }, key, 256);
    return new Uint8Array(bits);
  }
  return pbkdf2Async(sha256, passphrase, hexToBytes(salt), { c: ITERATIONS, dkLen: 32, asyncTick: 10 });
}
export function seal(key: Uint8Array, value: string, context: string, random: RandomBytes): Sealed {
  const nonce = random(12);
  return { nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(gcm(key, nonce, utf8ToBytes(context)).encrypt(utf8ToBytes(value))) };
}
export function unseal(key: Uint8Array, value: Sealed, context: string): string {
  return new TextDecoder().decode(gcm(key, hexToBytes(value.nonce), utf8ToBytes(context))
    .decrypt(hexToBytes(value.ciphertext)));
}
export async function createVault(passphrase: string, random: RandomBytes, derive: DeriveVaultKey = deriveVaultKey) {
  if (passphrase.length < 12 || passphrase.length > 1024) throw new Error('vault-passphrase');
  const salt = bytesToHex(random(16)), key = await derive(passphrase, salt);
  const header: VaultHeader = { id: 'vault', kind: 'vault', salt, check: seal(key, CHECK, salt, random) };
  return { header, key };
}
export async function unlockVault(passphrase: string, header: VaultHeader, derive: DeriveVaultKey = deriveVaultKey) {
  if (!passphrase || passphrase.length > 1024) throw new Error('vault-passphrase');
  const key = await derive(passphrase, header.salt);
  try {
    validateVaultKey(key, header);
    return key;
  } catch { key.fill(0); throw new Error('vault-passphrase'); }
}
export function validateVaultKey(key: Uint8Array, header: VaultHeader) {
  if (key.length !== 32 || unseal(key, header.check, header.salt) !== CHECK) throw new Error('vault-passphrase');
}
export function validateLogin(value: unknown): value is Login {
  if (!value || typeof value !== 'object') return false;
  const login = value as Login;
  return typeof login.origin === 'string' && loginOrigin(login.origin) === login.origin
    && login.origin.length <= 2048 && typeof login.username === 'string' && login.username.length <= 512
    && typeof login.password === 'string' && login.password.length > 0 && login.password.length <= 4096;
}
