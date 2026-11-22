import { useEffect, useRef, useState } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { closeBrowserTab, createBrowserHome, newBrowserTab, restoreBrowserTabs, serializeBrowserTabs,
  type NativeBrowserTab, type NativeBrowserResource } from './browserTabs';
import { mappingBrowserUrl } from '../chat/portMapping/useMappingBrowser';

const MAX_TAB_PREVIEWS = 12;
const MAX_PREVIEW_CHARS = 256 * 1024;

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
  const previewOrder = useRef<string[]>([]);
  const setPreview = (id: string, preview: string) => {
    const kept = [id, ...previewOrder.current.filter(previous => previous !== id)].slice(0, MAX_TAB_PREVIEWS);
    previewOrder.current = kept;
    setState(current => ({ ...current, tabs: current.tabs.map(tab => {
      if (tab.id === id) return { ...tab, preview: preview.length <= MAX_PREVIEW_CHARS ? preview : undefined };
      return tab.preview && !kept.includes(tab.id) ? { ...tab, preview: undefined } : tab;
    }) }));
  };
  const add = (url = '', resource?: NativeBrowserResource) => {
    const tab = { ...newBrowserTab(url), resource, title: resource?.title ?? '' };
    setState(current => ({ tabs: [...current.tabs, tab], activeId: tab.id }));
  };
  const visit = (url: string) => setState(current => ({ ...current,
    tabs: current.tabs.map(tab => tab.id === current.activeId ? { ...tab, request: { url } } : tab) }));
  const consumeRequest = (id: string, request: { url: string }) => setState(current => ({ ...current,
    tabs: current.tabs.map(tab => tab.id === id && tab.request === request
      ? { ...tab, url: request.url, request: undefined } : tab) }));
  return { ...state, update, add, visit, setPreview, consumeRequest,
    closeAll: () => setState(createBrowserHome()),
    select: (activeId: string) => setState(current => ({ ...current, activeId })),
    remove: (id: string) => setState(current => closeBrowserTab(current, id)) };
}
