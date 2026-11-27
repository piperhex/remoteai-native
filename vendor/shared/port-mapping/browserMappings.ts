import type { ForwardingEntry } from './service';
import { localMappingUrl, mappingAddress } from './target';

interface MappingSource {
  snapshot(): readonly ForwardingEntry[];
  subscribe(listener: () => void): () => void;
}

export interface BrowserMapping {
  id: string;
  url: string;
  target: string;
}

/** Read-only index of mounted desktop forwarding services; registration never starts a tunnel. */
export class BrowserMappingStore {
  private readonly sources = new Map<symbol, { scope: string; source: MappingSource; local: boolean }>();
  private readonly listeners = new Set<() => void>();
  private entries: BrowserMapping[] = [];

  snapshot = () => this.entries;
  findAddress(url: URL) {
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    for (const entry of this.entries) {
      const mapped = new URL(entry.url);
      if (mapped.hostname === url.hostname && (mapped.port || (mapped.protocol === 'https:' ? '443' : '80')) === port) {
        return mapped;
      }
    }
  }
  matches(url: URL) {
    return !!this.findAddress(url);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  register = (scope: string, source: MappingSource, local = false) => {
    const key = Symbol(scope);
    this.sources.set(key, { scope, source, local });
    const unsubscribe = source.subscribe(this.update);
    this.update();
    return () => { unsubscribe(); this.sources.delete(key); this.update(); };
  };
  private update = () => {
    this.entries = [...this.sources.values()].flatMap(({ scope, source, local }) => source.snapshot()
      .filter(entry => entry.protocol !== 'udp' && (local ? !!entry.localDomain : entry.status === 'running'))
      .map(entry => ({ id: JSON.stringify([scope, entry.id]), url: `${localMappingUrl(entry)}/`,
        target: mappingAddress(entry) })));
    this.listeners.forEach(listener => listener());
  };
}

// Each application WebView owns its index; usePortForwarding unregisters when its service is disposed.
export const browserMappings = new BrowserMappingStore();
