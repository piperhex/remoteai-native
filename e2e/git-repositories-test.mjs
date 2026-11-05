import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/git-repositories-android');
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device');
const app = 'com.codexswitch.mobile.gitrepositoriesspec';
const adb = async (...args) => (await exec('adb', ['-s', serial, ...args], {
  encoding: 'utf8', timeout: 60_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/git-repositories-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/git-repositories-layout.xml');
  await writeFile(path.join(output, 'latest-layout.xml'), xml);
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])))
    .filter(node => node.package === app);
}
const matches = (node, label) => node['content-desc'] === label || node.text === label;
async function find(label) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const node = (await nodes()).find(value => matches(value, label));
    if (node) return node;
    await delay(400);
  }
  assert.fail(`Missing native label: ${label}`);
}
const center = node => {
  const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)].map(String);
};
async function tap(label) { await adb('shell', 'input', 'tap', ...center(await find(label))); }
async function hold(label) {
  const point = center(await find(label));
  await adb('shell', 'input', 'swipe', ...point, ...point, '800');
}
async function screenshot(name) {
  await delay(400);
  await adb('shell', 'screencap', '-p', '/sdcard/git-repositories-result.png');
  await adb('pull', '/sdcard/git-repositories-result.png', path.join(output, `${name}.png`));
}

async function verifyRoute(expected) {
  await tap('关闭Git');
  await find(expected);
  await tap('Git');
}
async function verify(scale) {
  await tap('Git');
  await find('选择 packages/shared/src/app.ts');
  assert.ok(!(await nodes()).some(node => matches(node, '选择 apps/native')));
  await tap('选择 packages/shared/src/app.ts');
  await tap('选择 src/app.ts');
  await tap('自动生成提交说明');
  await screenshot(`tree-${scale}`);
  await hold('查看 packages/shared/src/app.ts');
  await find('提交单个文件');
  await find('回退单个文件');
  await find('删除文件');
  await screenshot(`file-menu-${scale}`);
  await tap('取消');
  await tap('查看 packages/shared/src/app.ts');
  await find('返回上一层');
  await screenshot(`child-diff-${scale}`);
  await verifyRoute('diff:/projects/demo/packages/shared');
  await tap('返回上一层');
  await tap('提交记录');
  await tap('Git 仓库, demo');
  assert.equal((await find('apps/native')).enabled, 'false');
  await screenshot(`repository-picker-${scale}`);
  await tap('packages/shared');
  await find('e950cd31 合并工具面板');
  await screenshot(`child-history-${scale}`);
  await hold('e950cd31 合并工具面板');
  await find('复制提交哈希');
  await screenshot(`history-menu-${scale}`);
  await tap('取消');
  await tap('e950cd31 合并工具面板');
  await find('变更文件 4');
  await screenshot(`child-commit-files-${scale}`);
  await verifyRoute('files:/projects/demo/packages/shared');
  await tap('查看 src/chat/tools.ts');
  await find('返回上一层');
  await verifyRoute('diff:/projects/demo/packages/shared');
  await tap('返回上一层');
  await find('变更文件 4');
  await tap('返回上一层');
  await tap('Git 仓库, packages/shared');
  await tap('demo');
  await find('e950cd31 合并工具面板');
  await tap('改动 4');
  await tap('提交并推送');
  await find('改动 2');
  await tap('关闭Git');
  await find('commit:/projects/demo/packages/shared|push:/projects/demo/packages/shared|commit:/projects/demo|push:/projects/demo');
  await tap('Git');
  await tap('全选');
  await tap('提交 2 个文件');
  await find('工作区没有未提交的改动。');
  const clean = await nodes();
  assert.ok(!clean.some(node => (node['content-desc'] ?? '').startsWith('选择 ')));
  await screenshot(`clean-${scale}`);
  await tap('关闭Git');
  await find('Git');
  console.log(`PASS: unified tree, selected commit/push routing, repository history and back at font scale ${scale}`);
}
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await mkdir(output, { recursive: true });
  await adb('install', '-r', path.join(root,
    'android/app/build-git-repositories/outputs/apk/debug/app-debug.apk'));
  for (const scale of [1, 1.3]) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', String(scale));
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await verify(scale);
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, fontScales: [1, 1.3] }));
} finally {
  if (originalScale === 'null') await adb('shell', 'settings', 'delete', 'system', 'font_scale');
  else await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
  await adb('shell', 'am', 'force-stop', app);
}
