import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the intended test device.');
const app = 'com.codexswitch.mobile.agentdraftstest';
const output = path.join(root, '.codex-tmp/agent-drafts');
const apk = path.join(root, 'android/app/build-agent-drafts/outputs/apk/release/app-release.apk');
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: args[0] === 'install' ? 180_000 : 30_000,
  windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  // Android releases resolve the legacy UiAutomator dump directory differently.
  const xml = await hierarchy(async (...args) => {
    if (args[0] !== 'exec-out') return adb(...args);
    const result = await adb(...args).catch(() => '');
    return result.includes('<hierarchy') ? result : adb('exec-out', 'cat', '/data/local/tmp/local/tmp/chat-live.xml');
  });
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
}
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await nodes();
    const match = current.find(predicate);
    if (match) return match;
    await delay(300);
  }
  assert.fail('The expected native draft state was not visible.');
}
async function tap(label) {
  const node = await waitFor(node => node['content-desc'] === label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
const input = value => waitFor(node => node.class === 'android.widget.EditText' && node.text === value);
const drafts = { empty: '10101', 'project-a': '20202', 'project-b': '30303', existing: '40404' };
async function checkSendShortcut(scale) {
  await tap('project-a');
  await tap('聊天消息');
  await adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END', 'KEYCODE_DPAD_LEFT', 'KEYCODE_ENTER');
  const draft = drafts['project-a'];
  const message = `${draft.slice(0, -1)}&#10;${draft.at(-1)}`;
  await input(message);
  await adb('shell', 'screencap', '-p', '/sdcard/agent-drafts-test.png');
  await adb('pull', '/sdcard/agent-drafts-test.png', path.join(output, `android-${scale}-shortcut-draft.png`));
  await adb('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_ENTER');
  await waitFor(node => node['content-desc'] === 'sent-message' && node.text === message);
  await input('');
  await adb('shell', 'screencap', '-p', '/sdcard/agent-drafts-test.png');
  await adb('pull', '/sdcard/agent-drafts-test.png', path.join(output, `android-${scale}-shortcut-sent.png`));
}
async function prepareInput() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK directory.');
  const build = path.join(output, 'input');
  await mkdir(build, { recursive: true });
  const platform = path.join(sdk, 'platforms/android-35');
  const libraries = ['android.jar', 'uiautomator.jar', 'optional/android.test.base.jar'].map(p => path.join(platform, p));
  const binary = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
  await exec(binary('javac'), ['--release', '8', '-encoding', 'UTF-8', '-cp', libraries.join(path.delimiter),
    '-d', build, path.join(root, 'scripts/fixtures/AgentDraftInput.java')]);
  const jar = path.join(build, 'agent-draft-input.jar');
  await exec(binary('java'), ['-cp', path.join(sdk, 'build-tools/35.0.0/lib/d8.jar'), 'com.android.tools.r8.D8',
    ...libraries.flatMap(file => ['--lib', file]), '--output', jar,
    path.join(build, 'dev/remoteai/testing/AgentDraftInput.class')]);
  await adb('push', jar, '/data/local/tmp/agent-draft-input.jar');
}
await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
await prepareInput();
await adb('install', '-r', apk);
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  await adb('shell', 'wm', 'dismiss-keyguard');
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    for (const target of ['empty', 'project-a', 'project-b', 'existing']) {
      await tap(target); await input(''); await tap('聊天消息');
      const entered = await adb('shell', 'uiautomator', 'runtest', '/system/framework/android.test.base.jar',
        '/data/local/tmp/agent-draft-input.jar', '-c', 'dev.remoteai.testing.AgentDraftInput',
        '-e', 'text', drafts[target]);
      assert.ok(entered.includes('OK (1 test)'), entered);
      await input(drafts[target]);
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    }
    for (const target of ['project-a', 'empty', 'existing', 'project-b', 'empty', 'project-a']) {
      await tap(target); await input(drafts[target]);
      await adb('shell', 'screencap', '-p', '/sdcard/agent-drafts-test.png');
      await adb('pull', '/sdcard/agent-drafts-test.png', path.join(output, `android-${scale}-${target}-restored.png`));
    }
    await checkSendShortcut(scale);
  }
  console.log('PASS native Android draft switching, Enter, and Ctrl+Enter at font scales 1.0 and 1.3');
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
