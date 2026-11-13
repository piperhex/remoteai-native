import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to an exclusively available test device.');
const output = fileURLToPath(new URL(`../.codex-tmp/command-details-navigation/${serial}/`, import.meta.url));
const app = 'com.codexswitch.mobile.detailsnavigationtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
const bounds = node => [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
const matches = (node, label) => node['content-desc'] === label || node.text === label;
async function find(label, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const node = (await nodes()).find(entry => matches(entry, label));
    if (node) return node;
    await delay(200);
  }
  throw new Error(`Missing control: ${label}`);
}
async function ensureForeground() {
  const windows = await adb('shell', 'dumpsys', 'window');
  assert.ok(windows.split('\n').some(line => line.includes('mCurrentFocus=') && line.includes(app)),
    'Another app took the device; stop rather than injecting touches into it.');
}
async function tap(label) {
  const rect = bounds(await find(label));
  await ensureForeground();
  await adb('shell', 'input', 'tap', String((rect[0] + rect[2]) >> 1), String((rect[1] + rect[3]) >> 1));
  await delay(350);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/command-details-navigation.png');
  await adb('pull', '/sdcard/command-details-navigation.png', path.join(output, `${name}.png`));
}
async function assertNoDetails() {
  const tree = await nodes();
  assert.ok(!tree.some(node => /^关闭(正在处理|执行命令)/.test(node['content-desc'])),
    'Closed command details must not reappear during navigation.');
}
async function verifyNavigation() {
  await tap('ACCOUNTS'); await find('Accounts'); await assertNoDetails();
  await tap('CHAT'); await find('已运行 echo single'); await assertNoDetails();
  const size = (await adb('shell', 'wm', 'size')).match(/Physical size: (\d+)x(\d+)/);
  assert.ok(size);
  const width = Number(size[1]); const y = String(Math.round(Number(size[2]) * 0.55));
  await ensureForeground();
  await adb('shell', 'input', 'swipe', String(width * 0.8), y, String(width * 0.2), y, '300');
  await find('Accounts'); await assertNoDetails();
  await ensureForeground();
  await adb('shell', 'input', 'swipe', String(width * 0.2), y, String(width * 0.8), y, '300');
  await find('已运行 echo single'); await assertNoDetails();
}
async function verifyDetails(label) {
  await tap('已运行 echo single');
  await find('SINGLE_OUTPUT'); await screenshot(`${label}-single-command`);
  await adb('shell', 'input', 'keyevent', '4'); await find('已运行 echo single');
  await tap('查看处理过程，2 项活动'); await find('关闭正在处理');
  await tap('已运行 echo first'); await find('FIRST_OUTPUT');
  await screenshot(`${label}-process-expanded`);
  await adb('shell', 'input', 'keyevent', '4'); await assertNoDetails();
  // Repeat both directions: a one-shot open does not catch the Android Back regression.
  for (let cycle = 0; cycle < 2; cycle++) {
    await tap('已运行 echo single'); await find('SINGLE_OUTPUT');
    if (cycle === 0) await tap('关闭执行命令');
    else await adb('shell', 'input', 'keyevent', '4');
    await assertNoDetails();
    await tap('查看处理过程，2 项活动'); await find('关闭正在处理');
    if (cycle === 0) await adb('shell', 'input', 'keyevent', '4');
    else await tap('关闭正在处理');
    await assertNoDetails();
  }
  await verifyNavigation(); await screenshot(`${label}-returned-without-details`);
  const group = (await nodes()).find(node => node['content-desc'].includes('echo second')
    && node['content-desc'].includes('2'));
  assert.ok(group, 'The grouped activity row remains available after navigation.');
  await tap(group['content-desc']); await find('关闭正在处理');
  await screenshot(`${label}-group-reopened`); await tap('关闭正在处理');
  // Simulate application navigation while a modal is open, without touching behind the modal.
  await tap('SWITCH LATER'); await tap('已运行 echo single');
  await find('SINGLE_OUTPUT');
  await find('Accounts'); await assertNoDetails();
  await tap('CHAT'); await find('已运行 echo single'); await assertNoDetails();
  await tap('已运行 echo single'); await find('SINGLE_OUTPUT');
  await screenshot(`${label}-command-reopened`); await tap('关闭执行命令');
}

await mkdir(output, { recursive: true });
await prepareHierarchy({ adb, output });
const scale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('shell', 'am', 'start', '-W', '-S', '-n', activity);
  for (const font of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', font);
    await find('已运行 echo single', 60);
    for (const mode of ['LIGHT', 'DARK']) {
      await tap(mode);
      await verifyDetails(`android-${mode.toLowerCase()}-font-${font}`);
    }
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ serial, passed: true,
    fontScales: ['1.0', '1.3'], modes: ['light', 'dark'], cases: [
      'single command opens immediately', 'process opens immediately', 'inline output',
      'repeated command/process alternation after hardware Back and close button',
      'tab press', 'page swipe', 'navigation during modal', 'no delayed dialogs', 'group reopens',
    ] }, null, 2));
} catch (error) {
  await screenshot('failure');
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'am', 'force-stop', app);
}
