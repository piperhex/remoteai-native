import type { SyncBundle, SyncPlan, SyncProvider, SyncResult } from './types';

export interface SyncDownload {
  sourceHost: string;
  destinationHost: string;
  sourceBundle?: SyncBundle;
  destinationBundle: SyncBundle;
  plan: SyncPlan;
  overwriteIds: string[];
  provider: SyncProvider;
  result?: SyncResult;
  mode?: string;
  cleanupPending?: boolean;
}
