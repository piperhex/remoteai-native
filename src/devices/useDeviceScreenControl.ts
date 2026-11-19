import { useCallback } from 'react';
import { useDeviceScreenControl as useScreenControl } from '../../vendor/shared/remote-desktop/useDeviceScreenControl';
import { readScreenPower, type ScreenPowerRequest } from '../../vendor/shared/remote-desktop/screenControl';
import { adminRequest } from '../api/client';
import { Toast } from '../components/AppToast';
import { t } from '../i18n';
import type { AuthSession } from '../types';

export function useDeviceScreenControl(session: AuthSession) {
  const request = useCallback<ScreenPowerRequest>((path, init) => adminRequest(session, path, init), [session]);
  const read = useCallback((deviceId: string, signal: AbortSignal) => readScreenPower(request, deviceId, signal), [request]);
  const change = useScreenControl({
    scope: JSON.stringify([session.baseUrl, session.email]),
    request,
    notify: (message, failed) => { if (failed) Toast.fail(t(message)); else Toast.success(t(message)); },
  });
  return { change, read };
}
