/** Public identity and presence used by computer pickers. */
export interface ComputerSystem { platform: string; ipAddress?: string | null }
export interface ChatComputer extends ComputerSystem { deviceId: string; name: string; online: boolean }

const platformNames: ReadonlyMap<string, string> = new Map([
  ['windows', 'Windows'], ['win32', 'Windows'], ['darwin', 'macOS'], ['macos', 'macOS'], ['linux', 'Linux'],
]);

export function computerDetails(device?: ComputerSystem, unknownPlatform = '') {
  if (!device) return '';
  const platform = device.platform.trim();
  const key = platform.toLowerCase();
  const system = platformNames.get(key) ?? (key === 'unknown' ? '' : platform);
  return [system || unknownPlatform, device.ipAddress?.trim()].filter(Boolean).join(' · ');
}
