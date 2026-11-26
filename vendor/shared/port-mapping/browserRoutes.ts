import type { MappingTunnel } from './types';

export interface BrowserRoute { domain: string; port: number }

/** Only live TCP listeners publish browser routes. Serialize platform updates across all sessions. */
export class BrowserRoutes {
  private routes = new Map<symbol, BrowserRoute>();
  private pending = Promise.resolve();
  constructor(private readonly configure: (routes: BrowserRoute[]) => Promise<void>) {}

  attach(tunnel: MappingTunnel, port: number): MappingTunnel {
    const owner = Symbol();
    let closed = false;
    const update = (domain?: string) => {
      const current = this.routes.get(owner);
      const custom = domain && domain !== 'localhost' && !domain.endsWith('.localhost') ? domain : undefined;
      if (custom === current?.domain) return this.pending;
      if (custom) this.routes.set(owner, { domain: custom, port });
      else this.routes.delete(owner);
      const routes = [...this.routes.values()];
      const applied = this.pending.then(() => this.configure(routes));
      // A rejected configuration must not prevent a later removal or retry.
      this.pending = applied.catch(() => {});
      return applied;
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
