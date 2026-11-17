import type { DownloadOperation, DownloadTask } from './types';

export interface BrowserDownload {
  id: string;
  awaitingConfirmation: boolean;
  canResume: boolean;
}

export type BrowserDownloadAction = DownloadOperation | 'pause' | 'resume';
type Transport = (id: string, action: BrowserDownloadAction) => Promise<void>;
let transport: Transport | undefined;

export function registerBrowserDownloads(value: Transport) {
  transport = value;
  return () => { if (transport === value) transport = undefined; };
}

export function browserDownloadConnected(task: DownloadTask) {
  return !!transport && (!!task.browser?.awaitingConfirmation || !!task.browser?.canResume
    || task.status === 'downloading' || task.status === 'completed');
}

export async function controlBrowserDownload(task: DownloadTask, action: BrowserDownloadAction) {
  if (!transport || !task.browser) throw new Error('client.downloads.browser.unavailable');
  await transport(task.browser.id, action);
}
