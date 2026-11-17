import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/directory-sync');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical Android device');
const app = 'com.codexswitch.mobile.directorysynctest';
const exec = promisify(execFile);
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/directory-sync.xml');
  const xml = await adb('shell', 'cat', '/sdcard/directory-sync.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label, scroll = false) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const node = (await nodes()).find(value => value['content-desc'] === label || value.text === label);
    if (node) return node;
    if (scroll) await adb('shell', 'input', 'swipe', '540', scroll === 'up' ? '850' : '2000',
      '540', scroll === 'up' ? '2000' : '850', '300');
    await delay(500);
  }
  assert.fail(`Missing native label: ${label}`);
}
async function tap(label, scroll = false) {
  const node = await find(label, scroll);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
}
async function screenshot(name) {
  await delay(400);
  await adb('shell', 'screencap', '-p', '/sdcard/directory-sync.png');
  await adb('pull', '/sdcard/directory-sync.png', path.join(output, `${name}.png`));
}
const original = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: false, inProgress: true, synthetic: true }));
  await adb('install', '-r', path.join(root, 'android/app/build-directory-sync/outputs/apk/debug/app-debug.apk'));
  for (const scale of [1, 1.3]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await tap('折叠项目：engines');
    await find('测试对话 0000');
    assert.ok(!(await nodes()).some(node => node['content-desc'] === '测试对话 1000'));
    await screenshot(`android-${scale}-initial`);
    await tap('展开显示：历史分组（测试数据）');
    await find('测试对话 1000');
    await screenshot(`android-${scale}-group-loaded`);
    await find('加载更多', true);
    await adb('shell', 'input', 'swipe', '540', '2000', '540', '1400', '300');
    await screenshot(`android-${scale}-expanded-pagination`);
    await tap('收起：历史分组（测试数据）');
    await tap('折叠分组：历史分组（测试数据）', 'up');
    await tap('fixture-rename');
    await find('改名已同步（测试）');
    await screenshot(`android-${scale}-single-update`);
    await tap('fixture-reopen');
    await find('缓存恢复已验证');
    await screenshot(`android-${scale}-cache-resumed`);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, synthetic: true, scales: [1, 1.3] }));
} finally {
  if (original === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', original);
  await adb('shell', 'am', 'force-stop', app);
}
