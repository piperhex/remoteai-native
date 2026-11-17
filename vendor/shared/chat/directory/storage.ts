export interface DirectoryStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

/** Account + stable host + schema isolation; each value contains data AND its applied checkpoint. */
export function browserDirectoryStorage(account: string, device: string): DirectoryStorage {
  const prefix = `remoteai-directory-v1:${JSON.stringify([account, device])}:`;
  return {
    read: async key => localStorage.getItem(prefix + key),
    write: async (key, value) => { localStorage.setItem(prefix + key, value); },
  };
}

/** Serialize asynchronous writes so an older save can never replace a newer checkpoint. */
export class DirectoryWriter {
  private pending = new Map<string, string>();
  private writing?: Promise<void>;
  constructor(private readonly store: DirectoryStorage, private readonly failed: () => void) {}
  write(key: string, value: unknown) {
    const data = JSON.stringify(value);
    const serialized = JSON.stringify({ data, checksum: directoryIconHash(data) });
    this.pending.set(key, serialized);
    void this.flush();
  }
  flush = (): Promise<void> => {
    if (!this.writing) this.writing = this.drain().finally(() => {
      this.writing = undefined;
      if (this.pending.size) return this.flush();
    });
    return this.writing;
  };
  private async drain() {
    while (this.pending.size) {
      const [key, value] = this.pending.entries().next().value!;
      this.pending.delete(key);
      try { await this.store.write(key, value); }
      catch { this.failed(); }
    }
  }
}
import { directoryIconHash } from './icons';


export function readDirectoryValue<T>(raw: string): T | undefined {
  const envelope = JSON.parse(raw) as { data?: unknown; checksum?: unknown };
  if (typeof envelope.data !== 'string' || envelope.checksum !== directoryIconHash(envelope.data)) return;
  return JSON.parse(envelope.data) as T;
}
