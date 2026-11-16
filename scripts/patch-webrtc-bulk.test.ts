import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { patch } = require('./patch-webrtc-bulk.cjs') as { patch: (source: string) => string };
const original = `    private final WebRTCModule webRTCModule;
        mDataChannel = dataChannel;
    public void onMessage(DataChannel.Buffer buffer) {
        WritableMap params = Arguments.createMap();`;
const oldCallback = `    public void onMessage(DataChannel.Buffer buffer) {
        if (buffer.binary && "remote-ai-file-v1".equals(mDataChannel.label())) {
            try {
                Class<?> router = Class.forName("com.codexswitch.downloads.DownloadBulkRouter");
                router.getMethod("receive", java.nio.ByteBuffer.class).invoke(null, buffer.data);
            } catch (ReflectiveOperationException error) {
                mDataChannel.close();
            }
            return;
        }`;

it('upgrades original and previously patched callbacks to one native receiver lookup per channel', () => {
  const fixed = patch(original);
  const previous = original.replace('    public void onMessage(DataChannel.Buffer buffer) {', oldCallback);
  expect(patch(previous)).toBe(fixed);
  expect(patch(previous.replace(/\n/g, '\r\n'))).toBe(fixed.replace(/\n/g, '\r\n'));
  expect(fixed.match(/Class\.forName/g)).toHaveLength(1);
  expect(fixed).toContain('nativeBulkChannel ? resolveNativeBulkReceiver() : null');
  const callback = fixed.slice(fixed.indexOf('public void onMessage'));
  expect(callback).not.toContain('.label()');
  expect(callback).not.toContain('Class.forName');
  expect(callback).toContain('nativeBulkReceiver.invoke(null, buffer.data)');
  expect(callback).toContain('if (nativeBulkReceiver == null) {\n                    mDataChannel.close();');
  expect(callback).toContain('return;\n        }\n        WritableMap');
});

it('is idempotent and rejects ambiguous or changed upstream code', () => {
  const root = dirname(require.resolve('react-native-webrtc/package.json'));
  const installed = readFileSync(join(root,
    'android/src/main/java/com/oney/WebRTCModule/DataChannelWrapper.java'), 'utf8');
  for (const source of [original, installed]) {
    const fixed = patch(source);
    expect(patch(fixed)).toBe(fixed);
    const windows = fixed.replace(/\r?\n/g, '\r\n');
    expect(patch(windows)).toBe(windows);
    expect(() => patch(source + source)).toThrow('Review WebRTC binary downloads');
    expect(() => patch(fixed + fixed)).toThrow('Review WebRTC binary downloads');
  }
  expect(() => patch(original.replace('mDataChannel = dataChannel;', 'changed();'))).toThrow();
  expect(() => patch('changed upstream')).toThrow();
});
