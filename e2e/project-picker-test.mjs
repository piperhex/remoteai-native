import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/project-picker-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the intended Android test device');
const app = 'com.codexswitch.mobile.projectpickertest';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/project-picker-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/project-picker-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(value => value['content-desc'] === label || value.text === label);
    if (node) return node;
  }
  assert.fail(`Missing native label: ${label}`);
}
async function tap(label) {
  const node = await find(label);
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/project-picker-result.png');
  await adb('pull', '/sdcard/project-picker-result.png', path.join(output, `${name}.png`));
}
async function verify(scale) {
  await tap('选择项目');
  await find('未归属项目');
  await screenshot(`choices-dark-${scale}`);
  await tap('新建项目');
  await find('选择项目位置');
  await find('Apps'); await find('当前路径'); await find('使用此文件夹');
  await screenshot(`folders-dark-${scale}`);
  await tap('文档');
  await find('D:/Cloud/Documents');
  await tap('最近');
  assert.equal((await find('使用此文件夹')).enabled, 'false');
  await tap('Workspace');
  await tap('文件夹地址');
  await tap('此电脑');
  assert.equal((await find('使用此文件夹')).enabled, 'false');
  await tap('E:');
  await tap('Workspace');
  await tap('Apps');
  await find('E:/Workspace/Apps');
  await tap('返回上一级');
  await find('Apps');
  await tap('使用此文件夹');
  await tap('选择项目');
  await tap('未归属项目');
  await find('未选择项目');
  await find('保留这条尚未发送的消息');
  await tap('明亮');
  await tap('选择项目');
  await tap('Workspace');
  await tap('选择项目');
  await tap('新建项目');
  await find('Apps');
  await screenshot(`folders-light-${scale}`);
  await tap('关闭新建项目');
  console.log(`PASS: Native folder navigation, shortcuts, recent projects, confirmation and no-project at scale ${scale}`);
}

const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await adb('install', '-r', path.join(root, 'android/app/build-project-picker/outputs/apk/debug/app-debug.apk'));
  for (const scale of [1, 1.3]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verify(scale);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, serial, fontScales: [1, 1.3] }));
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
