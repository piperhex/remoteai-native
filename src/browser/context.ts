import { createContext, useContext } from 'react';

export const NativeBrowserContext = createContext<{ open: (url?: string) => void } | null>(null);
export function useNativeBrowser() {
  const browser = useContext(NativeBrowserContext);
  if (!browser) throw new Error('Native browser provider is missing');
  return browser;
}
