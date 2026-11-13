import { browserAddress } from '../provider-market/browserAddress';
import { DEFAULT_SEARCH_ENGINE, searchUrl, type SearchEngine } from './searchEngine';

const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const SEARCH_OPERATOR = /^(?:site|filetype|intitle|inurl|related|cache):/i;
const NON_SEARCH_SCHEME = /^(?:https?|javascript|data|file|vbscript|about|blob|intent):/i;
const HOST_WITH_PORT = /^(?:\[[\da-f:]+\]|[^\s/:?#]+):\d+(?:[/?#]|$)/i;

/** Only typed address-bar input may become a search; links and navigation events stay URL-only. */
export function browserInput(value: string, engine: SearchEngine = DEFAULT_SEARCH_ENGINE,
  defaultProtocol: 'http:' | 'https:' = 'https:'): URL | null {
  const input = value.trim();
  if (!input) return null;
  if (SEARCH_OPERATOR.test(input)) return searchUrl(input, engine);
  if (EXPLICIT_SCHEME.test(input) && !HOST_WITH_PORT.test(input)) {
    if (/\s/.test(input) && !NON_SEARCH_SCHEME.test(input)) return searchUrl(input, engine);
    return browserAddress(input);
  }
  if (/\s/.test(input)) return searchUrl(input, engine);
  if (input.startsWith('/') || input.includes('\\')) return browserAddress(input);
  const candidate = browserAddress(input);
  // Inspect what was typed: URL parsing turns bare numbers such as 666 into IPv4 addresses.
  const host = input.split(/[/?#]/, 1)[0];
  const looksLikeHost = candidate && (host.includes('.') || host.toLowerCase() === 'localhost'
    || host.startsWith('[') || HOST_WITH_PORT.test(input));
  if (looksLikeHost) { candidate.protocol = defaultProtocol; return candidate; }
  // Preserve errors for malformed host/port input instead of silently searching a broken URL.
  if (HOST_WITH_PORT.test(input) || input.includes('@')) return null;
  return searchUrl(input, engine);
}
