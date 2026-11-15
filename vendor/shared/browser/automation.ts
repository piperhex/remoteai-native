export interface ManagedBrowserTab {
  id: string; threadId: string; url: string; title: string; loading?: boolean; icons?: string[];
}
export type BrowserCommand = { action: 'extensions'; request: import('./extensions/model').ExtensionRequest }
  | { action: 'list' | 'snapshot' | 'screenshot' | 'back' | 'forward' | 'reload' | 'stop' | 'close' }
  | { action: 'navigate'; url: string }
  | { action: 'open'; url: string; requestId: string }
  | { action: 'click'; reference: string }
  | { action: 'type'; reference: string; text: string }
  | { action: 'select'; reference: string; value: string }
  | { action: 'scroll'; x: number; y: number }
  | { action: 'key'; key: string };
export interface BrowserRequest { threadId: string; tabId?: string; command: BrowserCommand }
export interface BrowserReply {
  transfer?: { token: string; size?: number; data?: string };
  supported?: boolean; entries?: import('./extensions/model').BrowserExtension[];
  candidates?: import('./extensions/model').ChromeExtension[];
  tabs?: ManagedBrowserTab[]; tab?: ManagedBrowserTab;
  result?: { url?: string; title?: string; loading?: boolean; icons?: string[];
    image?: { mimeType: string; data: string };
    viewport?: { width: number; height: number };
    elements?: { reference: string; role: string; name: string; disabled?: boolean;
      bounds?: { x: number; y: number; width: number; height: number } }[] };
}
export interface BrowserClient {
  native: boolean;
  browseFiles?: (directory: string, includeFiles?: boolean) =>
    Promise<import('../remote-chat/projectDirectories').ProjectDirectoriesResponse>;
  request: (request: BrowserRequest) => Promise<BrowserReply>;
  subscribe: (callback: (event: BrowserEvent) => void) => Promise<() => void>;
}
export type BrowserEvent = { type: 'opened'; tab: ManagedBrowserTab }
  | { type: 'loading'; threadId: string; tabId: string; loading: boolean }
  | { type: 'closed'; threadId: string; tabId: string };
export function browserEvent(event: { method: string; params: object }): BrowserEvent | undefined {
  if (event.method === 'browser/loading') {
    const params = event.params as { threadId?: unknown; tabId?: unknown; loading?: unknown };
    if (typeof params.threadId === 'string' && typeof params.tabId === 'string' && typeof params.loading === 'boolean') {
      return { type: 'loading', threadId: params.threadId, tabId: params.tabId, loading: params.loading };
    }
    return;
  }
  if (event.method === 'browser/closed') {
    const params = event.params as { threadId?: unknown; tabId?: unknown };
    if (typeof params.threadId === 'string' && typeof params.tabId === 'string') {
      return { type: 'closed', threadId: params.threadId, tabId: params.tabId };
    }
    return;
  }
  if (event.method !== 'browser/opened') return;
  const value = (event.params as { tab?: Partial<ManagedBrowserTab> }).tab;
  if (!value || ![value.id, value.threadId, value.url, value.title].every(item => typeof item === 'string')) return;
  return { type: 'opened', tab: value as ManagedBrowserTab };
}
