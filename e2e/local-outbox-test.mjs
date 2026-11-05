import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/local-outbox');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device');
const app = 'com.codexswitch.mobile.localoutboxtest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args],
  { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout.trim();
const decode = value => value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], decode(value[2])])));
}
async function find(predicate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const found = (await nodes()).find(predicate);
    if (found) return found;
  }
  assert.fail('Native outbox control not found');
}
const matches = label => node => node.text === label || node['content-desc'] === label;
async function tapNode(node) {
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
const tap = async label => tapNode(await find(matches(label)));
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/local-outbox-test.png');
  await adb('pull', '/sdcard/local-outbox-test.png', path.join(output, `${name}.png`));
}
async function submit(text) {
  const input = await find(node => node.class === 'android.widget.EditText');
  await tapNode(input);
  await adb('shell', 'input', 'text', text);
  await tap('发送消息');
  const cleared = await find(node => node.class === 'android.widget.EditText');
  assert.ok(!cleared.text || /消息|引用/.test(cleared.text), `Composer still contains ${cleared.text}`);
  await find(matches(text));
}
await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
const originalFont = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await submit('first_message');
    await submit('second_message');
    await adb('shell', 'input', 'keyevent', '4');
    await new Promise(resolve => setTimeout(resolve, 650));
    await nodes();
    await screenshot(`android-dark-${scale}-pending`);
    await tap('确认接收');
    await tap('模拟失败');
    await find(node => node.text.includes('避免重复发送'));
    await screenshot(`android-dark-${scale}-failed`);
    await tap('选择待发送消息：second_message');
    await tap('编辑待发送消息');
    await find(node => node.class === 'android.widget.EditText' && node.text === 'second_message');
  }
  console.log('Verified immediate acceptance, consecutive sends, acknowledgement, failure recovery at fonts 1.0 and 1.3.');
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalFont);
  await adb('shell', 'am', 'force-stop', app);
}
