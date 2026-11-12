import { DEFAULT_SEARCH_ENGINE, searchEngine, type SearchEngine } from './searchEngine';

export type SearchStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
export const SEARCH_ENGINE_KEY = 'remoteai:browser-search-engine';

export class SearchPreference {
  private state = { engine: DEFAULT_SEARCH_ENGINE, saveError: false };
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage?: SearchStorage) {
    try { this.state.engine = searchEngine(storage?.getItem(SEARCH_ENGINE_KEY)); }
    catch { /* An unavailable preference must not prevent browsing with the default engine. */ }
  }
  snapshot = () => this.state;
  subscribe = (changed: () => void) => { this.listeners.add(changed); return () => { this.listeners.delete(changed); }; };
  select = (engine: SearchEngine) => {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(SEARCH_ENGINE_KEY, engine);
      this.state = { engine, saveError: false };
    } catch { this.state = { ...this.state, saveError: true }; }
    this.listeners.forEach(changed => changed());
  };
}
