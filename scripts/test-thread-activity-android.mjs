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
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the selected test device');
const app = 'com.codexswitch.mobile.threadactivitytest';
const output = path.resolve(process.env.THREAD_ACTIVITY_OUTPUT ?? path.join(root, '.codex-tmp/thread-activity'));
const apk = path.join(root, 'android/app/build-thread-activity/outputs/apk/release/app-release.apk');
const recent = ['最后活跃 10:30', '较早创建 · 最后活跃 10:25', '最后活跃 10:20',
  '最后活跃 10:15', '最后活跃 10:10', '最后活跃 10:00'];
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: args[0] === 'install' ? 180_000 : 30_000,
  windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(path.join(output, 'latest-ui.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await nodes();
    if (check(current)) return current;
    await delay(400);
  }
  assert.fail('Native list did not reach the expected state; see latest-ui.xml');
}

async function tap(label) {
  const current = await waitFor(items => items.some(item => item.text === label || item['content-desc'] === label));
  const node = current.find(item => item.text === label || item['content-desc'] === label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}

async function verify(expected, name) {
  const matches = item => expected.includes(item.text) || item.text === '较早的对话 · 正在进行'
    || item.text === '刚刚完成的对话' || recent.includes(item.text);
  const current = await waitFor(items => JSON.stringify(items.filter(matches).map(item => item.text))
    === JSON.stringify(expected));
  assert.deepEqual(current.filter(matches).map(item => item.text), expected);
  const result = await exec('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer', windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
  });
  await writeFile(path.join(output, `${name}.png`), result.stdout);
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await prepareHierarchy({ adb, output });
  await adb('install', '-r', '-g', apk);
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verify(['较早的对话 · 正在进行', ...recent.slice(0, 4)], `android-light-running-font-${scale}`);
    await tap('展开显示');
    await verify(['较早的对话 · 正在进行', ...recent], `android-light-expanded-font-${scale}`);
    await tap('完成对话');
    await verify(['刚刚完成的对话', ...recent], `android-light-completed-font-${scale}`);
    await tap('切换自定义分组');
    await verify(['刚刚完成的对话', ...recent.slice(0, 4)], `android-light-custom-collapsed-font-${scale}`);
    await tap('展开显示');
    await verify(['刚刚完成的对话', ...recent], `android-light-custom-expanded-font-${scale}`);
  }
  console.log('PASS Android: activity ordering, running priority, completion and custom groups at font scales 1.0/1.3');
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
