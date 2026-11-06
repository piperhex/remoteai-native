import type { LoungeAccount } from './types';

const MAX_VERSION_LENGTH = 64;
const MAX_CLIENT_VERSIONS = 16;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;

export function parseClientVersion(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= MAX_VERSION_LENGTH && VERSION_PATTERN.test(value)
    ? value : undefined;
}

export function parseClientVersions(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_CLIENT_VERSIONS || value.some(item => !parseClientVersion(item))) return;
  return [...new Set(value)].sort();
}

export function clientVersionLabel(user: LoungeAccount): string {
  return (parseClientVersions(user.clientVersions) ?? []).map(version => `v${version}`).join(' · ');
}
