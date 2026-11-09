import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the test device.');
const packageName = 'com.codexswitch.mobile.composersshtest';
const output = fileURLToPath(new URL('../.codex-tmp/composer-ssh/', import.meta.url));
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
const pause = () => new Promise(resolve => setTimeout(resolve, 300));
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&apos;', "'");
const bounds = node => [...node.bounds.matchAll(/\d+/g)].map(match => Number(match[0]));
const matches = (node, label) => node.text === label || node['content-desc'] === label
  || node['content-desc']?.startsWith(`${label},`);
async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(`${output}/latest.xml`, xml);
  assert.ok(xml.includes(`package="${packageName}"`), 'The isolated composer fixture must be foreground.');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)=(['"])(.*?)\2/gu)].map(value => [value[1], decode(value[3])])));
}
async function find(label) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const node = (await nodes()).find(node => matches(node, label));
    if (node) return node;
    await pause();
  }
  throw new Error(`Missing ${label}`);
}
async function tap(label) {
  const [left, top, right, bottom] = bounds(await find(label));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function input(text) {
  await tap('聊天消息');
  await adb('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A');
  await adb('shell', 'input', 'text', text);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/composer-ssh.png');
  await adb('pull', '/sdcard/composer-ssh.png', `${output}/${name}.png`);
  console.log(`Captured ${name}`);
}
async function sentInput() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const node = (await nodes()).find(node => node.text?.startsWith('{'));
    if (node) return JSON.parse(node.text);
    await pause();
  }
  throw new Error('The fixture did not receive a sent message.');
}
async function checkSelection(scale) {
  await input('!');
  await find('开发服务器');
  await find('生产环境 · 华东地区应用与数据库维护服务器');
  await screenshot(`android-${scale}-candidates`);
  await input('!missing'); await find('没有找到匹配的连接');
  await input('!dev'); await find('开发服务器');
  assert.ok(!(await nodes()).some(node => matches(node, '生产环境 · 华东地区应用与数据库维护服务器')));
  await tap('开发服务器');
  await find('!开发服务器');
  assert.ok(!(await nodes()).some(node => matches(node, '已保存的连接')), 'Selection closes the menu.');
  await screenshot(`android-${scale}-selected`);
  await input('Inspect'); await tap('发送消息');
  const sent = await sentInput();
  assert.equal(sent.text, 'Inspect');
  assert.deepEqual(sent.attachments, [{ kind: 'ssh', name: '开发服务器', path: 'ssh-profile://development' }]);
}
async function checkFeedback(scale) {
  for (const [state, feedback] of [
    ['empty', '还没有保存的连接'], ['error', '无法读取已保存的 SSH 连接，请检查网络后刷新。'],
    ['offline', '连接后发消息'],
  ]) {
    await tap(state.toUpperCase());
    await input('!'); await find(feedback);
    await screenshot(`android-${scale}-${state}`);
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    // Android can consume the first Back to hide its input method before the popover receives it.
    if ((await nodes()).some(node => matches(node, '已保存的连接'))) {
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    }
    assert.ok(!(await nodes()).some(node => matches(node, '已保存的连接')), 'Back dismisses the SSH menu.');
  }
}

await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
const previousScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const activity = (await adb('shell', 'cmd', 'package', 'resolve-activity', '--brief', packageName)).split(/\r?\n/u).at(-1);
assert.ok(activity?.startsWith(`${packageName}/`), 'The composer fixture must be installed.');
try {
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'force-stop', packageName);
    await adb('shell', 'am', 'start', '-W', '-n', activity);
    await find('聊天消息');
    if (scale === '1.3') await tap('THEME');
    await checkSelection(scale);
    await checkFeedback(scale);
  }
  console.log(`Native SSH composer checks passed at font scales 1.0 and 1.3. Screenshots: ${output}`);
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', previousScale);
}
