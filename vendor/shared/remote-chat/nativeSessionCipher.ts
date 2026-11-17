import type { BulkCipher, BulkCipherContext } from './bulkCipher';
import type { SessionCipher } from './cipher';

export type SessionOptions = ConstructorParameters<typeof SessionCipher>[0];
export type TransferCipherContext = Pick<BulkCipherContext, 'transferId' | 'manifestId' | 'epoch'>;
export interface NativeChatTarget { peer: string; channel: string; envelopes: number }
export interface NativeSessionCipher {
  readonly native: true;
  /** Native registry handle, scoped to the desktop window; never a cryptographic key. */
  readonly handle: Promise<string>;
  encrypt(text: string, compress?: boolean): Promise<string>;
  decrypt(payload: string): Promise<string | null>;
  /** Encrypt and submit to native RTC without returning ciphertext through the WebView. */
  sendDirect?(target: NativeChatTarget, text: string, compress?: boolean): Promise<void>;
  createBulkCipher(context: TransferCipherContext): Promise<BulkCipher>;
  destroy(): void;
}
export type SessionCipherFactory = (options: SessionOptions) => NativeSessionCipher;
export type KeyPairFactory = () => Promise<{ secret: Uint8Array; publicKey: string }>;
export type LinkCipher = SessionCipher | NativeSessionCipher;
export const isNativeSession = (cipher: LinkCipher): cipher is NativeSessionCipher => 'native' in cipher;
