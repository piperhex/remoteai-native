export const SYNC_OPERATION = 'conversationSync';
export const SYNC_HOME_ID = 'codex-gui';
export const SYNC_CHUNK_BYTES = 256 * 1024;
export const SYNC_LEGACY_CHUNK_BYTES = 12 * 1024;

export interface SyncHome { id: string; path: string; enabled: boolean }
export interface SyncDirectory { name: string; homes: SyncHome[] }
export interface SyncThread {
  sessionId: string; sessionKind: string; title: string; cwd: string; updatedAt: number | null;
  sizeBytes: number; matchExcerpt: string | null;
}
export interface SyncBundle {
  id: string; size: number; sha256: string; sessionIds: string[];
  originalSize?: number; resumeToken?: string; written?: number; chunkBytes?: number;
}
export interface SyncPlan { count: number; duplicateIds: string[] }
export interface SyncResult { completedCount: number; skippedCount: number }
export type SyncProvider = 'openai' | 'codex-switch-local' | 'codex-switch-gui';
export type SyncRequest =
  | { action: 'homes' }
  | { action: 'list'; homeId: string; query?: string }
  | { action: 'prepare' | 'export'; homeId: string; sessionIds: string[] }
  | { action: 'read'; id: string; offset: number; length?: number }
  | { action: 'resume'; id: string; resumeToken: string }
  | { action: 'begin'; size: number; sha256: string }
  | { action: 'write'; id: string; offset: number; data: string }
  | { action: 'plan'; id: string; sessionIds?: string[] }
  | { action: 'close'; id: string }
  | { action: 'commit'; id: string; overwriteIds: string[]; modelProvider: SyncProvider };

export interface SyncHost {
  id: string;
  name: string;
  owner?: string;
  /** The source and destination share a filesystem only when their host IDs match. */
  request: <T>(request: SyncRequest) => Promise<T>;
  close?: () => void;
  mode?: () => 'direct' | 'relay' | 'connecting' | 'offline';
}
export interface SyncSource { key: string; host: SyncHost; home: SyncHome; label: string }
