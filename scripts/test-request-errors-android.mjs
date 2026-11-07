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
const app = 'com.codexswitch.mobile.requesterrortest';
const COMMAND_TIMEOUT_MS = 30_000;
const INSTALL_TIMEOUT_MS = 180_000;
const api = process.env.CHAT_TEST_FIXTURE_URL ?? 'http://127.0.0.1:15370';
const output = path.resolve(process.env.REQUEST_ERROR_OUTPUT ?? path.join(root, '.codex-tmp/request-errors'));
const failure = { method: 'error', params: { threadId: 'demo-chat', turnId: 'scoped-error', willRetry: false,
  error: { message: 'unexpected status 502 Bad Gateway, url: http://127.0.0.1:51524/responses' } } };
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: args[0] === 'install' ? INSTALL_TIMEOUT_MS : COMMAND_TIMEOUT_MS,
  windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
async function post(route, data = {}) {
  const response = await fetch(`${api}/test/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  assert.equal(response.status, 200);
}
async function waitFor(label) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const xml = await hierarchy(adb);
    await writeFile(path.join(output, 'latest-ui.xml'), xml);
    if (typeof label === 'string' ? xml.includes(label) : label.test(xml)) return xml;
    await delay(500);
  }
  assert.fail(`Missing native control: ${label}`);
}
async function tap(label) {
  const xml = await waitFor(label);
  const nodes = [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
  const node = nodes.find(value => value.text === label || value['content-desc'] === label);
  assert.ok(node, `Missing exact native control: ${label}`);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/request-error-result.png');
  await adb('pull', '/sdcard/request-error-result.png', path.join(output, `${name}.png`));
}
async function checkScale(scale) {
  await adb('shell', 'am', 'force-stop', app);
  await post('reset');
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await waitFor(/P2P|Relay/);
  await tap('打开聊天列表');
  await tap('移动端聊天体验');
  await post('chat-event', { method: 'turn/started', params: { threadId: 'demo-chat',
    turn: { id: 'scoped-error', status: 'inProgress', items: [
      { id: 'question', type: 'userMessage', text: '检查连接。' },
    ] } } });
  await post('chat-event', failure);
  const failed = await waitFor('本次回复遇到问题，已中断。');
  assert.ok(failed.includes('查看报错详情'));
  assert.ok(!failed.includes('unexpected status 502'));
  await screenshot(`android-dark-error-in-conversation-font-${scale}`);
  await tap('打开聊天列表');
  await tap('新聊天');
  await waitFor('想一起完成什么');
  await post('chat-event', failure);
  await delay(400);
  const fresh = await hierarchy(adb);
  assert.ok(fresh.includes('新聊天'));
  assert.ok(!fresh.includes('unexpected status 502'));
  assert.ok(!fresh.includes('本次回复遇到问题'));
  assert.ok(!fresh.includes('查看报错详情'));
  await screenshot(`android-dark-new-chat-clean-font-${scale}`);
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await prepareHierarchy({ adb, output });
  const apk = process.env.REQUEST_ERROR_APK;
  assert.ok(apk, 'Set REQUEST_ERROR_APK to the isolated fixture APK');
  await adb('install', '-r', '-g', apk);
  await adb('reverse', 'tcp:15370', 'tcp:15370');
  for (const scale of ['1.0', '1.3']) await checkScale(scale);
  console.log('PASS Android: reply-only errors and clean new chats at font scales 1.0 and 1.3');
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
