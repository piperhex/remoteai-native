import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/relay-issue-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const app = 'com.codexswitch.mobile.relayissuetest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
const post = async (route, data = {}) => {
  const response = await fetch(`http://127.0.0.1:1490/test/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  assert.equal(response.status, 200);
};
const warning = '服务器转发暂不可用，请稍后重试或使用 P2P 直连。';
async function tree() {
  return hierarchy(adb);
}
async function waitFor(label, present = true) {
  for (let attempt = 0; attempt < 18; attempt++) {
    const xml = await tree();
    await writeFile(path.join(output, 'latest-ui.xml'), xml);
    if (xml.includes(label) === present) return xml;
    await delay(500);
  }
  assert.fail(`Expected ${label}: ${present}`);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/relay-issue-result.png');
  await adb('pull', '/sdcard/relay-issue-result.png', path.join(output, `${name}.png`));
}

await mkdir(output, { recursive: true });
const fontScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await prepareHierarchy({ adb, output });
  await adb('install', '-r', path.join(root, 'android/app/build-relay-issue/outputs/apk/release/app-release.apk'));
  await adb('reverse', 'tcp:1490', 'tcp:1490');
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'am', 'force-stop', app);
    await post('reset');
    await post('relay-issue', { reason: 'unavailable', initial: true });
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await waitFor('P2P');
    await waitFor(warning, false);
    await post('relay-issue', { reason: 'unavailable' });
    await delay(500);
    await waitFor(warning, false);
    await screenshot(`android-dark-p2p-font-${scale}`);
    await post('fallback');
    await waitFor(warning);
    await screenshot(`android-dark-no-path-font-${scale}`);
    await post('relay-issue', { reason: null });
    await waitFor('Relay');
    await waitFor(warning, false);
    await screenshot(`android-dark-relay-recovered-font-${scale}`);
    console.log(`PASS Android relay notice recovery at font scale ${scale}`);
  }
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', fontScale);
  await adb('shell', 'am', 'force-stop', app);
}
