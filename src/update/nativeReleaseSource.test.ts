import { expect, it } from 'vitest';
import { updateMirrorUrl } from '../../vendor/shared/app-update/mirrorUrl';

it('keeps native and desktop mirror namespaces distinct for identical version tags', () => {
  const origin = 'https://github.com/piperhex/remoteai-native/releases/download/v2.2.1/RemoteAI-android-v2.2.1.apk';
  expect(updateMirrorUrl('https://example.test/api', origin))
    .toBe('https://example.test/api/native-update-packages/v2.2.1/RemoteAI-android-v2.2.1.apk');
  expect(updateMirrorUrl('https://example.test/api', origin.replace('remoteai-native', 'remoteai')))
    .toBe('https://example.test/api/update-packages/v2.2.1/RemoteAI-android-v2.2.1.apk');
  for (const invalid of [origin.replace('remoteai-native', 'untrusted'), origin + '?redirect=other',
    origin.replace('https:', 'http:'), origin.replace('v2.2.1/', 'v2.2.1-beta.0/')]) {
    expect(updateMirrorUrl('https://example.test', invalid)).toBeUndefined();
  }
});
