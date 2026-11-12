import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device.');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/port-mapping-browser');
const app = 'com.codexswitch.mobile.portmappingtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/port-mapping-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/port-mapping-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(entry => entry.text === label || entry['content-desc'] === label);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Missing native label: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  await delay(400);
  await adb('shell', 'screencap', '-p', '/sdcard/port-mapping-screen.png');
  await adb('pull', '/sdcard/port-mapping-screen.png', path.join(output, `${name}.png`));
}
async function assertAddress(value) {
  assert.equal((await find('访问地址')).text, value);
}
async function verifyToolbar(name) {
  await find('mapped-one');
  await assertAddress('http://127.0.0.1:18306/');
  assert.equal((await find('返回')).enabled, 'false');
  assert.equal((await find('前进')).enabled, 'false');
  await screenshot(`${name}-browser`);
  await tap('访问地址');
  await adb('shell', 'input', 'text', 'http://127.0.0.1:18306/next');
  await adb('shell', 'input', 'keyevent', '66');
  await assertAddress('http://127.0.0.1:18306/next');
  assert.equal((await find('返回')).enabled, 'true');
  await tap('返回');
  await assertAddress('http://127.0.0.1:18306/');
  assert.equal((await find('前进')).enabled, 'true');
  await tap('前进');
  await assertAddress('http://127.0.0.1:18306/next');
  await tap('返回');
  await tap('访问地址');
  await adb('shell', 'input', 'text', 'http://127.0.0.1:18306/next');
  await adb('shell', 'input', 'keyevent', '66');
  await assertAddress('http://127.0.0.1:18306/next');
  await tap('刷新');
  await find('mapped-one');
  await screenshot(`${name}-navigated`);
}
async function verifyExternal(label) {
  await tap(label);
  await delay(1000);
  let activities = await adb('shell', 'dumpsys', 'activity', 'activities');
  if (activities.includes('com.miui.wakepath.ui.ConfirmStartActivity')) {
    await find('Remote AI 想要打开 Chrome，是否允许？');
    await tap('始终允许');
    await delay(1000);
    activities = await adb('shell', 'dumpsys', 'activity', 'activities');
  }
  assert.match(activities, /dat=http:\/\/127\.0\.0\.1:18306/);
  assert.match(activities, /(?:topResumedActivity=|mResumedActivity:).*com\.android\.chrome/,
    'External Chrome browser did not become active');
  await find('mapped-one');
  return activities;
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'start', '-S', '-n', activity);
    await tap('端口映射');
    for (const mode of ['light', 'dark']) {
      await tap(mode === 'light' ? 'Light' : 'Dark');
      const name = `android-${mode}-font-${scale}`;
      await screenshot(`${name}-mapping`);
      await tap('打开');
      await find('内置浏览器'); await find('外部浏览器');
      await screenshot(`${name}-choices`);
      await tap('内置浏览器');
      await verifyToolbar(name);
      if (scale === '1.0' && mode === 'light') {
        const activities = await verifyExternal('在浏览器中打开');
        assert.match(activities, /dat=http:\/\/127\.0\.0\.1:18306\/next/);
        await screenshot('android-system-browser-current-page');
        await writeFile(path.join(output, 'external-navigation.txt'), activities, 'utf8');
        await adb('shell', 'input', 'keyevent', '4');
        await adb('shell', 'am', 'start', '-n', activity);
      }
      await tap('关闭');
      await find('打开');
    }
  }
  await tap('打开');
  await verifyExternal('外部浏览器');
  await screenshot('android-system-browser-from-choices');
  await adb('shell', 'input', 'keyevent', '4');
  await adb('shell', 'am', 'start', '-n', activity);
  await find('打开');
  await tap('English');
  await tap('Open');
  await find('Built-in browser'); await find('External browser');
  await screenshot('android-dark-font-1.3-english-choices');
  await adb('shell', 'input', 'keyevent', '4');
  await tap('Back to Discover');
  console.log(`Verified chooser, navigation, refresh and external opening. Screenshots: ${output}`);
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
