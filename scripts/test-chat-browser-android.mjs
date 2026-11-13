import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
assert.ok(serial, 'Set ANDROID_SERIAL to the physical test device.');
const app = 'com.codexswitch.mobile.chatbrowsertest';
const imagesOnly = process.argv.includes('--images-only');
const output = fileURLToPath(new URL('../.codex-tmp/chat-browser/', import.meta.url));
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();
async function nodes() {
  await adb('shell', 'uiautomator', 'dump', '/sdcard/chat-browser-layout.xml');
  const xml = await adb('shell', 'cat', '/sdcard/chat-browser-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label, index = 0) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const entries = await nodes();
    const labelled = entries.filter(node => node['content-desc'] === label);
    const interactive = labelled.filter(node => node.clickable === 'true');
    const matches = interactive.length ? interactive : labelled;
    const match = matches[index] ?? entries.filter(node => node.text === label)[index];
    if (match) return match;
    await delay(400);
  }
  throw new Error(`Missing Android control: ${label}`);
}
async function tap(label, index = 0, hold = false) {
  const node = await find(label, index);
  const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number);
  const x = String(Math.round((left + right) / 2)), y = String(Math.round((top + bottom) / 2));
  if (hold) await adb('shell', 'input', 'swipe', x, y, x, y, '850');
  else await adb('shell', 'input', 'tap', x, y);
  await delay(250);
}
async function screenshot(name) {
  await adb('shell', 'screencap', '-p', '/sdcard/chat-browser-screen.png');
  await adb('pull', '/sdcard/chat-browser-screen.png', path.join(output, `${name}.png`));
}
async function tapImageCanvas() {
  const size = await adb('shell', 'wm', 'size');
  const [width, height] = [...size.matchAll(/(\d+)x(\d+)/g)].at(-1).slice(1).map(Number);
  await adb('shell', 'input', 'tap', String(Math.round(width / 2)), String(Math.round(height / 2)));
  await delay(500);
}
async function verifyImageTaps(prefix) {
  await tap('放大查看：图片菜单');
  await find('查看原图');
  await tapImageCanvas();
  await find('放大查看：图片菜单');
  await tap('放大查看：图片菜单', 0, true);
  await tap('在内置浏览器中打开');
  await find('管理标签页（2）');
  await tapImageCanvas();
  await find('管理标签页（2）');
  await screenshot(`${prefix}-image-after-tap`);
  await tap('聊天'); await tap('图片预览.png');
  await find('管理标签页（3）');
  await tapImageCanvas();
  await find('管理标签页（3）');
  await screenshot(`${prefix}-image-file-after-tap`);
  console.log(`${prefix}: browser image taps retain both tabs; fullscreen image tap still dismisses.`);
}
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><title>Website preview</title>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><h1>Website preview</h1>');
});
await mkdir(output, { recursive: true });
await new Promise(resolve => server.listen(18408, '127.0.0.1', resolve));
const previousScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
try {
  await adb('reverse', 'tcp:18408', 'tcp:18408');
  for (const scale of ['1.0', '1.3']) {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await adb('shell', 'am', 'force-stop', app);
    // Only fixture-owned state is reset, so each run starts with one blank tab.
    await adb('shell', 'pm', 'clear', app);
    await adb('shell', 'am', 'start', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
    await find('页面预览.html');
    if (scale === '1.3') await tap('深色模式');
    const prefix = `android-${scale === '1.3' ? 'dark' : 'light'}-font${scale}`;
    if (imagesOnly) { await verifyImageTaps(prefix); continue; }
    await tap('页面预览.html'); await find('管理标签页（2）'); await find('验证交互');
    await tap('验证交互'); await find('点击成功'); await screenshot(`${prefix}-html`);
    await tap('聊天'); await tap('页面预览.html'); await find('管理标签页（3）'); await find('验证交互');
    await tap('管理标签页（3）'); await find('搜索标签页'); await screenshot(`${prefix}-duplicate-tabs`);
    await tap('页面预览.html', 0); await find('点击成功');
    await tap('聊天'); await tap('说明文档.md'); await find('中文预览标题');
    await screenshot(`${prefix}-markdown`);
    await tap('聊天'); await tap('阅读文档.pdf'); await find('管理标签页（5）');
    await find('PDF 导航'); await screenshot(`${prefix}-pdf`);
    console.log(`${prefix}: retained HTML, Markdown and PDF passed.`);
    await tap('聊天'); await tap('下载文件.zip'); await find('管理标签页（6）');
    await find('下载后即可用相应的应用打开。'); await screenshot(`${prefix}-download`);
    await tap('聊天'); await tap('放大查看：图片菜单', 0, true);
    await find('在内置浏览器中打开'); await screenshot(`${prefix}-image-menu`);
    await tap('在内置浏览器中打开'); await find('管理标签页（7）');
    await screenshot(`${prefix}-image`);
    await tap('聊天'); await tap('网页链接'); await find('Website preview');
    await tap('聊天'); await tap('网页链接'); await find('管理标签页（9）'); await find('Website preview');
    await tap('管理标签页（9）'); await tap('搜索标签页');
    await adb('shell', 'input', 'text', 'Website'); await adb('shell', 'input', 'keyevent', '4');
    await tap('关闭 Website preview');
    await tap('返回网页'); await find('管理标签页（8）');
    console.log(`Android font ${scale}: duplicate previews, retention, PDF, images, downloads and web tabs passed.`);
  }
} finally {
  await adb('shell', 'settings', 'put', 'system', 'font_scale', previousScale);
  await adb('reverse', '--remove', 'tcp:18408');
  server.close();
}
