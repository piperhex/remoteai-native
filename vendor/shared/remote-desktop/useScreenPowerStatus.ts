import { useEffect, useState } from 'react';
import { screenPowerAction, screenPowerError, supportsScreenControl } from './screenControl';
import type { ReadScreenPower, ScreenPowerDevice, ScreenPowerReading } from './screenControl';

const REFRESH_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 6_000;

/** Refresh only the visible device's action and never infer a state after a failed read. */
export function useScreenPowerStatus(device: ScreenPowerDevice, open: boolean, read: ReadScreenPower) {
  const { deviceId } = device;
  const enabled = open && device.online && supportsScreenControl(device)
    && device.capabilities.includes('screen-power-status');
  const [observed, setObserved] = useState<{ deviceId: string; reading: ScreenPowerReading }>();

  useEffect(() => {
    setObserved(undefined);
    if (!enabled) return;
    let request: AbortController;
    let stopped = false;
    let next: ReturnType<typeof setTimeout>;
    async function refresh() {
      request = new AbortController();
      const timeout = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
      try {
        const reading = await read(deviceId, request.signal);
        if (!stopped && !request.signal.aborted) setObserved({ deviceId, reading });
      } catch (error) {
        if (!stopped) setObserved({ deviceId, reading: screenPowerError(error) });
      } finally {
        clearTimeout(timeout);
        if (!stopped) next = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
      }
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(next);
      request.abort();
    };
  }, [deviceId, enabled, read]);

  const reading = enabled && observed?.deviceId === deviceId ? observed.reading : undefined;
  return screenPowerAction(device, reading);
}
