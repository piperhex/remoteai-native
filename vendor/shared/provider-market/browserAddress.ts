import { pageUrl } from './pageLink';

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const HOST_WITH_PORT = /^(?:localhost|[^:/?#]+\.[^:/?#]+):\d+(?:[/?#]|$)/i;

/** Address-bar convenience only; stored page links and navigation events still require an explicit protocol. */
export function browserAddress(value: string): URL | null {
  const address = value.trim();
  if (!address) return null;
  if (address.startsWith('//')) return pageUrl(`https:${address}`);
  if (address.startsWith('/')) return null;
  // A hostname's port must not be mistaken for a scheme; unsupported explicit schemes stay rejected.
  if (URL_SCHEME.test(address) && !HOST_WITH_PORT.test(address)) return pageUrl(address);
  return pageUrl(`https://${address}`);
}
