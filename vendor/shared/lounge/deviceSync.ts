import { historyKey } from './archive';
import { authorize } from './authorize';
import { SyncArchive } from './syncArchive';
import { HistorySyncConnection } from './syncConnection';
import type { LoungeMessage, LoungeSession } from './types';
import type { LoungeDeletionPage } from './deletions';

export class LoungeDeviceSync {
  private connection?: HistorySyncConnection;
  private owner?: string;
  private running = false;
  private lifecycle = 0;
  private readonly versions = new Map<string, string>();

  constructor(private readonly options: {
    session?: LoungeSession; deviceId: () => string; flush: () => Promise<void>;
    restored: (messages: LoungeMessage[]) => void; error: (failed: boolean) => void;
    accept: (message: LoungeMessage) => boolean;
    deletions?: { page: (after?: string) => LoungeDeletionPage;
      apply: (entries: Record<string, number>) => Promise<void> };
  }) {}

  ready(owner: string, available: boolean) {
    const session = this.options.session;
    if (!available || !session?.sync || !session.history?.get) {
      this.stop(); this.options.error(false); return;
    }
    if (this.running && this.owner === owner) return;
    this.stop(); this.running = true; this.owner = owner;
    const lifecycle = this.lifecycle;
    const archive = new SyncArchive({ owner, store: session.history, flush: this.options.flush,
      current: () => this.running && this.lifecycle === lifecycle,
      restored: this.options.restored, accept: this.options.accept, deletions: this.options.deletions });
    this.connection = new HistorySyncConnection({ baseUrl: session.baseUrl, deviceId: this.options.deviceId(),
      transport: session.sync, authorize: () => authorize(session), archive, error: this.options.error });
    this.connection.start();
  }

  changed(message: LoungeMessage) {
    const key = historyKey(message);
    const version = JSON.stringify([message.generation ?? 0, message.delivery?.status,
      message.delivery?.groupReceiptError]);
    if (this.versions.get(key) === version) return;
    this.versions.delete(key); this.versions.set(key, version);
    if (this.versions.size > 512) this.versions.delete(this.versions.keys().next().value!);
    this.connection?.changed(key);
  }

  retry = () => this.connection?.retryNow();
  deleted() { this.connection?.changed(); }
  stop() {
    this.lifecycle++; this.running = false; this.owner = undefined; this.versions.clear();
    this.connection?.stop(); this.connection = undefined;
  }
}
