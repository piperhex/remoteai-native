interface ScreenDevice { platform: string }

export interface ScreenPowerDevice extends ScreenDevice {
  deviceId: string;
  online: boolean;
  capabilities: readonly string[];
}

export type ScreenPowerState = 'on' | 'off';
export type ScreenPowerRequest = (path: string, init: RequestInit) => Promise<unknown>;
export type ReadScreenPower = (deviceId: string, signal: AbortSignal) => Promise<ScreenPowerState>;
export interface ScreenPowerControl {
  read: ReadScreenPower;
  change: (device: ScreenPowerDevice, turnOff: boolean) => void;
}

const screenPowerErrors = [
  'client.deviceScreen.failed', 'client.deviceScreen.updateRequired', 'client.deviceScreen.openComputerApp',
] as const;
type ScreenPowerError = typeof screenPowerErrors[number];
export type ScreenPowerReading = ScreenPowerState | ScreenPowerError | undefined;

export function supportsScreenControl(device: ScreenDevice) {
  return device.platform.trim().toLowerCase() === 'windows';
}

export function screenPowerPath(deviceId: string) {
  return `/devices/${encodeURIComponent(deviceId)}/screen-power`;
}

export function screenPowerError(error: unknown): ScreenPowerError {
  return screenPowerErrors.find(key => error instanceof Error && error.message === key) ?? screenPowerErrors[0];
}

export async function readScreenPower(request: ScreenPowerRequest, deviceId: string, signal: AbortSignal) {
  const result = await request(screenPowerPath(deviceId), { method: 'GET', signal });
  const state = result && typeof result === 'object' && 'state' in result ? result.state : undefined;
  if (state === 'on' || state === 'off') return state;
  throw new Error(screenPowerErrors[0]);
}

export function screenPowerAction(device: ScreenPowerDevice, reading: ScreenPowerReading) {
  if (!device.online) return { label: 'client.remoteDesktop.monitor', detail: 'client.chat.offline' } as const;
  if (reading === 'on') return { label: 'client.deviceScreen.turnOff', action: 'off' } as const;
  if (reading === 'off') return { label: 'client.deviceScreen.restore', action: 'on' } as const;
  const detail = device.capabilities.includes('screen-power-status')
    ? reading ?? 'client.mobile.loading' : 'client.deviceScreen.updateRequired';
  return { label: 'client.remoteDesktop.monitor', detail } as const;
}
