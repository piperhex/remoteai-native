/** Application checkpoints are independent of transport sessions and network paths. */
export const DIRECTORY_SCHEMA = 1;
export const DIRECTORY_OPERATION = 'chatDirectory';
export const DIRECTORY_EVENT = 'chat/directory/updated';
export const DIRECTORY_PAGE_SIZE = 50;
export interface DirectoryCheckpoint {
  schema: number;
  epoch: string;
  stream: string;
  scope: string;
  revision: number;
}
export interface DirectoryEntry { key: string }
export interface DirectoryRemoval { key: string; reason: 'deleted' | 'outOfScope' }
export interface DirectoryBatch<T extends DirectoryEntry> {
  kind: 'changes';
  from: number;
  checkpoint: DirectoryCheckpoint;
  upserts: T[];
  removals: DirectoryRemoval[];
}
export interface DirectorySnapshot<T extends DirectoryEntry> {
  kind: 'snapshot';
  checkpoint: DirectoryCheckpoint;
  entries: T[];
}
export type DirectoryReply<T extends DirectoryEntry> = DirectorySnapshot<T> | DirectoryBatch<T>
  | { kind: 'resetRequired' };
export type DirectoryEvent<T extends DirectoryEntry> = DirectoryBatch<T>
  | { kind: 'resetRequired'; checkpoint: DirectoryCheckpoint };

export function sameDirectory(left: DirectoryCheckpoint, right: DirectoryCheckpoint) {
  return left.schema === right.schema && left.epoch === right.epoch
    && left.stream === right.stream && left.scope === right.scope;
}

export function validCheckpoint(value: unknown): value is DirectoryCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const entry = value as DirectoryCheckpoint;
  return entry.schema === DIRECTORY_SCHEMA && typeof entry.epoch === 'string' && !!entry.epoch
    && typeof entry.stream === 'string' && !!entry.stream && typeof entry.scope === 'string'
    && Number.isSafeInteger(entry.revision) && entry.revision >= 0;
}
