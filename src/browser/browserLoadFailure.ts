import type { DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import { localMappingUrl } from '../../vendor/shared/port-mapping/target';

type LoadFailure = { code: number; description: string; domain?: string; url: string };
type Mapping = Pick<DeviceMappingEntry, 'connected' | 'entry'>;
const ANDROID_TLS_ERROR = 'net::ERR_SSL_PROTOCOL_ERROR';
const IOS_SECURE_CONNECTION_FAILED = -1200;

export function isTlsProtocolFailure({ code, description, domain }: LoadFailure) {
  return description === ANDROID_TLS_ERROR || domain === 'NSURLErrorDomain' && code === IOS_SECURE_CONNECTION_FAILED;
}

export function mappedHttpRetry(failure: LoadFailure, mappings: readonly Mapping[]) {
  if (!isTlsProtocolFailure(failure)) return;
  try {
    const url = new URL(failure.url);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    const port = url.port || '443';
    url.protocol = 'http:';
    url.port = port;
    const match = mappings.some(({ connected, entry }) => connected && entry.status === 'running'
      && entry.protocol !== 'udp' && new URL(localMappingUrl(entry)).origin === url.origin);
    if (match) return url;
  } catch { /* Invalid addresses can only display the generic load error. */ }
}
