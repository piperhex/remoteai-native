import type { DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import type { RemoteDevice } from '../types';

export type BrowserDevice = Pick<RemoteDevice, 'deviceId' | 'name'>;
type MappingAddress = Pick<DeviceMappingEntry, 'deviceId' | 'entry' | 'connected'>;

export function runningBrowserMappings<T extends MappingAddress>(entries: T[], devices: readonly BrowserDevice[]): T[] {
  return entries.filter(({ deviceId, entry, connected }) => connected && entry.status === 'running'
    && entry.protocol !== 'udp' && devices.some(device => device.deviceId === deviceId));
}
