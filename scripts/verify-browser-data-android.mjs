import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile), serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to a physical test device');
const output = fileURLToPath(new URL('../../../.codex-tmp/browser-data/', import.meta.url));
const app = 'com.codexswitch.mobile.browserdatatest';
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  try { await adb('shell', 'uiautomator', 'dump', '/sdcard/browser-data.xml'); }
  catch (error) { if (!error.stdout?.includes('UI hierchary dumped')) throw error; }
  const xml = await adb('shell', 'cat', '/sdcard/browser-data.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label, first = false) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const entries = await nodes();
    const entry = (first ? entries.find(entry => entry['content-desc'] === label) : undefined)
      ?? entries.findLast(entry => entry['content-desc'] === label)
      ?? entries.findLast(entry => entry.text === label)
      ?? entries.findLast(entry => entry['content-desc']?.endsWith(`, ${label}`));
    if (entry) return entry;
    await delay(300);
  }
  throw new Error(`Missing native label: ${label}`);
}
async function tap(label, first = false) {
  const node = await find(label, first), [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(Number);
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  await delay(350);
}
async function shot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/browser-data.png');
  await adb('pull', '/sdcard/browser-data.png', `${output}/${name}.png`);
}
async function type(label, value) {
  await tap(label); await adb('shell', 'input', 'text', value);
  // Submit the single-line input to dismiss the IME without sending a Back action to its sheet.
  await adb('shell', 'input', 'keyevent', '66');
  await delay(300);
}
const back = async () => { await adb('shell', 'input', 'keyevent', '4'); await delay(400); };
await mkdir(output, { recursive: true });
const scaleBefore = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const results = [];
try {
  if (process.argv.includes('--login')) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
    await adb('shell', 'pm', 'clear', app);
    await adb('shell', 'am', 'start', '-S', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('Ready'); await tap('Login test'); await tap('Sign in');
    await find('保存此网站的密码？'); await shot('android-login-save-prompt');
    await type('密码库口令', 'browser-test-passphrase'); await tap('解锁密码库');
    await tap('保存'); await tap('Reset form'); await tap('Passwords');
    await find('native-fixture-user'); await shot('android-login-saved');
    await tap('填入当前页面'); await find('Filled correctly'); await shot('android-login-filled');
    await writeFile(`${output}/android-engine-results.json`, JSON.stringify({ capture: true, save: true,
      fill: true, nodeCreatedVaultUnlocked: true, physicalDevice: serial }));
    console.log('Native WebView capture, save, fill and cross-platform decryption passed');
  }
  const scales = process.argv.includes('--login') ? [] : process.env.TEST_FONT_SCALE ? [process.env.TEST_FONT_SCALE] : ['1.0', '1.3'];
  for (const scale of scales) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    for (const theme of (process.env.TEST_THEME ? [process.env.TEST_THEME] : ['Light', 'Dark'])) {
      const prefix = `android-${theme.toLowerCase()}-font-${scale}`;
      // Only the isolated fixture package is reset; installed accounts remain untouched.
      await adb('shell', 'pm', 'clear', app);
      await adb('shell', 'am', 'start', '-S', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
      await find('Ready'); await tap(theme); await tap('Browser');
      await tap('设置'); await shot(`${prefix}-settings`);
      await tap('历史记录'); await find('Remote AI 使用指南'); await shot(`${prefix}-history`);
      await type('搜索历史记录', 'Remote'); await find('Remote AI 使用指南');
      assert.ok(!(await nodes()).some(node => node.text === '网页测试页面'));
      await shot(`${prefix}-search`); await back();
      await tap('设置'); await tap('密码管理'); await shot(`${prefix}-passwords-locked`);
      await type('密码库口令', 'browser-test-passphrase'); await tap('解锁密码库');
      await find('demo@example.com'); await shot(`${prefix}-passwords`);
      await tap('编辑密码');
      assert.equal((await find('密码')).password, 'true'); await shot(`${prefix}-password-edit`);
      await tap('保存'); await back();
      await tap('设置'); await tap('历史记录'); await tap('删除此条记录', true);
      assert.equal((await nodes()).filter(node => node['content-desc'] === '删除此条记录').length, 3);
      await tap('删除浏览数据'); await shot(`${prefix}-clear-data`);
      await tap('删除数据'); await shot(`${prefix}-clear-confirm`); await tap('删除数据');
      await find('所选数据已删除。'); await shot(`${prefix}-clear-done`); await back();
      await find('昨天的浏览记录');
      assert.equal((await nodes()).filter(node => node['content-desc'] === '删除此条记录').length, 1);
      await shot(`${prefix}-after-delete`); await back();
      await tap('设置'); await tap('密码管理'); await find('demo@example.com');
      results.push({ prefix, historySearch: true, deleteRange: true, passwordPreserved: true, maskedEditor: true });
      console.log(`Passed ${prefix}`);
    }
  }
  if (results.length) {
    const path = `${output}/android-results.json`;
    const previous = await readFile(path, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return { results: [] };
      throw error;
    });
    const prefixes = new Set(results.map(result => result.prefix));
    const retained = previous.physicalDevice === serial
      ? previous.results.filter(result => !prefixes.has(result.prefix)) : [];
    await writeFile(path, JSON.stringify({ physicalDevice: serial, results: [...retained, ...results] }, null, 2));
  }
} catch (error) {
  await shot('android-failure');
  await writeFile(`${output}/android-failure.json`, JSON.stringify(await nodes(), null, 2)); throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scaleBefore);
  await adb('shell', 'am', 'force-stop', app);
}
