import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hierarchy, prepareHierarchy } from '../vendor/apps/desktop/e2e/android-hierarchy.mjs';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to an available physical test device.');
const output = fileURLToPath(new URL('../.codex-tmp/image-navigation/', import.meta.url));
const app = 'com.codexswitch.mobile.imagenavigationtest';
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
async function preparePinch() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK.');
  const build = path.join(output, 'gesture');
  await mkdir(build, { recursive: true });
  const libraries = ['android.jar', 'uiautomator.jar', 'optional/android.test.base.jar']
    .map(name => path.join(sdk, 'platforms', 'android-35', name));
  const executable = name => process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name;
  await run(executable('javac'), ['--release', '8', '-encoding', 'UTF-8', '-cp', libraries.join(path.delimiter),
    '-d', build, fileURLToPath(new URL('./fixtures/ImageNavigationGesture.java', import.meta.url))],
  { windowsHide: true });
  const jar = path.join(build, 'gesture.jar');
  await run(executable('java'), ['-cp', path.join(sdk, 'build-tools/35.0.0/lib/d8.jar'), 'com.android.tools.r8.D8',
    ...libraries.flatMap(library => ['--lib', library]), '--output', jar,
    path.join(build, 'dev/codexswitch/testing/ImageNavigationGesture.class')], { windowsHide: true });
  await adb('push', jar, '/data/local/tmp/image-navigation-gesture.jar');
}
async function nodes() {
  const xml = await hierarchy(adb);
  await writeFile(path.join(output, 'latest.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const node = (await nodes()).find(entry => entry['content-desc'] === label || entry.text === label);
    if (node) return node;
    await delay(250);
  }
  throw new Error(`Missing control: ${label}`);
}
async function ensureForeground() {
  const windows = await adb('shell', 'dumpsys', 'window');
  assert.ok(windows.split('\n').some(line => line.includes('mCurrentFocus=') && line.includes(app)),
    'Another app took the device; do not inject touches into it.');
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await ensureForeground();
  await adb('shell', 'input', 'tap', String((left + right) >> 1), String((top + bottom) >> 1));
  await delay(300);
}
async function capture(name) {
  await ensureForeground();
  await adb('shell', 'screencap', '-p', '/sdcard/image-navigation.png');
  await adb('pull', '/sdcard/image-navigation.png', path.join(output, `${name}.png`));
}
async function arrows(previous, next) {
  assert.equal((await find('上一个')).enabled, String(previous));
  assert.equal((await find('下一个')).enabled, String(next));
}
async function back() {
  await ensureForeground();
  await adb('shell', 'input', 'keyevent', '4');
  await find('放大查看：Image 3');
}
async function verifyGallery(scale) {
  await tap('放大查看：Image 3'); await find('Image 3'); await arrows(true, false);
  await tap('下一个'); await find('Image 3');
  await capture(`native-font${scale}-last`);
  await tap('上一个'); await find('Image 2'); await arrows(true, true);
  await capture(`native-font${scale}-middle`);
  await tap('查看原图');
  assert.ok(!(await nodes()).some(node => node['content-desc'] === '查看原图'));
  await tap('上一个'); await arrows(false, true); await find('查看原图');
  await capture(`native-font${scale}-first`);
  if (scale === '1.0') {
    const result = await adb('shell', 'uiautomator', 'runtest', '/system/framework/android.test.base.jar',
      '/data/local/tmp/image-navigation-gesture.jar', '-c', 'dev.codexswitch.testing.ImageNavigationGesture');
    assert.ok(result.includes('OK (1 test)') && !result.includes('shortMsg='), result);
    await capture('native-font1.0-zoomed');
  }
  await tap('下一个'); await find('Image 2'); await arrows(true, true);
  await back();
  await tap('single'); await tap('放大查看：Image 3'); await arrows(false, false);
  await capture(`native-font${scale}-single`); await back(); await tap('single');
  await tap('放大查看：照片 2'); await arrows(true, true);
  await capture(`native-font${scale}-draft-middle`);
  await tap('上一个'); await find('照片 1'); await arrows(false, true);
  await tap('下一个'); await tap('下一个'); await find('照片 3'); await arrows(true, false);
  await back();
  console.log(`Android image navigation verified at font scale ${scale}`);
}

await mkdir(output, { recursive: true });
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const originalRotation = await adb('shell', 'settings', 'get', 'system', 'user_rotation');
const originalAutoRotation = await adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation');
await prepareHierarchy({ adb, output });
await preparePinch();
const images = await Promise.all([1, 2, 3].map(async index => 'data:image/png;base64,' +
  (await readFile(new URL(`./fixtures/image-navigation-${index}.png`, import.meta.url))).toString('base64')));
const server = createServer((request, response) => {
  const index = Number(new URL(request.url, 'http://127.0.0.1').searchParams.get('index'));
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ url: images[index] }));
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(15987, '127.0.0.1', resolve); });
try {
  await adb('reverse', 'tcp:15987', 'tcp:15987');
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verifyGallery(scale);
  }
  await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', '1');
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  await tap('放大查看：Image 3'); await arrows(true, false);
  await tap('上一个'); await find('Image 2'); await arrows(true, true);
  await capture('native-landscape-middle');
  await back();
  console.log('Android landscape navigation verified');
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', originalRotation);
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', originalAutoRotation);
  await adb('shell', 'am', 'force-stop', app);
  await adb('reverse', '--remove', 'tcp:15987');
  server.close();
}
