import { useState, useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { useDeviceMappings } from '../../vendor/shared/port-mapping/deviceRegistry';
import { certificateFingerprint, mappingTrustTarget } from './mappingCertificates';

type Failure = { key: string; fingerprint: string; url: string };
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useMappingCertificate(scope: string | undefined, address: string) {
  const target = mappingTrustTarget(scope, address, useDeviceMappings());
  const [failure, setFailure] = useState<Failure>();
  const current = target && failure?.key === target.key ? failure : undefined;
  const key = target?.key;
  const read = () => key ? Storage.getItemSync(key) : null;
  const saved = useSyncExternalStore(subscribe, read, read);
  const policy = target ? JSON.stringify([target.origin, saved || '', target.key]) : undefined;
  const capture = (error: { code: number; description: string; url: string }) => {
    const fingerprint = certificateFingerprint(error, target?.origin);
    if (!target || !fingerprint) return false;
    setFailure({ key: target.key, fingerprint, url: error.url });
    return true;
  };
  const dismiss = () => setFailure(undefined);
  const trust = () => {
    if (!target || !current) return;
    Storage.setItemSync(target.key, current.fingerprint);
    dismiss();
    listeners.forEach(listener => listener());
  };
  return { current, policy, capture, dismiss, trust, changed: !!saved && saved !== current?.fingerprint };
}
