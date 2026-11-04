import { expect, it } from 'vitest';
// Release tooling is executable ESM; it deliberately has no application dependency.
import { nativeVersion } from './release-version.mjs';

it('preserves the existing Android version code and orders beta builds before stable releases', () => {
  expect(nativeVersion('v2.2.0')).toEqual({ version: '2.2.0', tag: 'v2.2.0', versionCode: 20200099 });
  expect(nativeVersion('2.2.1-beta.2').versionCode).toBe(20200102);
  expect(nativeVersion('2.2.1').versionCode).toBeGreaterThan(nativeVersion('2.2.1-beta.98').versionCode);
});

it('rejects versions that cannot retain the Android ordering contract', () => {
  for (const version of ['', 'main', '2.2', '2.2.0-beta', '2.2.0-beta.99', '210.0.0', '2.100.0', '2.2.1000']) {
    expect(() => nativeVersion(version)).toThrow();
  }
});
