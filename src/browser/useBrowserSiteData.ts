import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import type { DataControls } from '../../vendor/shared/browser/data/clear';

interface SiteDataBridge { clear: (cookies: boolean, cache: boolean) => Promise<void> }
const bridge = NativeModules.BrowserData as SiteDataBridge | undefined;

export function useBrowserSiteData(resetPreviews: () => void) {
  const [suspended, setSuspended] = useState(false);
  const [generation, setGeneration] = useState(0);
  const pending = useRef<(() => void) | undefined>(undefined);
  const busy = useRef(false);
  const clear: NonNullable<DataControls['clearSiteData']> = useCallback(async ({ cookies, cache }) => {
    if (!bridge || busy.current) throw new Error('browser-data-unavailable');
    busy.current = true;
    try {
      if (!cookies) { await bridge.clear(false, cache); return; }
      resetPreviews();
      setGeneration(value => value + 1);
      await new Promise<void>((resolve, reject) => {
        pending.current = () => { void Promise.resolve().then(() => bridge.clear(true, cache)).then(resolve, reject); };
        setSuspended(true);
      });
    } finally {
      busy.current = false;
      if (cookies) setSuspended(false);
    }
  }, [resetPreviews]);
  useEffect(() => {
    if (!suspended) return;
    const start = pending.current;
    pending.current = undefined;
    // Sites can write their session back until the WebViews leave the native tree.
    start?.();
  }, [suspended]);
  return { generation, suspended, clearSiteData: bridge ? clear : undefined };
}
