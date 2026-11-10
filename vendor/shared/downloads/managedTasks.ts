import type { DownloadTask } from './types';

/** Application jobs share the download queue while owning their transport and final action. */
export interface ManagedDownloadHandler {
  matches: (task: DownloadTask) => boolean;
  connected: (task: DownloadTask) => boolean;
  run: (options: { task: DownloadTask; signal: AbortSignal;
    update: (task: DownloadTask) => void }) => Promise<DownloadTask>;
  remove?: (task: DownloadTask) => Promise<void>;
  retryable?: (error: unknown) => boolean;
}

const handlers = new Set<ManagedDownloadHandler>();
const listeners = new Set<() => void>();
export const managedDownloadHandler = (task: DownloadTask) => [...handlers].find(handler => handler.matches(task));
export const managedDownloadsChanged = () => listeners.forEach(listener => listener());
export function registerManagedDownloads(handler: ManagedDownloadHandler) {
  handlers.add(handler); managedDownloadsChanged();
}
export function subscribeManagedDownloads(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
