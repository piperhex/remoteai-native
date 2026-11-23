const capabilities = [
  'provider-switch', 'provider-group-switch', 'restart-codex', 'gui-model-switch',
  'aggregate-switch', 'gui-aggregate-switch', 'account-usage', 'account-auth-sync', 'app-update',
  'remote-command', 'screen-power', 'screen-power-status',
] as const;

export type RemoteControlCapability = typeof capabilities[number];

const recognized: ReadonlySet<string> = new Set(capabilities);

export function remoteControlCapabilities(value: unknown): RemoteControlCapability[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is RemoteControlCapability => typeof entry === 'string' && recognized.has(entry));
}
