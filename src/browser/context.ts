import { createContext, useContext } from 'react';

export const NativeBrowserContext = createContext<{
  open: (url?: string) => void;
  close: () => void;
  visible: boolean;
  hasBottomNavigation: boolean;
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
