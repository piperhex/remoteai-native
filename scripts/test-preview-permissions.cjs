const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { permissionTestPage } = require('./webview-permissions/test-page.cjs');

const root = path.resolve(__dirname, '..');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to an Android test device');
const appId = 'com.codexswitch.previewpermissionchecks';
const activity = `${appId}/com.codexswitch.mobile.MainActivity`;
const output = path.join(root, '.codex-tmp/preview-permissions', serial);
const apk = path.join(root, 'android/app/build/outputs/apk/release/preview-permissions-fixture.apk');
fs.mkdirSync(output, { recursive: true });
const results = [];
let command;
let sequence = 0;
let ready = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const device = (...args) => execFileSync('adb', ['-s', serial, ...args], {
  encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
}).trim();

function build() {
  if (process.argv.includes('--skip-build')) return;
  require('./patch-webview-permissions.cjs').applyWebViewPermissionsPatch();
  const arch = process.env.ANDROID_ABI || (serial.startsWith('emulator-') ? 'x86_64' : 'arm64-v8a');
  const args = [':app:assembleRelease', '--no-daemon', `-PreactNativeArchitectures=${arch}`,
    '--init-script', '../scripts/webview-permissions/fixture.init.gradle'];
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? process.env.ComSpec : './gradlew',
    windows ? ['/d', '/c', 'gradlew.bat', ...args] : args, {
      cwd: path.join(root, 'android'), windowsHide: true, stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production', NODE_PATH: path.join(root, 'node_modules') },
    });
  assert.equal(result.status, 0, 'Permission fixture build failed');
}

async function waitFor(check, label) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await check();
    if (result) return result;
    await pause(250);
  }
  throw new Error(`Timed out: ${label}`);
}

function nodes() {
  device('shell', 'uiautomator', 'dump', '/sdcard/preview-permission-layout.xml');
  return [...device('shell', 'cat', '/sdcard/preview-permission-layout.xml').matchAll(/<node\b([^>]*)>/g)]
    .map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(attribute => [attribute[1], attribute[2]])));
}

async function button(resource) {
  return waitFor(() => {
    const current = nodes();
    const standard = current.find(node => node['resource-id'].endsWith(resource));
    const systemButton = [':id/permission_allow_foreground_only_button', ':id/permission_deny_button'].includes(resource);
    if (standard || !systemButton) return standard;
    // This MIUI controller omits button IDs: deny, one-time and foreground are in that order.
    const oem = current.filter(node => node.package === 'com.lbe.security.miui'
      && node.class === 'android.widget.Button');
    return oem.length === 3 ? oem[resource === ':id/permission_deny_button' ? 0 : 2] : undefined;
  }, resource);
}

async function tap(resource) {
  const node = await button(resource);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  device('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  // Allow the HTTP fixture to process pending messages while the native dialog closes.
  await pause(300);
}

function screenshot(name) {
  device('shell', 'screencap', '-p', '/sdcard/preview-permission.png');
  device('pull', '/sdcard/preview-permission.png', path.join(output, name + '.png'));
}

async function request(kind, name) {
  const id = String(sequence++);
  const previousResults = results.length;
  command = { kind, id };
  await button('android:id/button1');
  assert.equal(results.length, previousResults, 'Capture completed before website consent');
  screenshot(name);
  return id;
}

async function result(id, expected) {
  const value = await waitFor(() => results.find(item => item.id === id), `capture ${id}`);
  assert.equal(value.result, expected, JSON.stringify(value));
  if (expected === 'granted') assert.equal(value.live, true);
  return value;
}

async function exercise() {
  let id = await request('audio', 'audio-site-prompt');
  await tap('android:id/button2');
  await result(id, 'NotAllowedError');
  id = await request('audio', 'audio-before-system-prompt');
  await tap('android:id/button1');
  await button(':id/permission_allow_foreground_only_button');
  screenshot('audio-system-prompt');
  await tap(':id/permission_deny_button');
  await result(id, 'NotAllowedError');
  id = await request('audio', 'audio-retry-system-denial');
  await tap('android:id/button1');
  await tap(':id/permission_allow_foreground_only_button');
  assert.deepEqual((await result(id, 'granted')).tracks, ['audio']);
  id = await request('video', 'video-site-prompt');
  await tap('android:id/button1');
  await tap(':id/permission_allow_foreground_only_button');
  assert.deepEqual((await result(id, 'granted')).tracks, ['video']);
  id = await request('both', 'both-site-prompt-pregranted');
  await tap('android:id/button1');
  assert.deepEqual((await result(id, 'granted')).tracks.sort(), ['audio', 'video']);
  id = await request('both', 'both-deny-pregranted');
  await tap('android:id/button2');
  await result(id, 'NotAllowedError');
  const canceled = await request('audio', 'navigation-pending');
  command = { kind: 'navigate' };
  await waitFor(() => !nodes().some(node => node['resource-id'] === 'android:id/button1'), 'navigation cancellation');
  id = await request('both', 'redirect-site-prompt');
  await tap('android:id/button1');
  const redirected = await result(id, 'granted');
  assert.equal(redirected.origin, 'http://localhost:1497');
  assert.notEqual(results.find(item => item.id === canceled)?.result, 'granted');
  screenshot('capture-success');
}

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/ready') { ready++; response.end('ok'); return; }
    if (url.pathname === '/command') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(command ?? null)); command = undefined; return;
    }
    if (url.pathname === '/result') {
      let data = '';
      request.on('data', chunk => { data += chunk; });
      request.on('end', () => { results.push(JSON.parse(data)); response.end('ok'); });
      return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(permissionTestPage);
  });
}

async function main() {
  build();
  const server = createServer();
  let installed = false;
  const originalScale = device('shell', 'settings', 'get', 'system', 'font_scale');
  const originalNightMode = device('shell', 'cmd', 'uimode', 'night').split(':').at(-1).trim();
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    device('reverse', 'tcp:1497', `tcp:${server.address().port}`);
    device('install', '-r', apk); installed = true;
    device('shell', 'pm', 'clear', appId);
    device('shell', 'settings', 'put', 'system', 'font_scale', '1');
    device('shell', 'cmd', 'uimode', 'night', 'no');
    device('shell', 'am', 'start', '-W', '-n', activity);
    await waitFor(() => ready > 0, 'initial page readiness');
    await exercise();
    device('shell', 'am', 'force-stop', appId);
    device('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
    device('shell', 'cmd', 'uimode', 'night', 'yes');
    ready = 0;
    device('shell', 'am', 'start', '-W', '-n', activity);
    await waitFor(() => ready > 0, 'enlarged page readiness');
    const id = await request('both', 'both-dark-enlarged-font');
    await tap('android:id/button2');
    await result(id, 'NotAllowedError');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log('PREVIEW_PERMISSIONS_PASSED', serial, results.length);
  } catch (error) {
    screenshot('failure');
    fs.writeFileSync(path.join(output, 'failure-layout.json'), JSON.stringify(nodes(), null, 2));
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    device('shell', 'settings', 'put', 'system', 'font_scale', originalScale === 'null' ? '1' : originalScale);
    device('shell', 'cmd', 'uimode', 'night', originalNightMode);
    device('shell', 'am', 'force-stop', appId);
    if (installed) device('uninstall', appId);
    device('reverse', '--remove', 'tcp:1497');
    server.closeAllConnections(); server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
