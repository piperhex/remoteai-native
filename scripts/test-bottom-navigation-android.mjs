import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device.');
const output = process.env.NAVIGATION_TEST_OUTPUT
  ?? fileURLToPath(new URL('../.codex-tmp/bottom-navigation/', import.meta.url));
const app = 'com.codexswitch.mobile.bottomnavigationtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const port = 18419;
const labels = ['聊天', '浏览器', '账号', '发现', '设置'];
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  const xml = await hierarchy(adb);
  const entries = [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
  assert.ok(entries.some(node => node.package === app), 'The isolated test application must remain in front');
  return entries.filter(node => node.package === app);
}
const bounds = node => [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entries = await nodes();
    const node = entries.findLast(entry => entry['content-desc'] === label)
      ?? entries.findLast(entry => entry.text === label);
    if (node) return node;
    await delay(400);
  }
  throw new Error(`Missing native label: ${label}`);
}
async function tap(label) {
  const [left, top, right, bottom] = bounds(await find(label));
  console.log(`Tap ${label} at ${(left + right) >> 1}, ${(top + bottom) >> 1}`);
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  await delay(250);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/bottom-navigation-screen.png');
  await adb('pull', '/sdcard/bottom-navigation-screen.png', path.join(output, `${name}.png`));
}
async function verifyNavigation(active) {
  const entries = await nodes();
  const tabs = labels.map(label => entries.findLast(entry => entry['content-desc'] === label));
  assert.ok(tabs.every(Boolean), 'All five navigation tabs remain accessible');
  const positions = tabs.map(bounds);
  assert.ok(positions.every((rect, index) => rect[1] === positions[0][1]
    && (!index || rect[0] > positions[index - 1][0])), 'Navigation order is stable');
  assert.equal(tabs.find(tab => tab.selected === 'true')?.['content-desc'], active);
  assert.ok(tabs.every(tab => tab.text === ''), 'Navigation labels are accessibility labels only');
  return positions;
}
let pageLoads = 0;
const server = createServer((_request, response) => {
  pageLoads++;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Navigation fixture</title><style>body{margin:0;background:#edf5f2;color:#17372d;font:18px sans-serif}
    header{background:#236b58;color:white;padding:24px}main{padding:24px}input{padding:12px;width:85%;font:inherit}
    </style><header>Navigation fixture</header><main><input aria-label="Draft" value="draft">
    <p>Retained browser page</p></main>`);
});
await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  await adb('shell', 'pm', 'clear', app);
  await adb('shell', 'am', 'start', '-W', '-S', '-n', activity);
  await find('发现');
  const discovery = await nodes();
  assert.equal(discovery.filter(node => node['content-desc'] === '浏览器').length, 1,
    'Only the navigation bar exposes the browser entry');
  await tap('浏览器'); await find('访问地址');
  await tap('访问地址'); await adb('shell', 'input', 'text', `http://127.0.0.1:${port}/page`);
  await adb('shell', 'input', 'keyevent', '66'); await find('Navigation fixture');
  await tap('draft'); await adb('shell', 'input', 'keyevent', '123');
  await adb('shell', 'input', 'text', '-unsaved');
  const loads = pageLoads;
  for (const label of ['账号', '设置', '聊天', '发现']) {
    await tap(label); await verifyNavigation(label);
    assert.ok(!(await adb('shell', 'dumpsys', 'input_method')).includes('mInputShown=true'),
      'Switching away from a webpage dismisses its keyboard');
    await tap('浏览器'); await verifyNavigation('浏览器'); await find('draft-unsaved');
    assert.equal(pageLoads, loads, 'Switching navigation must not reload the browser');
  }
  for (const scale of ['1.0', '1.3']) {
    await tap('发现');
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale); await delay(1000);
    for (const theme of ['Light', 'Dark']) {
      await tap(theme.toUpperCase()); await verifyNavigation('发现');
      const label = `android-${theme.toLowerCase()}-font-${scale}`;
      await screenshot(`${label}-discovery`);
      await tap('浏览器'); await find('访问地址'); await verifyNavigation('浏览器');
      await screenshot(`${label}-browser`);
      await tap('管理标签页（1）'); await find('搜索标签页'); await verifyNavigation('浏览器');
      await screenshot(`${label}-tabs`);
      await tap('发现'); await verifyNavigation('发现');
    }
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ device: serial,
    physicalDevice: !serial.startsWith('emulator-'),
    labels, pageLoads, retainedDraft: true, fontScales: ['1.0', '1.3'], themes: ['light', 'dark'] }, null, 2));
  console.log('Five icon tabs, retained browser, discovery entry removal and Android visuals passed.');
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('reverse', '--remove', `tcp:${port}`);
  await adb('shell', 'am', 'force-stop', app);
  server.close();
}
