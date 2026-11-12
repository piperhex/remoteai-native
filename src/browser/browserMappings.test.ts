import { expect, it } from 'vitest';
import type { ForwardingEntry } from '../../vendor/shared/port-mapping/service';
import { runningBrowserMappings } from './browserMappings';

it('lists active TCP-capable mappings only for current devices and updates when they stop', () => {
  const mapping = (id: string, patch: Partial<ForwardingEntry> = {}) => ({ deviceId: 'pc', connected: true,
    entry: { id, remotePort: 3000, localPort: 13000, status: 'running', ...patch } as ForwardingEntry });
  const entries = [mapping('legacy'), mapping('tcp', { protocol: 'tcp' }), mapping('both', { protocol: 'both' }),
    mapping('udp', { protocol: 'udp' }), mapping('stopped', { status: 'stopped' }),
    mapping('starting', { status: 'starting' }), mapping('error', { status: 'error' }),
    { ...mapping('offline'), connected: false }, { ...mapping('removed'), deviceId: 'removed' }];
  const devices = [{ deviceId: 'pc', name: 'PC' }];
  expect(runningBrowserMappings(entries, devices).map(value => value.entry.id)).toEqual(['legacy', 'tcp', 'both']);
  entries[1].entry.status = 'stopping';
  expect(runningBrowserMappings(entries, devices).map(value => value.entry.id)).toEqual(['legacy', 'both']);
  expect(runningBrowserMappings(entries, [])).toEqual([]);
});
