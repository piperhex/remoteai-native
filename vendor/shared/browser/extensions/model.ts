export interface BrowserExtension {
  id: string; name: string; enabled: boolean; pinned: boolean;
  version?: string; icon?: string; popup: boolean; permissions?: string[];
  market?: { id: string; sha256: string };
}
export interface ChromeExtension {
  path: string; profile: string; name: string; version: string; icon?: string; permissions: string[];
}
export type ExtensionRequest = { action: 'list' | 'discover' }
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
