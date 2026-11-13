export const MAX_HISTORY = 3000;
export const MAX_PASSWORDS = 500;
export const MAX_DATA_BYTES = 4 * 1024 * 1024;
export const VAULT_ID = 'vault';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'all';
export const timeRanges: TimeRange[] = ['hour', 'day', 'week', 'month', 'all'];
const durations = { hour: 3600000, day: 86400000, week: 604800000, month: 2419200000 };
export const rangeStart = (range: TimeRange, now = Date.now()) => range === 'all' ? 0 : now - durations[range];

export interface Visit { id: string; kind: 'visit'; url: string; title: string; at: number }
export interface Sealed { nonce: string; ciphertext: string }
export interface VaultHeader { id: 'vault'; kind: 'vault'; salt: string; check: Sealed }
export interface PasswordRecord { id: string; kind: 'password'; salt: string; secret: Sealed; at: number }
export interface Login { origin: string; username: string; password: string }
export type BrowserRecord = Visit | VaultHeader | PasswordRecord;
export interface BrowserDocument { revision: number; entries: BrowserRecord[] }
export type BrowserEdits = Record<string, BrowserRecord | null>;
export interface BrowserReply { document: BrowserDocument; accepted: boolean }

export function browserUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    return url;
  } catch { return; }
}
export function loginOrigin(value: string): string | undefined {
  const url = browserUrl(value);
  // Passwords are never offered to cleartext sites, including port-forwarded HTTP services.
  return url?.protocol === 'https:' ? url.origin : undefined;
}
const hex = (value: unknown, length: number) => typeof value === 'string'
  && value.length === length && /^[a-f0-9]+$/.test(value);
function sealed(value: unknown): value is Sealed {
  if (!value || typeof value !== 'object') return false;
  const data = value as Sealed;
  return hex(data.nonce, 24) && typeof data.ciphertext === 'string'
    && data.ciphertext.length >= 32 && data.ciphertext.length <= 40000 && /^[a-f0-9]+$/.test(data.ciphertext);
}
export function isBrowserRecord(value: unknown): value is BrowserRecord {
  if (!value || typeof value !== 'object') return false;
  const entry = value as BrowserRecord;
  if (typeof entry.id !== 'string' || !/^[\w-]{1,80}$/.test(entry.id)) return false;
  if (entry.kind === 'vault') return entry.id === VAULT_ID && hex(entry.salt, 32) && sealed(entry.check);
  if (entry.id === VAULT_ID || !Number.isSafeInteger(entry.at) || entry.at < 0) return false;
  if (entry.kind === 'password') return hex(entry.salt, 32) && sealed(entry.secret);
  return entry.kind === 'visit' && typeof entry.url === 'string' && entry.url.length <= 8192
    && !!browserUrl(entry.url) && typeof entry.title === 'string' && entry.title.length <= 512;
}
export function readBrowserDocument(value: unknown): BrowserDocument | undefined {
  if (!value || typeof value !== 'object') return;
  const doc = value as BrowserDocument;
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 0 || !Array.isArray(doc.entries)
    || doc.entries.length > MAX_HISTORY + MAX_PASSWORDS + 1 || !doc.entries.every(isBrowserRecord)) return;
  if (new Set(doc.entries.map(entry => entry.id)).size !== doc.entries.length) return;
  const vault = doc.entries.find((entry): entry is VaultHeader => entry.kind === 'vault');
  if (doc.entries.some(entry => entry.kind === 'password' && entry.salt !== vault?.salt)) return;
  return doc;
}
export function mergeBrowserData(entries: BrowserRecord[], edits: BrowserEdits): BrowserRecord[] {
  const records = new Map(entries.map(entry => [entry.id, entry]));
  Object.entries(edits).forEach(([id, entry]) => entry ? records.set(id, entry) : records.delete(id));
  const result = [...records.values()];
  const history = result.filter((entry): entry is Visit => entry.kind === 'visit')
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, MAX_HISTORY);
  return [...result.filter(entry => entry.kind !== 'visit'), ...history];
}
export function historyGroups(entries: Visit[], query: string) {
  const groups = new Map<string, Visit[]>(), needle = query.trim().toLocaleLowerCase();
  for (const entry of entries) {
    if (needle && !`${entry.title} ${entry.url}`.toLocaleLowerCase().includes(needle)) continue;
    const date = new Date(entry.at), key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups];
}
