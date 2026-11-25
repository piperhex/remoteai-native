import type { InstallationProgress } from '../cli/installProgressTypes';
import type { FileChange } from '../conversation/types';

export type GuiEngine = 'codex' | 'claude' | 'gemini';
export type ExternalEngine = Exclude<GuiEngine, 'codex'>;
export const CLI_GUI_OPERATION = 'cliGui';
export const CLI_GUI_EVENT = 'cliGui/changed';
export const CLI_DETAIL_CHUNK_CHARS = 256 * 1024;
export const CLI_DETAIL_MAX_CHARS = 64 * 1024 * 1024;

export interface CliModel { id: string; label: string; isDefault?: boolean;
  defaultEffort?: string; efforts?: { id: string; label: string }[] }
export interface CliMode { id: string; label: string }
export interface CliCatalog {
  status: 'ready' | 'unavailable' | 'loading' | 'error';
  models: CliModel[];
  modes: CliMode[];
  defaultMode?: string;
}
export interface CliRuntimeStatus {
  directorySyncV1?: boolean;
  status: 'missing' | 'installing' | 'ready' | 'error';
  version: string;
  error?: string;
  cliVersion?: string;
  progress?: InstallationProgress;
}
export interface CliPermission {
  id: string; title: string; description?: string;
  actions: { id: string; label: string; behavior: 'allow' | 'deny' }[];
  questions?: { question: string; options: string[]; multiple?: boolean }[];
}
export interface CliSession {
  metricsSessionId?: string;
  permissionCount?: number;
  id: string; engine: ExternalEngine; title: string; cwd: string; model: string;
  status: string; updatedAt: string; archived: boolean;
  effort?: string;
  permissions: CliPermission[];
}
export interface CliEntry {
  detailCursor?: CliCursor;
  id: string; first: number; last: number;
  role: 'user' | 'assistant' | 'reasoning' | 'tool' | 'error' | 'notice';
  text: string; title?: string; status?: string;
  changes?: FileChange[];
  images?: string[];
}
export interface CliCursor { epoch: string; seq: number }
export interface CliDetailChunk { token: string; offset?: number }
export interface CliDetailPart { token: string; offset: number; total: number; text: string; epoch?: string }
export type CliDetailResponse = CliHistory | { detailPart: CliDetailPart };
export interface CliHistory {
  session: CliSession; entries: CliEntry[]; cursor?: CliCursor; hasOlder: boolean;
}
export type CliRequest = { engine: ExternalEngine } & (
  | { action: 'status' | 'install' }
  | { action: 'catalog'; cwd?: string; id?: string }
  | { action: 'list'; archived: boolean }
  | { action: 'syncList'; archived: boolean; search?: string; more?: boolean;
      checkpoint?: import('../chat/directory/protocol').DirectoryCheckpoint }
  | { action: 'create'; cwd: string; model: string; mode?: string; effort?: string }
  | { action: 'read'; id: string; cursor?: CliCursor; previews?: boolean; detailId?: string;
      detailChunk?: CliDetailChunk }
  | { action: 'send'; id: string; text: string; messageId: string; images?: string[]; model?: string; effort?: string }
  | { action: 'image'; id: string; source: string }
  | { action: 'stop' | 'archive'; id: string }
  | { action: 'approve'; id: string; permissionId: string; actionId: string;
      answers?: Record<string, string> }
);
export interface CliTransport {
  request<T>(request: CliRequest): Promise<T>;
  subscribe(listener: (change?: CliChange) => void): Promise<() => void> | (() => void);
  directoryStorage?: import('../chat/directory/storage').DirectoryStorage;
  subscribeAccountChange?(listener: () => void): Promise<() => void> | (() => void);
}

export type CliDirectoryEntry = { key: string; kind: 'session'; value: CliSession }
  | { key: '@page'; kind: 'page'; cursor: string | null; complete: boolean };
export interface CliChange {
  changes?: CliChange[];
  engine?: ExternalEngine;
  id?: string;
  history?: boolean;
  runtime?: boolean;
  invalidated?: boolean;
  batch?: import('../chat/directory/protocol').DirectoryBatch<CliDirectoryEntry>;
}
