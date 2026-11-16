import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { configureApplication } = require('../plugins/withDownloads.cjs') as {
  configureApplication: (source: string) => string;
};

it('configures WebRTC before autolinking initializes packages, once across repeated prebuilds', () => {
  const source = 'override fun getPackages() {\n            val packages = PackageList(this).packages\n}';
  const fixed = configureApplication(source);
  expect(fixed).toContain('DownloadWebRtc.configure()\n            val packages = PackageList(this).packages');
  expect(configureApplication(fixed)).toBe(fixed);
  expect(() => configureApplication(source + source)).toThrow();
  expect(() => configureApplication('changed upstream')).toThrow();
});
