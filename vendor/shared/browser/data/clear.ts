import { rangeStart, type TimeRange } from './model';
import type { BrowserDataStore } from './store';
import type { PasswordVault } from './vault';
import type { DataCategory } from './presentation';
export interface DataControls {
  tabs: { id: string; at: number }[];
  closeTabs: (ids: string[]) => void;
  clearSiteData?: (options: { cookies: boolean; cache: boolean }) => Promise<void>;
}
export async function clearBrowserData(options: {
  store: BrowserDataStore; vault: PasswordVault; controls: DataControls;
  categories: DataCategory[]; range: TimeRange; now?: number;
}) {
  const { store, vault, controls, categories } = options;
  const since = rangeStart(options.range, options.now), selected = new Set(categories);
  if (selected.has('passwords') && !vault.snapshot().unlocked) throw new Error('vault-locked');
  if (selected.has('cookies') || selected.has('cache')) {
    if (!controls.clearSiteData) throw new Error('site-data-unavailable');
    await controls.clearSiteData({ cookies: selected.has('cookies'), cache: selected.has('cache') });
  }
  const ids = store.snapshot().entries.filter(entry => entry.kind === 'visit' && selected.has('history')
    && entry.at >= since || entry.kind === 'password' && selected.has('passwords') && entry.at >= since)
    .map(entry => entry.id);
  if (ids.length) store.remove(ids);
  if (selected.has('tabs')) controls.closeTabs(controls.tabs.filter(tab => tab.at >= since).map(tab => tab.id));
}
