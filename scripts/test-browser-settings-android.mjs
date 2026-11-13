import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device.');
const output = fileURLToPath(new URL('../.codex-tmp/browser-settings/', import.meta.url));
const app = 'com.codexswitch.mobile.portmappingtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  try { await adb('shell', 'uiautomator', 'dump', '/sdcard/browser-settings-layout.xml'); }
  catch (error) {
    if (error.code !== 137 || !error.stdout?.includes('UI hierchary dumped to: /sdcard/browser-settings-layout.xml')) {
      throw error;
    }
  }
  const xml = await adb('shell', 'cat', '/sdcard/browser-settings-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entries = await nodes();
    const node = entries.findLast(entry => entry['content-desc'] === label)
      ?? entries.findLast(entry => entry.text === label);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Missing native label: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/browser-settings-screen.png');
  await adb('pull', '/sdcard/browser-settings-screen.png', path.join(output, `${name}.png`));
}
const back = () => adb('shell', 'input', 'keyevent', '4');
async function search(query, host) {
  await tap('访问地址');
  await adb('shell', 'input', 'text', query);
  await adb('shell', 'input', 'keyevent', '66');
  const address = (await find('访问地址')).text;
  const allowedHosts = host === 'www.bing.com' ? [host, 'cn.bing.com'] : [host];
  assert.ok(allowedHosts.includes(new URL(address).hostname), `Unexpected search address: ${address}`);
  assert.ok(address.includes(query), 'Typed query must be preserved');
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('shell', 'pm', 'clear', app);
  await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
  await adb('shell', 'am', 'start', '-S', '-n', activity);
  await tap('浏览器'); await tap('设置'); await tap('默认搜索引擎');
  assert.equal((await find('谷歌')).checked, 'true', 'Google must be selected initially');
  await screenshot('android-default-google'); await back();
  await search('browser-search-fixture', 'www.google.com');
  await tap('设置'); await tap('默认搜索引擎'); await tap('百度');
  assert.equal((await find('百度')).checked, 'true'); await back();
  await search('browser-baidu-fixture', 'www.baidu.com');
  await adb('shell', 'am', 'start', '-S', '-n', activity);
  await tap('浏览器'); await tap('设置'); await tap('默认搜索引擎');
  assert.equal((await find('百度')).checked, 'true', 'Search preference must survive app restart');
  await screenshot('android-persisted-baidu'); await tap('必应'); await back();
  await search('browser-bing-fixture', 'www.bing.com');
  await tap('设置'); await tap('端口映射'); await find('http://127.0.0.1:18306');
  await tap('http://127.0.0.1:18306'); await find('mapped-one');
  assert.ok((await find('访问地址')).text.startsWith('http://127.0.0.1:18306'));
  await screenshot('android-mapped-page');
  await tap('Return to fixture'); await tap('Disconnect fixture'); await tap('浏览器');
  await tap('设置'); await tap('端口映射'); await find('暂无可打开的端口映射');
  await screenshot('android-disconnected-empty'); await back();
  await tap('Return to fixture'); await tap('Reconnect fixture');
  console.log('Search defaults, changes, restart persistence, mapping selection and disconnect passed.');
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    for (const theme of ['Light', 'Dark']) {
      const label = `android-${theme.toLowerCase()}-font-${scale}`;
      await tap(theme); await tap('浏览器'); await tap('设置'); await screenshot(`${label}-settings`);
      await tap('默认搜索引擎'); await find('DuckDuckGo'); await screenshot(`${label}-engines`); await back();
      await tap('设置'); await tap('端口映射'); await find('http://127.0.0.1:18306');
      await screenshot(`${label}-mappings`); await back(); await tap('Return to fixture');
      console.log(`Verified ${label}`);
    }
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ physicalDevice: serial,
    searchDefaults: true, persistence: true, activeMapping: true, disconnect: true, fontScales: ['1.0', '1.3'] }));
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
