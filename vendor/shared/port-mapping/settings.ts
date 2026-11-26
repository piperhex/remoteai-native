import { mappingAddress, normalizeMappingDomain, normalizeMappingHost } from './target';

export const MAX_PORT_MAPPINGS = 8;
export const MAX_PORT = 65535;
export type MappingProtocol = 'tcp' | 'udp' | 'both';
export const MAPPING_PROTOCOLS: readonly MappingProtocol[] = ['tcp', 'udp', 'both'];
export const protocolLabel = (protocol?: MappingProtocol) => protocol === 'both' ? 'TCP + UDP'
  : (protocol ?? 'tcp').toUpperCase();
export interface PortMapping {
  id: string; remoteHost?: string; remotePort: number; localPort: number; updatedAt?: number;
  protocol?: MappingProtocol;
  localDomain?: string;
}
export type MappingMode = 'tcp' | 'preview';
export interface MappingStorage {
  getItem: (key: string) => string | null; setItem: (key: string, value: string) => void;
}
const STORAGE_PREFIX = 'codex-port-forwarding:';

export function validPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_PORT;
}

export function readPortMappings(scope: string, storage: MappingStorage = localStorage,
  createId: () => string = () => crypto.randomUUID(), mode: MappingMode = 'tcp'): PortMapping[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_PREFIX + scope) ?? '[]');
    if (!Array.isArray(saved)) return [];
    const mappings: PortMapping[] = [];
    // Sync conflicts can retain more than the cloud limit locally until the user removes an entry.
    for (const value of saved) {
      const mapping = readMapping(value, createId);
      if (mapping && !mappings.some(saved => mappingConflicts(saved, mapping, mode))) mappings.push(mapping);
    }
    return mappings;
  } catch { return []; } // Unavailable storage must not prevent a temporary mapping.
}

export function readMapping(value: unknown, createId: () => string): PortMapping | undefined {
  if (!value || typeof value !== 'object') return;
  const entry = value as Record<string, unknown>;
  if (!validPort(entry.remotePort) || !validPort(entry.localPort)) return;
  if (entry.remoteHost !== undefined && typeof entry.remoteHost !== 'string') return;
  if (entry.localDomain !== undefined && typeof entry.localDomain !== 'string') return;
  if (entry.protocol !== undefined && !MAPPING_PROTOCOLS.includes(entry.protocol as MappingProtocol)) return;
  try {
    return mappingConfig({ id: typeof entry.id === 'string' && /^[\w-]{1,64}$/.test(entry.id) ? entry.id : createId(),
      remoteHost: entry.remoteHost, remotePort: entry.remotePort, localPort: entry.localPort,
      localDomain: entry.localDomain, protocol: entry.protocol as MappingProtocol | undefined,
      updatedAt: typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) ? entry.updatedAt : undefined });
  } catch { return; } // Discard invalid saved targets without losing the remaining mappings.
}

export function savePortMappings(scope: string, entries: readonly PortMapping[],
  storage: MappingStorage = localStorage) {
  try {
    storage.setItem(STORAGE_PREFIX + scope, JSON.stringify(entries.map(mappingConfig)));
  } catch { console.warn('Port forwarding settings could not be saved'); }
}

export function mappingConfig({ id, remoteHost, remotePort, localPort, updatedAt, protocol, localDomain }:
  PortMapping): PortMapping {
  return { id, remoteHost: normalizeMappingHost(remoteHost), remotePort, localPort,
    ...(protocol === undefined ? {} : { protocol }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...(localDomain === undefined ? {} : { localDomain: normalizeMappingDomain(localDomain) ?? '' }) };
}

export function mappingConflicts(left: Omit<PortMapping, 'id'>, right: Omit<PortMapping, 'id'>,
  mode: MappingMode = 'tcp'): boolean {
  const overlaps = (left.protocol ?? 'tcp') === (right.protocol ?? 'tcp')
    || left.protocol === 'both' || right.protocol === 'both';
  return overlaps && (mode === 'preview' ? mappingAddress(left) === mappingAddress(right)
    : left.localPort === right.localPort);
}
