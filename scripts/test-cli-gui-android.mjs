import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the intended Android test device.');
const scales = (process.env.CLI_UI_FONT_SCALES ?? '1.0,1.3').split(',');
assert.ok(scales.length > 0 && scales.every(scale => ['1.0', '1.3'].includes(scale)),
  'CLI_UI_FONT_SCALES must contain 1.0, 1.3, or both separated by a comma.');
const app = 'com.codexswitch.mobile.cliguitest';
const output = path.join(root, '.codex-tmp/cli-gui-evidence');
const apk = path.join(root, 'android/app/build-cli-gui/outputs/apk/release/app-release.apk');
const adb = async (...args) => {
  const timeout = args[0] === 'install' ? 180_000 : args.includes('uiautomator') ? 60_000 : 30_000;
  const pending = exec('adb', ['-s', serial,
    ...(args[0] === 'shell' ? ['shell', '-n', ...args.slice(1)] : args)], {
    windowsHide: true, timeout,
    encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  pending.child.stdin.end();
  return (await pending).stdout.trim();
};
async function hierarchy() {
  const result = await adb('shell', 'uiautomator', 'runtest', '/system/framework/android.test.base.jar',
    '/data/local/tmp/native-cli-hierarchy.jar', '-c', 'dev.remoteai.testing.NativeCliHierarchy#testDump');
  assert.ok(result.includes('OK (1 test)'), result);
  return adb('exec-out', 'cat', '/data/local/tmp/local/tmp/native-cli.xml');
}
async function prepareHierarchy() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK directory.');
  const build = path.join(output, 'hierarchy');
  await mkdir(build, { recursive: true });
  const platform = path.join(sdk, 'platforms/android-35');
  const libraries = ['android.jar', 'uiautomator.jar', 'optional/android.test.base.jar'].map(file => path.join(platform, file));
  const binary = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
  await exec(binary('javac'), ['--release', '8', '-encoding', 'UTF-8', '-cp', libraries.join(path.delimiter),
    '-d', build, path.join(root, 'scripts/fixtures/NativeCliHierarchy.java')]);
  const jar = path.join(build, 'native-cli-hierarchy.jar');
  await exec(binary('java'), ['-cp', path.join(sdk, 'build-tools/35.0.0/lib/d8.jar'), 'com.android.tools.r8.D8',
    ...libraries.flatMap(file => ['--lib', file]), '--output', jar,
    path.join(build, 'dev/remoteai/testing/NativeCliHierarchy.class')]);
  await adb('push', jar, '/data/local/tmp/native-cli-hierarchy.jar');
}
async function waitFor(label) {
  let lastError;
  for (let attempt = 0; attempt < 25; attempt++) {
    let xml;
    try { xml = await hierarchy(); }
    catch (error) { lastError = error; await delay(400); continue; }
    await writeFile(path.join(output, 'latest.xml'), xml);
    if (typeof label === 'string' ? xml.includes(label) : label.test(xml)) return xml;
    await delay(400);
  }
  assert.fail(`Missing native control: ${label}. ${lastError ?? ''}`);
}
async function tap(label, long = false) {
  await waitFor(label);
  // Native modal dismissal can expose controls before the slide animation stops intercepting taps.
  await delay(500);
  const xml = await waitFor(label);
  const nodes = [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
  const node = nodes.find(value => typeof label === 'string'
    ? value.text === label || value['content-desc'] === label : label.test(value['content-desc'] ?? ''));
  assert.ok(node, `Missing exact native control: ${label}`);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  const x = String((left + right) >> 1), y = String((top + bottom) >> 1);
  await adb('shell', 'input', ...(long ? ['swipe', x, y, x, y, '650'] : ['tap', x, y]));
}
async function screenshot(name) {
  await delay(500);
  await adb('shell', 'screencap', '-p', '/sdcard/cli-gui-evidence.png');
  await adb('pull', '/sdcard/cli-gui-evidence.png', path.join(output, `${name}.png`));
}
async function enterMessage() {
  await waitFor('消息');
  const result = await adb('shell', 'uiautomator', 'runtest', '/system/framework/android.test.base.jar',
    '/data/local/tmp/native-cli-hierarchy.jar', '-c', 'dev.remoteai.testing.NativeCliHierarchy#testEnterMessage');
  assert.ok(result.includes('OK (1 test)'), result);
}
async function installFixture() {
  const installed = (await adb('shell', 'pm', 'path', app)).replace(/^package:/, '').trim();
  const hash = createHash('sha256').update(await readFile(apk)).digest('hex');
  if (installed && (await adb('shell', 'sha256sum', installed)).startsWith(hash)) return;
  console.log('Installing isolated native CLI fixture');
  await adb('install', '--no-streaming', '-r', '-g', apk);
}
async function check(scale) {
  const prefix = `android-${scale === '1.0' ? 'light' : 'dark'}-font-${scale}`;
  console.log(`Checking ${prefix}`);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await waitFor('选择 CLI');
  if (scale !== '1.0') await tap('toggle-theme');
  await tap('选择 CLI'); await waitFor('Gemini GUI');
  await screenshot(`${prefix}-selector`);
  await tap('Claude GUI'); await waitFor('消息');
  await tap(/聊天设置/); await waitFor('权限模式');
  await screenshot(`${prefix}-settings`);
  console.log(`${prefix}: selection and settings passed`);
  await adb('shell', 'input', 'keyevent', '4');
  await enterMessage();
  await waitFor('text="Check project"');
  await adb('shell', 'input', 'keyevent', '4');
  await tap('发送消息'); await waitFor('更新项目说明');
  await waitFor('text="Check project"');
  await screenshot(`${prefix}-claude-approval`);
  console.log(`${prefix}: exact message and approval passed`);
  await tap('允许这一次'); await waitFor('已完成项目检查。');
  await tap('选择 CLI'); await waitFor('当前对话使用的 CLI 已固定');
  await screenshot(`${prefix}-locked`);
  await adb('shell', 'input', 'keyevent', '4');
  await tap('history'); await waitFor('整理测试计划');
  await screenshot(`${prefix}-history-list`);
  await tap('整理测试计划'); await waitFor('已检查项目结构');
  await screenshot(`${prefix}-gemini-history`);
  await tap('history'); await tap('检查项目结构', true); await waitFor('归档');
  await screenshot(`${prefix}-long-press`);
  await adb('shell', 'input', 'keyevent', '4');
  await tap('Codex 历史对话'); await tap('选择 CLI'); await waitFor('当前对话使用的 CLI 已固定');
  await screenshot(`${prefix}-codex-locked`);
  console.log(`${prefix}: history, engine locks and long press passed`);
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  await adb('shell', 'wm', 'dismiss-keyguard');
  await prepareHierarchy();
  await installFixture();
  for (const scale of scales) await check(scale);
  console.log(`PASS native CLI selection, settings, messages, approvals, history and long press at scales ${scales}`);
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
