import { mappingFixture } from '../vendor/shared/port-mapping/testing/fixture';

const values = new Map<string, string>();
export const browserMappings = mappingFixture({ storage: {
  getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
} });
export const browserDevices = [{ deviceId: 'browser-fixture', name: '测试电脑' }];
export const browserDeviceIds = browserDevices.map(device => device.deviceId);
let mapping: string | undefined;
export function toggleBrowserMapping() {
  const runtime = browserMappings.registry.get(browserDeviceIds[0]);
  if (mapping) { void runtime.service.stop(mapping); mapping = undefined; return; }
  mapping = runtime.service.add(18408, 18408, '127.0.0.1', 'tcp');
  runtime.aliases.set(mapping, '本地预览服务');
}
