import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zh from '@remoteai/i18n/catalogs/client/zh';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

// Build with scripts/discovery-back-fixture.init.gradle, install its isolated APK, then run on a free device.
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to an exclusively available physical Android device.');
const app = 'com.codexswitch.mobile.discoverybacktest';
const port = 18427;
const extrasOnly = process.env.DISCOVERY_BACK_EXTRAS === '1';
const buttonsOnly = process.env.DISCOVERY_BACK_BUTTONS === '1';
const MIUI_BACK_BUTTON_WIDTH_FRACTION = 0.78;
const output = fileURLToPath(new URL(`../.codex-tmp/discovery-back/${serial}/`, import.meta.url));
const run = promisify(execFile);
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 30_000, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
})).stdout.trim();
const entries = [
  ['lounge', 'client.lounge.title'], ['port-mappings', 'client.portForwarding.portMapping'],
  ['devices', 'client.app.devices'], ['ssh', 'client.discovery.ssh'],
  ['totp', 'client.discovery.twoFactor'], ['downloads', 'client.downloads.downloads'],
  ['token-summary', 'client.chat.tokenSummary'],
].map(([id, key]) => ({ id, label: zh[key] }));
const matches = (node, label) => node.text === label || node['content-desc'] === label;
async function nodes() {
  let xml;
  try { xml = await hierarchy(adb); }
  catch (error) {
    // Only retry the read when the shared ADB daemon temporarily disconnects.
    if (!/daemon|device offline|device.*not found/i.test(String(error))) throw error;
    await delay(1000);
    xml = await hierarchy(adb);
  }
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => {
    const node = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(attribute => [attribute[1], attribute[2]]));
    node.rect = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
    return node;
  });
}
async function foreground() {
  const windows = await adb('shell', 'dumpsys', 'window');
  assert.ok(windows.split('\n').some(line => line.includes('mCurrentFocus=') && line.includes(app)),
    'The isolated app must remain in front; stop injecting touches if another app takes over.');
}
async function find(label) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const node = (await nodes()).findLast(value => matches(value, label));
    if (node) return node;
    await delay(200);
  }
  throw new Error(`Missing control: ${label}`);
}
async function tapNode(node) {
  await foreground();
  const [left, top, right, bottom] = node.rect;
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  await delay(300);
}
const tap = async label => tapNode(await find(label));
async function screenshot(name) {
  const { stdout } = await run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'],
    { encoding: 'buffer', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  await writeFile(path.join(output, `${name}.png`), stdout);
}
async function systemBack(method) {
  await foreground();
  if (method === 'key') await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  else if (method === 'button') {
    const current = await nodes();
    const button = current.find(node => node['resource-id'] === 'com.android.systemui:id/back');
    if (button) await tapNode(button);
    else {
      // MIUI omits SystemUI from the active app's hierarchy. The inspected device screenshot places
      // Back on the right; use the OS-provided navigation-bar bounds, never the app's bottom tabs.
      assert.equal(await adb('shell', 'settings', 'get', 'global', 'force_fsg_nav_bar'), '0');
      const bar = current.find(node => node['resource-id'] === 'android:id/navigationBarBackground');
      assert.ok(bar, 'The system navigation bar must have visible bounds');
      const [left, top, right, bottom] = bar.rect;
      const x = Math.round(left + (right - left) * MIUI_BACK_BUTTON_WIDTH_FRACTION);
      await adb('shell', 'input', 'tap', String(x), String((top + bottom) >> 1));
    }
  } else {
    const display = await adb('shell', 'wm', 'size');
    const [, width, height] = [...display.matchAll(/(\d+)x(\d+)/g)].at(-1);
    const y = String(Math.round(Number(height) * 0.5));
    const start = method === 'right' ? Number(width) - 2 : 2;
    const end = Number(width) * (method === 'right' ? 0.4 : 0.6);
    await adb('shell', 'input', 'swipe', String(start), y, String(Math.round(end)), y, '350');
  }
  await delay(500);
}
async function assertDiscovery() {
  await foreground();
  // These independent rows are present together only on Discover, including after Token Usage closes.
  await find(zh['client.discovery.ssh']);
  await find(zh['client.discovery.twoFactor']);
  await find(zh['client.portForwarding.portMapping']);
}
const passed = [];
async function verifyEntry(entry, methods, mode) {
  for (const method of methods) {
    await assertDiscovery();
    await tap(entry.label);
    // No direct route mutation: all entries are opened from the production Discover list.
    const visible = await nodes();
    assert.ok(!visible.some(node => matches(node, zh['client.discovery.twoFactor']))
      || entry.id === 'totp', `${entry.id} must open its page`);
    if (method === methods[0]) await screenshot(`${mode}-${entry.id}-open`);
    await systemBack(method);
    await assertDiscovery();
    await screenshot(`${mode}-${entry.id}-after-${method}`);
    passed.push({ page: entry.id, method, mode });
    await writeFile(path.join(output, 'progress.json'), JSON.stringify({ serial, passed }, null, 2));
    console.log(`PASS ${mode} ${entry.id} ${method}`);
  }
}

async function verifyPreservedBackBehavior() {
  await tap(zh['client.discovery.ssh']);
  await tap(zh['client.ssh.createAction']);
  await find(zh['client.ssh.createTitle']);
  await tap(zh['client.ssh.name']);
  await delay(500);
  assert.ok((await adb('shell', 'dumpsys', 'input_method')).includes('mInputShown=true'));
  await systemBack('key');
  await find(zh['client.ssh.createTitle']);
  assert.ok(!(await adb('shell', 'dumpsys', 'input_method')).includes('mInputShown=true'));
  await screenshot('extra-keyboard-dismissed-editor-retained');
  await systemBack('right');
  await find(zh['client.ssh.createAction']);
  await screenshot('extra-modal-dismissed-ssh-retained');
  await systemBack('right');
  await assertDiscovery();
  await tap(zh['client.configLabels.browser']);
  await find('访问地址');
  // Browser right-edge Forward must remain distinct from app Back even on an empty home page.
  await systemBack('right');
  await find('访问地址');
  await screenshot('extra-browser-forward-retained');
  await systemBack('left');
  await assertDiscovery();
  await tap(zh['client.app.chat']);
  await systemBack('right');
  const windows = await adb('shell', 'dumpsys', 'window');
  assert.ok(!windows.split('\n').some(line => line.includes('mCurrentFocus=') && line.includes(app)),
    'Back at the root still delegates to Android');
  assert.ok(await adb('shell', 'pidof', app), 'Root Back backgrounds the live app');
  await launch();
  await verifyEntry(entries.find(entry => entry.id === 'ssh'), ['right'], 'extra-resumed');
  passed.push({ keyboard: true, modal: true, browserDirection: true, rootBack: true, resume: true });
  console.log('PASS keyboard, nested modal, browser directions, root Back and resumed activity');
}

let theme = 'light';
const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const routes = {
    '/fixture/config': { theme }, '/sync/accounts/summary': { accounts: [] },
    '/devices': { devices: [] }, '/devices/providers': { providers: [] },
    '/auth/me': { id: 'discovery', email: 'discovery@example.test', role: 'user' },
    '/sync/ssh-profiles': [], '/sync/totp': { entries: [], tombstones: [], modifiedAt: '2026-01-01T00:00:00Z' },
  };
  response.writeHead(url.pathname in routes ? 200 : 503, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(routes[url.pathname] ?? { message: 'Fixture service unavailable' }));
});
await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const originalGestures = await adb('shell', 'settings', 'get', 'global', 'force_fsg_nav_bar');
async function launch() {
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await tap(zh['client.discovery.title']);
  await assertDiscovery();
}
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  await adb('shell', 'pm', 'grant', app, 'android.permission.POST_NOTIFICATIONS');
  assert.equal(originalGestures, '1', 'This physical-device run requires MIUI system gestures initially enabled.');
  const modes = extrasOnly || buttonsOnly ? [] : [{ theme: 'light', scale: '1.0' }, { theme: 'dark', scale: '1.3' }];
  for (const mode of modes) {
    theme = mode.theme;
    await adb('shell', 'settings', 'put', 'system', 'font_scale', mode.scale);
    await launch();
    for (const entry of entries) await verifyEntry(entry, ['right', 'left', 'key'], `${theme}-${mode.scale}`);
  }
  if (extrasOnly) {
    await launch();
    await verifyPreservedBackBehavior();
  } else {
    theme = 'dark';
    await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
    await adb('shell', 'settings', 'put', 'global', 'force_fsg_nav_bar', '0');
    await delay(1500);
    await launch();
    for (const entry of entries) await verifyEntry(entry, ['button'], 'dark-1.3-system-buttons');
  }
  const result = extrasOnly ? 'extras-result.json' : buttonsOnly ? 'buttons-result.json' : 'result.json';
  await writeFile(path.join(output, result), JSON.stringify({ serial, passed }, null, 2));
} catch (error) {
  await screenshot('failure');
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'settings', 'put', 'global', 'force_fsg_nav_bar', originalGestures);
  await adb('shell', 'am', 'force-stop', app);
  await adb('reverse', '--remove', `tcp:${port}`);
  server.close();
}
