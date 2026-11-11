/** Byte counts describe the current download, not estimated overall installation progress. */
export interface InstallationProgress {
  phase: 'preparing' | 'downloading' | 'installing' | 'verifying';
  downloaded: number;
  total?: number;
  fileName?: string;
}
