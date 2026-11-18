import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the test device.');
const app = 'com.codexswitch.mobile.chatbrowsertest';
const fontScale = process.env.INSPECTOR_FONT_SCALE ?? '1.0';
const dark = process.env.INSPECTOR_THEME === 'dark';
const prefix = `android-${dark ? 'dark' : 'light'}-font-${fontScale}`;
const output = process.env.INSPECTOR_OUTPUT ??
  fileURLToPath(new URL('../.codex-tmp/browser-inspector/', import.meta.url));
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/inspector-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/inspector-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const entries = await nodes();
    const node = entries.find(entry => entry['content-desc'] === label) ?? entries.find(entry => entry.text === label);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Missing Android control: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number);
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
  await delay(300);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/inspector-screen.png');
  await adb('pull', '/sdcard/inspector-screen.png', path.join(output, `${prefix}-${name}.png`));
}

async function tapFrontend(selector) {
  const point = await frontend.evaluate(`(() => {
    const roots=[document];
    for (const root of roots) for (const node of root.querySelectorAll('*')) {
      if (node.shadowRoot) roots.push(node.shadowRoot);
      if (!node.matches(${JSON.stringify(selector)})) continue;
      const rect=node.getBoundingClientRect();
      if (rect.width) return { x:rect.x+rect.width/2, y:rect.y+rect.height/2, scale:devicePixelRatio };
    }
  })()`);
  assert.ok(point, `DevTools control is present: ${selector}`);
  const bounds = (await find('关闭')).bounds.match(/\d+/g).map(Number);
  await adb('shell', 'input', 'tap', String(Math.round(point.x * point.scale)),
    String(Math.round(bounds[3] + point.y * point.scale)));
  await delay(600);
}

async function enterConsoleNumber(value) {
  await tapFrontend('#console-prompt');
  // Numeric input keeps the check independent of the device's keyboard language.
  await adb('shell', 'input', 'text', String(value));
  await adb('shell', 'input', 'keyevent', '66');
  await delay(500);
  const result = await frontend.evaluate(`(await target.runtimeAgent().invoke_evaluate({
    expression:'$_',includeCommandLineAPI:true,returnByValue:true})).result.value`);
  assert.equal(result, value, 'Native keyboard input evaluates in the inspected website');
  if (!/mInputShown=true/.test(await adb('shell', 'dumpsys', 'input_method'))) return;
  await adb('shell', 'input', 'keyevent', '4');
  await delay(600);
  assert.match(await adb('shell', 'dumpsys', 'input_method'), /mInputShown=false/, 'Back hides the remote keyboard');
}

async function switchToChatWithInspector() {
  await tap('聊天');
  await find('页面预览.html');
  await find('开发者工具');
}

async function returnToInspectedBrowser() {
  await tap('浏览器');
  await find('Inspector fixture');
  await find('开发者工具');
}

async function landscapeBreakpoint() {
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', '1');
  await delay(2000);
  for (let attempt = 0; attempt < 3; attempt++) {
    await tap('停靠在右侧'); await delay(800);
    if ((await find('停靠在右侧')).selected === 'true') break;
  }
  assert.equal((await find('停靠在右侧')).selected, 'true', 'Landscape uses right docking');
  assert.equal(await frontend.evaluate('target.model(sdk.DebuggerModel.DebuggerModel).isPaused()'), true);
  await screenshot('landscape-right-breakpoint');
  await switchToChatWithInspector();
  assert.equal(await frontend.evaluate('target.model(sdk.DebuggerModel.DebuggerModel).isPaused()'), true);
  await screenshot('landscape-right-chat-breakpoint');
  await returnToInspectedBrowser();
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  await delay(1200); await tap('停靠在底部');
}

async function verifyDocking() {
  const originalWidth = await frontend.evaluate('innerWidth');
  await tap('停靠在右侧'); await delay(800);
  assert.ok(await frontend.evaluate('innerWidth') < originalWidth, 'Right docking resizes the same frontend');
  assert.equal(await pageValue('document.querySelector("input").value'), 'Edited draft');
  const [addressLeft, addressTop, addressRight, addressBottom] =
    (await find('访问地址')).bounds.match(/\d+/g).map(Number);
  assert.ok(addressRight - addressLeft > 2 * (addressBottom - addressTop),
    'The address remains readable beside the right dock');
  await screenshot('right');
  await tap('设置'); await find('刷新'); await screenshot('right-settings');
  await adb('shell', 'input', 'keyevent', '4');
  await tap('停靠在底部'); await delay(800);
  assert.equal(await frontend.evaluate('innerWidth'), originalWidth);
  const divider = await find('调整开发者工具大小');
  const [left, top, right, bottom] = divider.bounds.match(/\d+/g).map(Number);
  const x = Math.round((left + right) / 2); const y = Math.round((top + bottom) / 2);
  const before = await frontend.evaluate('innerHeight');
  await adb('shell', 'input', 'swipe', String(x), String(y), String(x), String(y - 360), '600');
  await delay(600);
  assert.ok(await frontend.evaluate('innerHeight') > before + 50, 'Touch dragging grows the docked inspector');
  await screenshot('resized-bottom');
}

async function attachFrontend() {
  const pid = await adb('shell', 'pidof', `${app}:browser_inspector`);
  forward = await adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`);
  let inspector;
  for (let attempt = 0; attempt < 20; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${forward}/json/list`)).json();
    inspector = targets.find(target => target.url.includes('/devtools_app.html?'));
    if (inspector) break;
    await delay(500);
  }
  assert.ok(inspector, 'Inspector frontend WebView must be created');
  const debuggerUrl = new URL(inspector.webSocketDebuggerUrl);
  debuggerUrl.host = `127.0.0.1:${forward}`;
  frontend = await connect(debuggerUrl.href);
  await frontend.evaluate(`window.sdk = await import('./core/sdk/sdk.js'); true`);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await frontend.evaluate('Boolean(window.target = sdk.TargetManager.TargetManager.instance().primaryPageTarget())')) break;
    await delay(500);
  }
  assert.equal(await frontend.evaluate('Boolean(window.target)'), true, 'DevTools must connect to the selected tab');
  return new URL(inspector.url);
}

async function detachFrontend() {
  frontend?.close(); frontend = undefined;
  if (forward) await adb('forward', '--remove', `tcp:${forward}`);
  forward = undefined;
}

async function pageValue(expression) {
  return frontend.evaluate(`(await target.runtimeAgent().invoke_evaluate({expression:${JSON.stringify(expression)},
    returnByValue:true})).result.value`);
}

async function waitForPause() {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await frontend.evaluate('target.model(sdk.DebuggerModel.DebuggerModel).isPaused()')) return;
    await delay(250);
  }
  assert.fail('The real website must pause at the source breakpoint');
}

async function checkServerAccess(url) {
  const port = await adb('forward', 'tcp:0', `tcp:${url.port}`);
  try {
    const request = (pathname, extra = {}) => new Promise((resolve, reject) => {
      const probe = httpRequest(`http://127.0.0.1:${port}${pathname}`, {
        headers: { host: url.host, ...extra },
      }, response => { response.resume(); resolve({ status: response.statusCode }); });
      probe.on('error', reject); probe.end();
    });
    assert.equal((await request(url.pathname)).status, 200);
    assert.equal((await request('/devtools_app.html')).status, 403, 'A session capability is required');
    assert.equal((await request(url.pathname, { origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request(url.pathname, { host: 'untrusted.example' })).status, 403);
  } finally { await adb('forward', '--remove', `tcp:${port}`); }
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const pending = new Map();
  let next = 1;
  socket.on('message', raw => {
    const message = JSON.parse(String(raw));
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => socket.close(), evaluate: async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  } };
}

const server = createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end('window.pauseFixture = () => {\n  const previous = window.fixtureState;\n'
      + '  window.afterBreakpoint = previous + 1;\n};\n'); return;
  }
  if (request.url === '/data') {
    response.setHeader('Content-Type', 'application/json'); response.end('{"inspector":true}'); return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Inspector fixture</title><h1 id="heading">Inspector fixture</h1>'
    + '<button onclick="fetch(\'/data\').then(r=>r.json()).then(console.log)">Fetch data</button>'
    + '<input aria-label="retained draft" value="Keep this draft">'
    + '<script>window.fixtureState=42;console.log("inspector-ready");</script><script src="/fixture.js"></script>');
});

await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(18408, '127.0.0.1', resolve));
const scale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const rotation = await adb('shell', 'settings', 'get', 'system', 'user_rotation');
const autoRotation = await adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation');
let frontend;
let forward;
try {
  await adb('reverse', 'tcp:18408', 'tcp:18408');
  await adb('shell', 'pm', 'clear', app);
  await adb('shell', 'settings', 'put', 'system', 'font_scale', fontScale);
  await adb('shell', 'am', 'start', '-S', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await tap('浏览器'); await tap('设置');
  assert.equal((await find('开发者工具')).enabled, 'false', 'Empty tabs cannot be inspected');
  await adb('shell', 'input', 'keyevent', '4');
  await tap('聊天'); await tap('网页链接'); await find('Inspector fixture');
  if (dark) await tap('深色模式');
  await tap('设置'); await screenshot('settings');
  await tap('开发者工具'); await delay(2500);
  await screenshot('opening');
  await checkServerAccess(await attachFrontend());
  assert.equal(await frontend.evaluate(`(await import('./ui/legacy/theme_support/theme_support.js'))
    .ThemeSupport.instance().themeName()`), dark ? 'dark' : 'default', 'Frontend follows the app theme');
  assert.equal(await pageValue('fixtureState'), 42, 'Console evaluation must reach the live website');
  await pageValue('document.querySelector("input").value="Edited draft"');
  const document = await frontend.evaluate('(await target.domAgent().invoke_getDocument({depth:2})).root');
  assert.equal(document.nodeName, '#document', 'Elements must use the real DOM agent');
  await delay(1500);
  await screenshot('elements');
  await verifyDocking();
  await tap('设置'); await find('刷新'); await screenshot('settings-over-inspector');
  await adb('shell', 'input', 'keyevent', '4');
  assert.equal(await pageValue('fixtureState'), 42, 'Opening the menu keeps the same inspector session');
  await frontend.evaluate(`window.networkSeen=[];
    target.model(sdk.NetworkManager.NetworkManager).addEventListener(sdk.NetworkManager.Events.RequestFinished,
      event=>networkSeen.push({url:event.data.url(),status:event.data.statusCode})); true`);
  await frontend.evaluate(`await target.runtimeAgent().invoke_evaluate({expression:"fetch('/data').then(r=>r.text())",
    awaitPromise:true,returnByValue:true})`);
  assert.equal(await frontend.evaluate(`networkSeen.some(request=>request.url.endsWith('/data') && request.status===200)`), true);
  await frontend.evaluate(`await (await import('./ui/legacy/legacy.js')).InspectorView.InspectorView.instance().showPanel('network')`);
  assert.equal(await frontend.evaluate(`(await import('./ui/legacy/legacy.js')).InspectorView.InspectorView.instance()
    .tabbedPane.selectedTabId`), 'network', 'Network requests must also be visible in the actual panel');
  await delay(500); await screenshot('network');
  await tapFrontend('#tab-console');
  assert.equal(await frontend.evaluate(`(await import('./ui/legacy/legacy.js')).InspectorView.InspectorView.instance()
    .tabbedPane.selectedTabId`), 'console', 'Touch input reaches the embedded remote surface');
  await delay(400);
  await screenshot('console');
  await enterConsoleNumber(17);
  await switchToChatWithInspector();
  assert.equal(await pageValue('fixtureState'), 42, 'The inspector keeps debugging the same website from Chat');
  await enterConsoleNumber(23);
  await screenshot('chat-console');
  await returnToInspectedBrowser();
  assert.equal(await pageValue('document.querySelector("input").value'), 'Edited draft');
  await screenshot('browser-restored-console');
  await frontend.evaluate(`await (await import('./ui/legacy/legacy.js')).InspectorView.InspectorView.instance().showPanel('sources')`);
  await frontend.evaluate('await target.debuggerAgent().invoke_enable()');
  const breakpoint = await frontend.evaluate(`await target.debuggerAgent().invoke_setBreakpointByUrl({
    url:'http://127.0.0.1:18408/fixture.js',lineNumber:2})`);
  assert.ok(breakpoint.locations?.length, `A real source breakpoint must bind: ${JSON.stringify(breakpoint)}`);
  await frontend.evaluate(`await target.runtimeAgent().invoke_evaluate({expression:
    'setTimeout(pauseFixture, 100)'})`);
  await waitForPause();
  assert.equal(await frontend.evaluate(`(await target.debuggerAgent().invoke_evaluateOnCallFrame({
    callFrameId:target.model(sdk.DebuggerModel.DebuggerModel).debuggerPausedDetails().callFrames[0].id,
    expression:'previous',returnByValue:true})).result.value`), 42, 'Paused scope is available');
  await delay(1500);
  await screenshot('breakpoint');
  if (process.env.INSPECTOR_LANDSCAPE === '1') await landscapeBreakpoint();
  await frontend.evaluate('await target.debuggerAgent().invoke_stepOver()');
  await waitForPause();
  await frontend.evaluate('await target.debuggerAgent().invoke_resume()');
  assert.equal(await pageValue('afterBreakpoint'), 43, 'Continue must resume the real paused JavaScript VM');
  console.log('Real breakpoint, paused scope, step-over and resume passed.');
  await pageValue('window.afterBreakpoint=0;setTimeout(pauseFixture,100)');
  await waitForPause();
  await adb('shell', 'input', 'keyevent', '4'); await find('Inspector fixture');
  assert.ok(!(await nodes()).some(node => node.text === '开发者工具'), 'Back closes the inspector first');
  assert.equal((await find('Edited draft')).text, 'Edited draft', 'The live input survives closing DevTools');
  await screenshot('closed');
  await detachFrontend();
  await tap('设置'); await tap('开发者工具'); await delay(1500);
  await attachFrontend();
  assert.equal(await pageValue('afterBreakpoint'), 43, 'Closing a paused inspector must resume the website');
  assert.equal(await pageValue('document.querySelector("input").value'), 'Edited draft');
  await adb('shell', 'input', 'keyevent', '3'); await delay(1000);
  await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await find('Inspector fixture');
  assert.ok(!(await nodes()).some(node => node.text === '开发者工具'), 'Backgrounding closes DevTools');
  console.log('DOM, Console, Network, access restrictions, retained input, reopen and background cleanup passed.');
} catch (error) {
  await screenshot('failure');
  await writeFile(path.join(output, 'failure-ui.json'), JSON.stringify(await nodes(), null, 2));
  throw error;
} finally {
  await detachFrontend();
  await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', rotation);
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', autoRotation);
  await adb('reverse', '--remove', 'tcp:18408');
  server.close();
}
