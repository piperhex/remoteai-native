import type { DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import { localMappingAddress, mappingAddress } from '../../vendor/shared/port-mapping/target';

export const CERTIFICATE_ERROR_CODE = -27841;
const FINGERPRINT = /^[0-9A-F]{64}$/;

export function httpsOrigin(address: string) {
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : undefined;
  } catch { return undefined; }
}

export function mappingTrustTarget(scope: string | undefined, address: string, entries: readonly DeviceMappingEntry[]) {
  const origin = httpsOrigin(address);
  if (!scope || !origin) return;
  const mapping = entries.find(({ connected, entry }) => connected && entry.status === 'running'
    && entry.protocol !== 'udp' && httpsOrigin(`https://${localMappingAddress(entry)}`) === origin);
  if (!mapping) return;
  const { deviceId, entry } = mapping;
  const key = JSON.stringify([scope, deviceId, entry.id, origin, mappingAddress(entry)]);
  return { origin, key: 'mapping-certificate:' + key };
}

export function certificateFingerprint(error: { code: number; description: string; url: string }, origin?: string) {
  return origin && httpsOrigin(error.url) === origin && error.code === CERTIFICATE_ERROR_CODE
    && FINGERPRINT.test(error.description) ? error.description : undefined;
}
