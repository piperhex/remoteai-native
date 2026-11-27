// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useMappingCertificate } from './useMappingCertificate';
import { CERTIFICATE_ERROR_CODE } from './mappingCertificates';

const fixture = vi.hoisted(() => ({
  pins: new Map<string, string>(),
  device: { deviceId: 'pc', connected: true, entry: {
    id: 'mapping', status: 'running', protocol: 'tcp', localDomain: 'test.local',
    localPort: 8444, remoteHost: '192.168.5.2', remotePort: 443,
  } },
}));
vi.mock('../../vendor/shared/port-mapping/deviceRegistry', () => ({ useDeviceMappings: () => [fixture.device] }));
vi.mock('expo-sqlite/kv-store', () => ({ default: {
  getItemSync: (key: string) => fixture.pins.get(key) ?? null,
  setItemSync: (key: string, value: string) => fixture.pins.set(key, value),
} }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

it('remembers an approved leaf across mounts and requires new consent for another certificate or destination', () => {
  const root = createRoot(document.createElement('div'));
  const url = 'https://test.local:8444/ui/';
  const error = { url, code: CERTIFICATE_ERROR_CODE, description: 'AB'.repeat(32) };
  let browser!: ReturnType<typeof useMappingCertificate>;
  function Page({ scope, address }: { scope: string; address: string }) {
    browser = useMappingCertificate(scope, address);
    return null;
  }
  const show = (scope = 'account', address = url) => act(() => root.render(<Page scope={scope} address={address} />));
  const capture = (event = error) => act(() => { expect(browser.capture(event)).toBe(true); });
  const savedPin = () => browser.policy && JSON.parse(browser.policy)[1];
  show();
  expect(browser.capture({ ...error, code: -2 })).toBeFalsy();
  expect(browser.capture({ ...error, url: 'https://test.local:8445/' })).toBeFalsy();
  expect(browser.capture({ ...error, description: 'not a fingerprint' })).toBeFalsy();
  capture(); act(browser.dismiss); expect(savedPin()).toBe('');
  capture(); act(browser.trust); expect(savedPin()).toBe(error.description);
  act(() => root.render(null)); show(); expect(savedPin()).toBe(error.description);
  capture({ ...error, description: 'CD'.repeat(32) });
  expect(browser.changed).toBe(true);
  expect(savedPin()).toBe(error.description);
  show('other account'); expect(savedPin()).toBe('');
  fixture.device.entry.remotePort = 444; show(); expect(savedPin()).toBe('');
  fixture.device.entry.status = 'stopped'; show(); expect(browser.policy).toBeUndefined();
  fixture.device.entry.status = 'running'; fixture.device.entry.protocol = 'udp'; show();
  expect(browser.policy).toBeUndefined();
  fixture.device.entry.protocol = 'tcp'; show('account', 'https://other.local:8444/');
  expect(browser.policy).toBeUndefined(); expect(browser.capture(error)).toBeFalsy();
  act(() => root.unmount());
});
