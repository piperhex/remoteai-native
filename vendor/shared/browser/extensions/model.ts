export interface BrowserExtension {
  id: string; name: string; enabled: boolean; pinned: boolean;
  version?: string; icon?: string; popup: boolean; sidePanel?: boolean; permissions?: string[];
  market?: { id: string; sha256: string };
}
export interface ChromeExtension {
  path: string; profile: string; name: string; version: string; icon?: string; permissions: string[];
}
export type AssistantTarget = 'chrome' | 'agentHub' | 'standalone';
export interface AssistantPreferences { order: AssistantTarget[] }
export type PanelCommand = { action: 'open'; extension?: string }
  | { action: 'close' | 'reload' | 'capture' }
  | { action: 'resize'; width: number; height: number }
  | { action: 'click'; x: number; y: number }
  | { action: 'text'; text: string }
  | { action: 'key'; key: string }
  | { action: 'scroll'; x: number; y: number; delta: number };
export type ExtensionRequest = { action: 'list' | 'discover' }
  | { action: 'preferences'; preferences?: AssistantPreferences }
  | { action: 'panel'; session: string; command: PanelCommand }
  | { action: 'install'; path: string }
  | { action: 'beginUpload'; files: { path: string; size: number }[] }
  | { action: 'writeUpload'; token: string; path: string; offset: number; data: string }
  | { action: 'finishUpload'; token: string; market?: { id: string; sha256: string } }
  | { action: 'releaseTransfer'; token: string }
  | { action: 'export'; path: string }
  | { action: 'readExport'; token: string; offset: number }
  | { action: 'enable'; id: string; enabled: boolean }
  | { action: 'remove' | 'open'; id: string }
  | { action: 'pin'; id: string; pinned: boolean };
