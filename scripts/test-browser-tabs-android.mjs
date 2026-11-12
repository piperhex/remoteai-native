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
const output = fileURLToPath(new URL('../.codex-tmp/browser-tabs/', import.meta.url));
const app = 'com.codexswitch.mobile.portmappingtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const port = 18407;
const visualOnly = process.argv.includes('--visual-only');
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  try { await adb('shell', 'uiautomator', 'dump', '/sdcard/browser-tabs-layout.xml'); }
  catch (error) {
    if (error.code !== 137 || !error.stdout?.includes('UI hierchary dumped to: /sdcard/browser-tabs-layout.xml')) throw error;
  }
  const xml = await adb('shell', 'cat', '/sdcard/browser-tabs-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 6; attempt++) {
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
  await adb('shell', 'screencap', '-p', '/sdcard/browser-tabs-screen.png');
  await adb('pull', '/sdcard/browser-tabs-screen.png', path.join(output, `${name}.png`));
}
const back = () => adb('shell', 'input', 'keyevent', '4');
const input = value => adb('shell', 'input', 'text', value);
async function visit(name) {
  await tap('访问地址'); await input(`http://127.0.0.1:${port}/${name}`);
  await adb('shell', 'input', 'keyevent', '66'); await find(`Page ${name}`);
}
const reports = [];
const server = createServer((request, response) => {
  if (request.url === '/state') {
    let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { reports.push(JSON.parse(body)); response.end('ok'); }); return;
  }
  const name = request.url.slice(1) || 'one';
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Page ${name}</title><style>body{margin:0;background:${name === 'one' ? '#e5f5ee' : '#e4edfc'};
    color:#172b36;font:18px sans-serif}header{padding:28px;background:#236b58;color:white}
    main{padding:24px}input,a{display:block;font:inherit;padding:14px;margin:20px 0;max-width:85%}
    .panel{border-radius:16px;background:white;padding:24px;margin-top:24px;min-height:260px}</style>
    <header>Page ${name}</header><main><input aria-label="Draft ${name}" value="draft-${name}">
    <a href="/next">Next page</a><div class="panel">Retained tab ${name}<p>Browser history and session fixture</p></div>
    </main><script>if(!sessionStorage.saved)sessionStorage.saved='session-'+Math.random();
    if(!localStorage.saved)localStorage.saved='local-'+Math.random();
    document.cookie='tabs=cookie-kept; Max-Age=86400; Path=/';
    fetch('/state',{method:'POST',body:JSON.stringify({page:'${name}',session:sessionStorage.saved,
    local:localStorage.saved,cookie:document.cookie})});</script>`);
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  if (!visualOnly) await adb('shell', 'pm', 'clear', app);
  await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
  await delay(1000);
  await adb('shell', 'am', 'start', '-W', '-S', '-n', activity); await delay(1000);
  await tap('浏览器'); await find('访问地址');
  if (!visualOnly) {
  await visit('one');
  await tap('draft-one'); await adb('shell', 'input', 'keyevent', '123'); await input('-unsaved'); await back();
  await tap('新标签页'); await visit('two');
  assert.notEqual(reports[0].session, reports.at(-1).session, 'Each tab needs an independent sessionStorage');
  assert.equal(reports[0].local, reports.at(-1).local, 'Tabs share persistent origin storage');
  const loadCount = reports.length;
  await tap('管理标签页（2）'); await find('搜索标签页'); await screenshot('android-light-font-1.0-tabs');
  await tap('搜索标签页'); await input('missing'); await find('没有匹配的标签页'); await back();
  await back(); await tap('管理标签页（2）'); await tap('Page one');
  await find('draft-one-unsaved');
  assert.equal(reports.length, loadCount, 'Switching tabs must not reload documents');
  await tap('设置'); await tap('关闭'); await tap('浏览器'); await find('Page one');
  assert.equal(reports.length, loadCount, 'Reopening the browser must retain tabs');
  await tap('Next page'); await find('Page next');
  const dimensions = (await adb('shell', 'wm', 'size')).match(/Physical size: (\d+)x(\d+)/);
  const width = Number(dimensions[1]); const y = String(Math.round(Number(dimensions[2]) * 0.55));
  await adb('shell', 'input', 'swipe', '2', y, '12', y, '200');
  await find('Page next');
  await adb('shell', 'input', 'swipe', '2', y, String(Math.round(width * 0.7)), y, '350');
  await find('Page one');
  await adb('shell', 'input', 'swipe', String(width - 2), y, String(Math.round(width * 0.3)), y, '350');
  await find('Page next'); await screenshot('android-edge-forward');
  await back(); await find('Page one'); await back(); await find('访问地址');
  }
  await tap('设置'); await tap('关闭');
  for (const scale of ['1.0', '1.3']) {
    const processId = await adb('shell', 'pidof', app);
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await delay(1000);
    await find('Light');
    assert.equal(await adb('shell', 'pidof', app), processId, 'Font changes must not crash the application');
    for (const theme of ['Light', 'Dark']) {
      await tap(theme); await tap('浏览器'); await find('访问地址');
      const label = `android-${theme.toLowerCase()}-font-${scale}`;
      await screenshot(`${label}-page`); await tap('管理标签页（2）');
      await find('搜索标签页'); await screenshot(`${label}-tabs`); await tap('返回网页');
      await tap('设置'); await find('在浏览器中打开'); await screenshot(`${label}-settings`); await tap('关闭');
    }
  }
  if (!visualOnly) {
  await tap('浏览器'); await tap('管理标签页（2）'); await tap('关闭 Page two'); await tap('关闭 Page one');
  await tap('返回网页'); await find('管理标签页（1）');
  const blankAddress = (await find('访问地址')).text;
  assert.ok(!blankAddress || blankAddress === '搜索或输入网址', 'Closing the last tab leaves a blank page');
  await visit('one'); await tap('新标签页'); await visit('two');
  await adb('shell', 'am', 'start', '-W', '-S', '-n', activity); await delay(1000);
  await tap('浏览器'); await find('Page two'); await find('管理标签页（2）');
  assert.equal(reports.at(-1).local, reports[0].local, 'Local storage survives process restart');
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ physicalDevice: serial, reports,
    tabSessions: true, retainedDrafts: true, edgeBackForward: true, closeLast: true, restoredTabs: true,
    fontScales: ['1.0', '1.3'], themes: ['light', 'dark'] }, null, 2));
  console.log('Native tab retention, search, close, edge history, persistence and visual states passed.');
  } else console.log('Native visual states captured after layout settled.');
} catch (error) {
  await screenshot('failure'); await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  await writeFile(path.join(output, 'failure-exit-info.log'),
    await adb('shell', 'dumpsys', 'activity', 'exit-info', app));
  throw error;
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('reverse', '--remove', `tcp:${port}`);
  await adb('shell', 'am', 'force-stop', app);
  server.close();
}
