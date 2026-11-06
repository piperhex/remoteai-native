import type { LoungeAccount } from './types';

const MAX_VERSION_LENGTH = 64;
const MAX_CLIENT_VERSIONS = 16;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
export type LoungeClientPlatform = 'desktop' | 'mobile';
export interface LoungeClientInfo { version: string; platform?: LoungeClientPlatform }

export function browserClientPlatform(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): LoungeClientPlatform {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ? 'mobile' : 'desktop';
}

export function parseClientVersion(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= MAX_VERSION_LENGTH && VERSION_PATTERN.test(value)
    ? value : undefined;
}

export function parseClientVersions(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_CLIENT_VERSIONS || value.some(item => !parseClientVersion(item))) return;
  return [...new Set(value)].sort();
}

export function clientVersionLabel(user: LoungeAccount): string {
  return clientVersionItems(user).map(client => `v${client.version}`).join(' · ');
}

export function parseClients(value: unknown): LoungeClientInfo[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_CLIENT_VERSIONS) return;
  const clients = new Map<string, LoungeClientInfo>();
  for (const input of value as unknown[]) {
    if (!input || typeof input !== 'object') return;
    const item = input as Partial<LoungeClientInfo>;
    const version = parseClientVersion(item.version);
    if (!version || item.platform !== undefined && item.platform !== 'desktop' && item.platform !== 'mobile') return;
    clients.set(`${item.platform ?? ''}:${version}`, { version, platform: item.platform });
  }
  const order = { desktop: 0, mobile: 1, unknown: 2 };
  return [...clients.values()].sort((a, b) => order[a.platform ?? 'unknown'] - order[b.platform ?? 'unknown']
    || a.version.localeCompare(b.version));
}

export function clientVersionItems(user: LoungeAccount): LoungeClientInfo[] {
  return parseClients(user.clients) ?? (parseClientVersions(user.clientVersions) ?? []).map(version => ({ version }));
}
