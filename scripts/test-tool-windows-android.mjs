import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zh from '@remoteai/i18n/catalogs/client/zh';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

// Build the isolated APK with android/gradlew and scripts/tool-windows-fixture.init.gradle, then install it.
// Run with ANDROID_SERIAL set only after acquiring exclusive access to the selected device.
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to an exclusively available test device.');
const fontScales = (process.env.ANDROID_FONT_SCALES ?? '1.0,1.3').split(',');
assert.ok(fontScales.length && fontScales.every(font => ['1.0', '1.3'].includes(font)));
const output = fileURLToPath(new URL(`../.codex-tmp/tool-windows/${serial}/`, import.meta.url));
const app = 'com.codexswitch.mobile.toolwindowstest';
const run = promisify(execFile);
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
const matches = (node, label) => node.text === label || node['content-desc'] === label;
async function nodes() {
  let xml;
  try { xml = await hierarchy(adb); }
  catch (error) {
    // Retry only this read: a shared ADB daemon may reconnect between snapshots.
    if (!/daemon|device offline|device.*not found/i.test(String(error))) throw error;
    await delay(1000);
    xml = await hierarchy(adb);
  }
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => {
    const node = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(attribute => [attribute[1], attribute[2]]));
    node.rect = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
    return node;
  });
}
async function find(label) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const node = (await nodes()).findLast(entry => matches(entry, label));
    if (node) return node;
    await delay(200);
  }
  throw new Error(`Missing control: ${label}`);
}
async function foreground() {
  const windows = await adb('shell', 'dumpsys', 'window');
  assert.ok(windows.split('\n').some(line => line.includes('mCurrentFocus=') && line.includes(app)),
    'Another application took the device; stop injecting touches.');
}
async function tap(label) {
  const { rect } = await find(label);
  await foreground();
  await adb('shell', 'input', 'tap', String((rect[0] + rect[2]) >> 1), String((rect[1] + rect[3]) >> 1));
  await delay(300);
}
async function screenshot(name) {
  const { stdout } = await run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'],
    { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  await writeFile(path.join(output, `${name}.png`), stdout);
}
async function gesture(side) {
  // Root bounds follow actual rotation, including the desktop viewer's landscape window.
  const { rect } = (await nodes())[0];
  const start = side === 'right' ? rect[2] - 2 : 2;
  const end = side === 'right' ? rect[2] * 0.4 : rect[2] * 0.6;
  const y = String(Math.round(rect[3] * 0.5));
  await foreground();
  await adb('shell', 'input', 'swipe', String(start), y, String(Math.round(end)), y, '350');
  await delay(500);
}
const tools = [
  { id: 'files', menu: zh['client.projectBrowser.browseFiles'], marker: 'README.md',
    close: zh['client.projectBrowser.closeFileBrowser'] },
  { id: 'mappings', menu: zh['client.portForwarding.portMapping'], marker: '关闭端口映射', close: '关闭端口映射' },
  { id: 'terminal', menu: zh['client.projectBrowser.terminal'], marker: '自动换行', close: zh['client.chat.hideTerminal'] },
  { id: 'git', menu: 'Git', marker: '关闭Git', close: '关闭Git' },
  { id: 'desktop', menu: zh['client.remoteDesktop.remoteDesktop'],
    marker: zh['client.remoteDesktop.remoteDesktopTouchpad'], close: '关闭' },
];
async function openTool(tool) {
  await tap(zh['client.git.openTools']); await tap(tool.menu); await find(tool.marker);
  // Let rotation and WebView startup settle before injecting an edge gesture.
  await delay(600);
}
async function revealDesktopClose(label) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await nodes();
    if (current.some(node => matches(node, label))) return;
    const rail = current.find(node => node.class === 'android.widget.ScrollView');
    assert.ok(rail, 'Desktop toolbar must be scrollable.');
    const [left, top, right, bottom] = rail.rect;
    const x = String(Math.round((left + right) / 2));
    await foreground();
    await adb('shell', 'input', 'swipe', x, String(Math.round(bottom - 80)),
      x, String(Math.round(top + 80)), '400');
    await delay(300);
  }
  throw new Error('Desktop close button did not appear after scrolling the toolbar.');
}
async function preparePortrait() {
  const { rect } = (await nodes())[0];
  if (rect[2] < rect[3]) return;
  // DEFAULT orientation can retain landscape on a flat device even after restarting its Activity.
  // Use the real viewer control to set up the next portrait group without changing device settings.
  const terminal = tools.find(tool => tool.id === 'terminal');
  await openTool(terminal);
  await tap('切换竖屏');
  await tap(terminal.close);
  await find('Tools fixture');
  const screen = (await nodes())[0].rect;
  assert.ok(screen[2] < screen[3], 'Portrait setup must complete before the next matrix group.');
}
async function verifyTool(tool, prefix) {
  await openTool(tool);
  if (tool.id === 'git') {
    await tap('查看 src/chat/menu.ts'); await find('返回上一层');
    await gesture('right'); await find(tool.marker);
    assert.ok(!(await nodes()).some(node => matches(node, '返回上一层')));
  }
  for (const side of ['right', 'left']) {
    if (/mInputShown=true/.test(await adb('shell', 'dumpsys', 'input_method'))) {
      await gesture(side); await find(tool.marker);
    }
    await gesture(side); await find('Tools fixture');
    await openTool(tool);
    await screenshot(`${prefix}-${tool.id}-${side}-reopened`);
  }
  await foreground();
  await adb('shell', 'input', 'keyevent', '4'); await find('Tools fixture');
  await openTool(tool);
  if (tool.id === 'desktop') await revealDesktopClose(tool.close);
  await tap(tool.close); await find('Tools fixture');
  await tap('ACCOUNTS'); await tap('CHAT'); await find('Tools fixture');
  assert.ok(!(await nodes()).some(node => matches(node, tool.close)), 'Closed tool must stay closed after tabs.');
  console.log(`${prefix}: ${tool.id} passed right/left system Back, KEYCODE_BACK, reopen, X and tab return.`);
}

await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'result.json'), JSON.stringify({ serial, passed: false }));
await prepareHierarchy({ adb, output });
const scale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  for (const font of fontScales) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', font);
    for (const mode of ['LIGHT', 'DARK']) {
      // Start each matrix group in the Activity's initial orientation after the landscape desktop viewer.
      await adb('shell', 'am', 'start', '-W', '-S', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
      await find('Tools fixture');
      await tap(mode);
      await preparePortrait();
      const prefix = `android-${mode.toLowerCase()}-font-${font}`;
      for (const tool of tools) await verifyTool(tool, prefix);
      await screenshot(`${prefix}-all-tools-closed`);
    }
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ serial, passed: true,
    modes: ['light', 'dark'], fontScales, tools: tools.map(tool => tool.id),
    cases: ['right and left system back', 'KEYCODE_BACK', 'same tool reopens three times', 'different tools alternate',
      'Git detail returns one level', 'X closes', 'closed tools stay closed after tabs'] }, null, 2));
} catch (error) {
  await screenshot('failure'); throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'am', 'force-stop', app);
}
