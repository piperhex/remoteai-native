import type { ReactNode } from 'react';

export interface NativeBrowserResource {
  url: string;
  title: string;
  render: (options: { active: boolean; close: () => void }) => ReactNode;
}

export interface NativeBrowserTab {
  id: string;
  url: string;
  title: string;
  preview?: string;
  request?: { url: string };
  desktop?: boolean;
  resource?: NativeBrowserResource;
}
export interface NativeBrowserTabs { tabs: NativeBrowserTab[]; activeId: string }

let sequence = 0;
export function newBrowserTab(url = ''): NativeBrowserTab {
  return { id: `browser-${Date.now()}-${++sequence}`, url, title: '' };
}

export function closeBrowserTab(state: NativeBrowserTabs, id: string): NativeBrowserTabs {
  const index = state.tabs.findIndex(tab => tab.id === id);
  if (index < 0) return state;
  const tabs = state.tabs.filter(tab => tab.id !== id);
  if (!tabs.length) tabs.push(newBrowserTab());
  const activeId = state.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : state.activeId;
  return { tabs, activeId };
}

export function restoreBrowserTabs(raw: string | null, fallbackUrl: string): NativeBrowserTabs {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (value && typeof value === 'object' && 'tabs' in value && Array.isArray(value.tabs)) {
      const tabs = value.tabs.filter((entry): entry is { url: string; title?: string; desktop?: boolean } =>
        !!entry && typeof entry === 'object' && typeof entry.url === 'string'
        && (!entry.url || /^https?:\/\//i.test(entry.url)))
        .map(entry => ({ ...newBrowserTab(entry.url), desktop: entry.desktop === true,
          title: typeof entry.title === 'string' ? entry.title : '' }));
      if (tabs.length) {
        const index = 'activeIndex' in value && typeof value.activeIndex === 'number' ? value.activeIndex : 0;
        return { tabs, activeId: (tabs[index] ?? tabs[0]).id };
      }
    }
  } catch { /* An invalid restoration hint must not prevent opening the browser. */ }
  const tab = newBrowserTab(fallbackUrl);
  return { tabs: [tab], activeId: tab.id };
}

export function serializeBrowserTabs(state: NativeBrowserTabs): string {
  // Conversation resources depend on live, scoped clients and must never be restored as ordinary URLs.
  const tabs = state.tabs.filter(tab => !tab.resource);
  return JSON.stringify({ tabs: tabs.map(({ url, title, desktop }) => ({ url, title, desktop })),
    activeIndex: Math.max(0, tabs.findIndex(tab => tab.id === state.activeId)) });
}
