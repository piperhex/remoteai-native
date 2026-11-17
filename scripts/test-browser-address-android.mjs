import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the Android test device.');
const run = promisify(execFile);
const app = 'com.codexswitch.mobile.chatbrowsertest';
const output = fileURLToPath(new URL('../.codex-tmp/browser-address/', import.meta.url));
const port = 18418;
const origin = `http://127.0.0.1:${port}`;
const longPath = '/conversation/' + '12345678-6698-83ec-b600-d8726a31a1b6/'.repeat(2);
const firstUrl = `${origin}${longPath}?view=first#start`;
const nextUrl = `${origin}${longPath}?view=next#heading`;
const scales = process.env.BROWSER_FONT_SCALE ? [process.env.BROWSER_FONT_SCALE] : ['1.0', '1.3'];
assert.ok(scales.every(scale => scale === '1.0' || scale === '1.3'), 'Use font scale 1.0 or 1.3.');
let pageGeometry;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  const filename = '/sdcard/browser-address-layout.xml';
  try {
    const result = await adb('shell', 'uiautomator', 'dump', filename);
    if (!result.includes(`UI hierchary dumped to: ${filename}`)) return [];
  }
  catch (error) { if (!error.stdout?.includes(`UI hierchary dumped to: ${filename}`)) throw error; }
  const xml = await adb('shell', 'cat', filename);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entries = await nodes();
    const matches = entries.filter(node => node['content-desc'] === label || node.text === label);
    const result = matches.find(node => node.clickable === 'true') ?? matches[0];
    if (result) return result;
    await delay(300);
  }
  throw new Error(`Missing Android label: ${label}`);
}
async function tap(label) {
  const [left, top, right, bottom] = (await find(label)).bounds.match(/\d+/g).map(Number);
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/browser-address.png');
  await adb('pull', '/sdcard/browser-address.png', path.join(output, `${name}.png`));
}
async function tapPageControl(name) {
  // Android WebView can omit its accessibility descendants after a reload. Use the fixture DOM's
  // live control bounds and the current native WebView bounds rather than guessing screen pixels.
  for (let attempt = 0; attempt < 8; attempt++) {
    const frame = (await nodes()).findLast(node => node.class === 'android.webkit.WebView');
    const target = pageGeometry?.[name];
    if (frame && target) {
      const [left, top, right] = frame.bounds.match(/\d+/g).map(Number);
      const scale = (right - left) / pageGeometry.width;
      const x = Math.round(left + target.x * scale), y = Math.round(top + target.y * scale);
      await adb('shell', 'input', 'tap', String(x), String(y)); return;
    }
    await delay(300);
  }
  throw new Error(`Missing fixture control geometry: ${name}`);
}
async function assertAddress(expected) { assert.equal((await find('访问地址')).text, expected); }
async function submit(url) {
  pageGeometry = undefined;
  await tap('访问地址'); await adb('shell', 'input', 'text', url);
  await adb('shell', 'input', 'keyevent', '66');
  await find('Address preview');
}
async function verifyEditing(prefix) {
  await tap('访问地址');
  await screenshot(`${prefix}-focus-selected`);
  await adb('shell', 'input', 'text', 'example.test');
  await assertAddress('example.test');
  await tapPageControl('draft');
  await tap('访问地址');
  await adb('shell', 'input', 'text', firstUrl);
  await assertAddress(firstUrl);
  await adb('shell', 'input', 'keyevent', '123');
  await adb('shell', 'input', 'keyevent', '21');
  await adb('shell', 'input', 'text', 'X');
  await assertAddress(firstUrl.slice(0, -1) + 'X' + firstUrl.slice(-1));
  await adb('shell', 'input', 'keyevent', '67');
  await adb('shell', 'input', 'keyevent', '66');
  await assertAddress(firstUrl);
  await tapPageControl('draft'); await adb('shell', 'input', 'text', 'kept');
  assert.equal((await find('访问地址')).focused, 'false');
  await screenshot(`${prefix}-page-editing`);
  await adb('shell', 'input', 'keyevent', '4');
}

async function verifyNavigation(prefix) {
  await tapPageControl('next'); await assertAddress(nextUrl);
  await screenshot(`${prefix}-page-navigation`);
  await submit(`${origin}/redirect`); await assertAddress(nextUrl);
  await screenshot(`${prefix}-redirect`);
  await tap('新标签页'); await assertAddress('搜索或输入网址');
  await tap('管理标签页（2）'); await tap('Address preview');
  await assertAddress(nextUrl);
  await screenshot(`${prefix}-restored-tab`);
}

const server = createServer((request, response) => {
  if (request.url === '/bounds') {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { pageGeometry = JSON.parse(body); response.end('ok'); }); return;
  }
  if (request.url === '/redirect') { response.writeHead(302, { Location: nextUrl }).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Address preview</title>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<main style="padding:24px;font:18px sans-serif"><h1>Address preview</h1>'
    + `<a id="next" href="${nextUrl}">Next page</a><p><label for="draft">Page draft</label>`
    + '<input id="draft" aria-label="Page draft"></p></main><script>'
    + 'function report(){const data={width:innerWidth};for(const id of ["draft","next"]){'
    + 'const rect=document.getElementById(id).getBoundingClientRect();'
    + 'data[id]={x:rect.x+rect.width/2,y:rect.y+rect.height/2};}'
    + 'fetch("/bounds",{method:"POST",body:JSON.stringify(data)});}'
    + 'addEventListener("resize",report);requestAnimationFrame(report);</script>');
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const previousScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const previousKeyboard = await adb('shell', 'settings', 'get', 'secure', 'show_ime_with_hard_keyboard');
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  await adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
  for (const scale of scales) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    // Reset only the isolated fixture application, never the user's app or account data.
    await adb('shell', 'pm', 'clear', app);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('页面预览.html');
    if (scale === '1.3') await tap('深色模式');
    const prefix = `android-${serial.startsWith('emulator-') ? 'emulator' : 'device'}-`
      + `${scale === '1.3' ? 'dark' : 'light'}-font-${scale}`;
    await tap('浏览器'); await submit(firstUrl); await assertAddress(firstUrl);
    await screenshot(`${prefix}-submitted`);
    console.log(`${prefix}: submitted address captured.`);
    await verifyEditing(prefix);
    await verifyNavigation(prefix);
    console.log(`${prefix}: editing, page navigation, redirect and restored tab passed.`);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ serial, firstUrl, nextUrl, scales }, null, 2));
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', previousScale);
  if (previousKeyboard === 'null') await adb('shell', 'settings', 'delete', 'secure', 'show_ime_with_hard_keyboard');
  else await adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', previousKeyboard);
  await adb('shell', 'am', 'force-stop', app);
  await adb('reverse', '--remove', `tcp:${port}`);
  server.closeAllConnections(); server.close();
}
