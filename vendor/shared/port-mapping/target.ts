export const DEFAULT_MAPPING_HOST = '127.0.0.1';
export const EXAMPLE_MAPPING_DOMAIN = 'app.localhost';
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const INVALID_MAPPING_HOST = '请输入有效的 IPv4 或 IPv6 地址。';

/** Accept IP literals only, so a pasted URL cannot change the selected port or destination. */
export function normalizeMappingHost(value: string = ''): string {
  const host = value.trim() || DEFAULT_MAPPING_HOST;
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host)
    && host.split('.').every(part => Number(part) <= 255) && host !== '0.0.0.0') return host;
  const ipv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (ipv6.includes(':') && /^[\da-f:.]+$/i.test(ipv6)) {
    try {
      const normalized = new URL(`http://[${ipv6}]`).hostname.slice(1, -1);
      if (normalized && normalized !== '::') return normalized;
    } catch { /* Invalid IPv6 input is reported with the same validation message as IPv4. */ }
  }
  throw new Error(INVALID_MAPPING_HOST);
}

export function mappingAddress(target: { remoteHost?: string; remotePort: number }): string {
  const host = normalizeMappingHost(target.remoteHost);
  return `${host.includes(':') ? `[${host}]` : host}:${target.remotePort}`;
}

export function mappingOrigin(target: { remoteHost?: string; remotePort: number }): string {
  return `http://${mappingAddress(target)}`;
}

export function normalizeMappingDomain(value = ''): string | undefined {
  const domain = value.trim().toLowerCase();
  if (!domain) return;
  if (domain === 'localhost') return domain;
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || !/^[a-z]/.test(labels[labels.length - 1])
    || !labels.every(label => DOMAIN_LABEL.test(label))) {
    throw new Error('client.mappingEditor.invalidLocalDomain');
  }
  return domain;
}

export function localMappingAddress({ localDomain, localPort }: { localDomain?: string; localPort: number }): string {
  return `${localDomain || DEFAULT_MAPPING_HOST}:${localPort}`;
}

export function localMappingUrl(target: Parameters<typeof localMappingAddress>[0]): string {
  return `http://${localMappingAddress(target)}`;
}
