import { createContext, useContext } from 'react';
import type { NativeBrowserResource } from './browserTabs';

export const NativeBrowserContext = createContext<{
  open: (url?: string) => void;
  openTab: (url: string) => void;
  openResource: (resource: NativeBrowserResource) => void;
  close: () => void;
  visible: boolean;
  hasBottomNavigation: boolean;
  tabs?: { id: string; at: number }[];
  closeTabs?: (ids: string[]) => void;
  reloadTabs?: () => void;
} | null>(null);

export function useBrowserSafeAreaEdges() {
  const browser = useContext(NativeBrowserContext);
  return browser?.hasBottomNavigation ? ['top', 'left', 'right'] as const : undefined;
}
export function useNativeBrowser() {
  const browser = useContext(NativeBrowserContext);
  if (!browser) throw new Error('Native browser provider is missing');
  return browser;
}
