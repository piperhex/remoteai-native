import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export const DIRECTORY_ICON_PREFIX = 'chat-icon:';
const MAX_ICON_CACHE_BYTES = 24 * 1024 * 1024;

export function directoryIconHash(source: string) {
  return DIRECTORY_ICON_PREFIX + bytesToHex(sha256(new TextEncoder().encode(source)));
}

/** Content-addressed resources are requested only through the authenticated chat RPC. */
export class DirectoryIcons {
  revision = 0;
  private values = new Map<string, string>();
  private sources = new Map<string, string>();
  private bytes = 0;
  reference = (source: string) => {
    if (!source.startsWith('data:image/png;base64,')) return source;
    const cached = this.sources.get(source);
    if (cached) return cached;
    const reference = directoryIconHash(source);
    this.put(reference, source);
    return reference;
  };
  get = (reference: string) => reference.startsWith(DIRECTORY_ICON_PREFIX) ? this.values.get(reference) : reference;
  put(reference: string, source: string) {
    if (directoryIconHash(source) !== reference || this.values.has(reference)) return;
    this.values.set(reference, source);
    this.sources.set(source, reference);
    this.revision++;
    this.bytes += source.length;
    while (this.bytes > MAX_ICON_CACHE_BYTES) {
      const [key, value] = this.values.entries().next().value!;
      this.values.delete(key); this.sources.delete(value); this.bytes -= value.length;
    }
  }
  export() { return Object.fromEntries(this.values); }
}
