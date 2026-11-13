import { useEffect, useState } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { closeBrowserTab, createBrowserHome, newBrowserTab, restoreBrowserTabs, serializeBrowserTabs,
  type NativeBrowserTab, type NativeBrowserResource } from './browserTabs';
import { mappingBrowserUrl } from '../chat/portMapping/useMappingBrowser';

export function useNativeBrowserTabs(scope: string) {
  const key = `remoteai:browser-tabs:${scope}`;
  const [state, setState] = useState(() => {
    try {
      const fallback = mappingBrowserUrl(Storage.getItemSync(`remoteai:browser-last-url:${scope}`) ?? '') ?? '';
      return restoreBrowserTabs(Storage.getItemSync(key), fallback);
    } catch { return restoreBrowserTabs(null, ''); }
  });
  const saved = serializeBrowserTabs(state);
  useEffect(() => {
    try { Storage.setItemSync(key, saved); }
    catch { /* Keep the live sessions usable if saving restoration hints fails. */ }
  }, [key, saved]);
  const update = (id: string, patch: Partial<NativeBrowserTab>) => setState(current => ({ ...current,
    tabs: current.tabs.map(tab => tab.id === id ? { ...tab, ...patch } : tab) }));
  const add = (url = '', resource?: NativeBrowserResource) => {
    const tab = { ...newBrowserTab(url), resource, title: resource?.title ?? '' };
    setState(current => ({ tabs: [...current.tabs, tab], activeId: tab.id }));
  };
  const visit = (url: string) => setState(current => ({ ...current,
    tabs: current.tabs.map(tab => tab.id === current.activeId ? { ...tab, request: { url } } : tab) }));
  return { ...state, update, add, visit,
    closeAll: () => setState(createBrowserHome()),
    select: (activeId: string) => setState(current => ({ ...current, activeId })),
    remove: (id: string) => setState(current => closeBrowserTab(current, id)) };
}
