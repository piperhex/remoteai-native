import type { MappingTunnel } from './types';

export interface BrowserRoute { domain: string; port: number; target?: string }

/** Only live TCP listeners publish browser routes. Serialize platform updates across all sessions. */
export class BrowserRoutes {
  private routes = new Map<symbol, BrowserRoute>();
  private local: BrowserRoute[] = [];
  private pending = Promise.resolve();
  constructor(private readonly configure: (routes: BrowserRoute[]) => Promise<void>) {}

  setLocal(routes: BrowserRoute[]) {
    this.local = routes;
    return this.apply();
  }

  private apply() {
    const routes = [...this.local, ...[...this.routes.values()].filter(remote =>
      !this.local.some(local => local.domain === remote.domain && local.port === remote.port))];
    const applied = this.pending.then(() => this.configure(routes));
    this.pending = applied.catch(() => {});
    return applied;
  }

  attach(tunnel: MappingTunnel, port: number): MappingTunnel {
    const owner = Symbol();
    let closed = false;
    const update = (domain?: string) => {
      const current = this.routes.get(owner);
      const custom = domain && domain !== 'localhost' && !domain.endsWith('.localhost') ? domain : undefined;
      if (custom === current?.domain) return this.pending;
      if (custom) this.routes.set(owner, { domain: custom, port });
      else this.routes.delete(owner);
      return this.apply();
    };
    return { resolve: (resource, url) => tunnel.resolve(resource, url),
      setBrowserDomain: domain => closed ? Promise.resolve() : update(domain),
      close: async () => {
        closed = true;
        try { await update(); }
        catch { console.warn('Could not update browser routes while closing a port mapping'); }
        finally { await tunnel.close(); }
      } };
  }
}
