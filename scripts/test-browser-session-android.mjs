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
const baseline = process.env.BROWSER_BASELINE === '1';
const output = fileURLToPath(new URL('../.codex-tmp/mapping-settings-flicker/', import.meta.url));
const app = 'com.codexswitch.mobile.portmappingtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const port = 18406;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  try { await adb('shell', 'uiautomator', 'dump', '/sdcard/browser-session-layout.xml'); }
  catch (error) {
    if (error.code !== 137 || !error.stdout?.includes('UI hierchary dumped to: /sdcard/browser-session-layout.xml')) {
      throw error;
    }
  }
  const xml = await adb('shell', 'cat', '/sdcard/browser-session-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entries = await nodes();
    const node = entries.find(entry => entry['content-desc'] === label) ?? entries.find(entry => entry.text === label);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Missing native label: ${label}`);
}
function center(node) {
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  return [String((left + right) >> 1), String((top + bottom) >> 1)];
}
async function tap(label) { await adb('shell', 'input', 'tap', ...center(await find(label))); }
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/browser-session-screen.png');
  await adb('pull', '/sdcard/browser-session-screen.png', path.join(output, `${name}.png`));
}

const requests = [];
const page = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#234c72;color:white;font:18px sans-serif}header{background:#1456bb;padding:24px}
main{padding:24px;background:repeating-linear-gradient(0deg,#234c72 0 80px,#386788 80px 160px);min-height:1100px}
input{font:inherit;padding:12px;width:85%}p{background:#163752;padding:12px}</style>
<header>Browser session fixture</header><main><h2>Keep this page open</h2><input aria-label="Draft" value="draft-kept">
<p id="local"></p><p id="session"></p><p id="cookie"></p><p>Stable background</p></main>
<script>
if(!localStorage.saved)localStorage.saved='local-'+Date.now();
if(!sessionStorage.saved)sessionStorage.saved='session-'+Date.now();
if(!document.cookie.includes('browser_saved='))document.cookie='browser_saved=cookie-kept; Max-Age=86400; Path=/';
document.querySelector('#local').textContent=localStorage.saved;
document.querySelector('#session').textContent=sessionStorage.saved;
document.querySelector('#cookie').textContent=document.cookie;
fetch('/state',{method:'POST',body:JSON.stringify({local:localStorage.saved,session:sessionStorage.saved,
cookie:document.cookie})});
</script>`;
const server = createServer((request, response) => {
  if (request.url === '/state') {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { requests.push(JSON.parse(body)); response.end('ok'); }); return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(page);
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  if (!baseline) await adb('shell', 'pm', 'clear', app);
  await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
  await adb('shell', 'am', 'start', '-S', '-n', activity);
  await tap('Dark'); await tap('端口映射'); await tap('打开'); await tap('内置浏览器');
  await find('mapped-one');
  await tap('访问地址');
  assert.equal((await find('访问地址')).focused, 'true', 'Address field must accept keyboard input');
  await adb('shell', 'input', 'text', `http://127.0.0.1:${port}/`);
  assert.equal((await find('访问地址')).text, `http://127.0.0.1:${port}/`);
  await adb('shell', 'input', 'keyevent', '66'); await find('Stable background');
  const gear = center(await find('设置'));
  const name = baseline ? 'before' : 'after';
  const recording = adb('shell', 'screenrecord', '--size', '720x1600', '--time-limit', '12',
    `/sdcard/browser-${name}.mp4`).then(() => null, error => error);
  await delay(1000);
  for (let i = 0; i < 5; i++) {
    await adb('shell', 'input', 'tap', ...gear); await delay(500);
    await adb('shell', 'input', 'keyevent', '4'); await delay(500);
  }
  const recordingError = await recording;
  if (recordingError) throw recordingError;
  await adb('pull', `/sdcard/browser-${name}.mp4`, path.join(output, `${name}.mp4`));
  await tap('设置'); await screenshot(`${name}-settings`);
  if (!baseline) {
    await tap('所有书签'); await find('PC bookmark');
    await find('书签已同步，其他设备的修改会自动更新。');
    await screenshot('android-initial-bookmarks');
    await tap('PC folder'); await find('PC nested'); await tap('PC nested');
    await find('Stable background');
    const loaded = requests.at(-1);
    const loadCount = requests.length;
    await tap('设置'); await tap('关闭');
    await adb('shell', 'input', 'keyevent', '4'); await find('浏览器');
    await screenshot('android-reopened-discovery');
    await tap('浏览器'); await find('Stable background');
    assert.equal(requests.length, loadCount, 'Reopening must retain the same document');
    await tap('访问地址'); await adb('shell', 'input', 'keyevent', '66'); await delay(800); await find('Stable background');
    assert.deepEqual(requests.at(-1), loaded, 'Reload must preserve local storage, session storage and cookies');
    await tap('设置'); await tap('关闭'); await tap('PC update'); await tap('浏览器');
    await tap('设置'); await tap('所有书签'); await find('PC updated bookmark');
    await screenshot('android-pc-bookmark-update');
    await adb('shell', 'input', 'keyevent', '4');
    await tap('设置'); await tap('关闭');
    await adb('shell', 'am', 'start', '-S', '-n', activity);
    await tap('浏览器'); await find('Stable background');
    assert.equal(requests.at(-1).local, loaded.local, 'Local storage must survive app restart');
    assert.equal(requests.at(-1).cookie, loaded.cookie, 'Persistent cookies must survive app restart');
    await screenshot('android-persistent-storage-after-restart');
    await tap('设置'); await tap('关闭');
    for (const scale of ['1.0', '1.3']) {
      await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
      for (const theme of ['Light', 'Dark']) {
        const label = `android-${theme.toLowerCase()}-font-${scale}`;
        await tap(theme); await screenshot(`${label}-discovery`); await tap('浏览器');
        await find('Stable background'); await tap('设置'); await screenshot(`${label}-settings`);
        await tap('所有书签'); await find('PC updated bookmark');
        await find('书签已同步，其他设备的修改会自动更新。'); await screenshot(`${label}-bookmarks`);
        await adb('shell', 'input', 'keyevent', '4'); await tap('设置'); await tap('关闭');
      }
    }
  }
  await writeFile(path.join(output, `${name}-requests.json`), JSON.stringify(requests, null, 2));
  console.log(`Recorded ${name}: ${requests.length} document loads.`);
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('reverse', '--remove', `tcp:${port}`);
  await adb('shell', 'am', 'force-stop', app);
  server.close();
}
