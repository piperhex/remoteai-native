import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device.');
const output = fileURLToPath(new URL('../.codex-tmp/browser-numeric-input/', import.meta.url));
const app = 'com.codexswitch.mobile.portmappingtest';
const port = 18316;
const origin = `http://127.0.0.1:${port}`;
const requests = [];
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  const filename = '/sdcard/browser-numeric-input.xml';
  try { await adb('shell', 'uiautomator', 'dump', filename); }
  catch (error) { if (!error.stdout?.includes(`UI hierchary dumped to: ${filename}`)) throw error; }
  const xml = await adb('shell', 'cat', filename);
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
  throw new Error(`Missing Android label: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number);
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
}
async function submit(value) {
  await tap('访问地址');
  await adb('shell', 'input', 'text', value);
  await adb('shell', 'input', 'keyevent', '66');
}
async function screenshot(name) {
  const filename = '/sdcard/browser-numeric-input.png';
  await adb('shell', 'screencap', '-p', filename);
  await adb('pull', filename, path.join(output, `${name}.png`));
}
async function assertAddress(expected) {
  assert.equal((await find('访问地址')).text.replaceAll('&amp;', '&'), expected);
}
async function verifySearch(scale) {
  await tap('浏览器');
  for (const query of ['666', '664656', '666']) {
    await submit(query);
    await delay(800);
    const address = (await find('访问地址')).text.replaceAll('&amp;', '&');
    const url = new URL(address);
    assert.equal(url.hostname, 'www.google.com');
    assert.equal(url.searchParams.get('q'), query);
  }
  await delay(1500);
  const address = new URL((await find('访问地址')).text.replaceAll('&amp;', '&'));
  assert.equal(address.searchParams.get('q'), '666');
  await screenshot(`android-light-font-${scale}-search-666`);
}
async function verifyNavigation(scale) {
  const start = requests.length;
  await submit(`${origin}/one`); await find('Page one');
  await submit(`${origin}/two`); await find('Page two');
  await adb('shell', 'input', 'keyevent', '4'); await find('Page one');
  await submit(`${origin}/two`); await find('Page two');
  await submit(`${origin}/redirect`); await find('Page final');
  await submit(`${origin}/redirect`); await find('Page final');
  await assertAddress(`${origin}/final`);
  const completed = requests.length;
  await delay(2000);
  assert.equal(requests.length, completed, 'Navigation events must not start repeated requests');
  for (const url of ['/two', '/redirect', '/final']) {
    assert.equal(requests.slice(start).filter(value => value === url).length, 2, `${url} must load only on request`);
  }
  await screenshot(`android-light-font-${scale}-stable-navigation`);
  await submit(`${origin}/disconnect`);
  await find('网页未能加载，请确认服务已启动后刷新。');
  const failed = requests.length;
  await delay(1500);
  assert.equal(requests.length, failed, 'A failed page must not keep retrying itself');
  await screenshot(`android-light-font-${scale}-stable-error`);
}

const server = createServer((request, response) => {
  if (request.url === '/favicon.ico') { response.writeHead(204).end(); return; }
  requests.push(request.url);
  if (request.url === '/disconnect') { request.socket.destroy(); return; }
  if (request.url === '/redirect') { response.writeHead(302, { Location: '/final' }).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  response.end(`<meta name="viewport" content="width=device-width, initial-scale=1">
    <body style="font:18px system-ui;padding:24px"><h1>Page ${request.url.slice(1)}</h1>
    <p>Navigation remains stable.</p></body>`);
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  await adb('shell', 'pm', 'clear', app);
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'start', '-S', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verifySearch(scale);
    await verifyNavigation(scale);
    console.log(`Physical Android font ${scale}: numeric searches, Back/resubmit, redirects and stable failure passed.`);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ serial, requests,
    fontScales: ['1.0', '1.3'], search: true, navigation: true, stableFailure: true }, null, 2));
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
  await adb('reverse', '--remove', `tcp:${port}`);
  server.closeAllConnections(); server.close();
}
