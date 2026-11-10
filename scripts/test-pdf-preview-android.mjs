import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { pinchPdf, pdfFocusError } from '../e2e/pdf-touch.mjs';

const run = promisify(execFile);
const serial = process.env.ANDROID_SERIAL;
const pdfPath = process.env.PDF_PREVIEW_FIXTURE;
const entries = process.env.PDF_PREVIEW_ENTRIES?.split(',') ?? ['project', 'community'];
assert.ok(entries.length && entries.every(entry => ['project', 'community'].includes(entry)), 'Invalid preview entry.');
const scales = process.env.PDF_PREVIEW_FONT_SCALES?.split(',') ?? ['1.0', '1.3'];
const gesturesOnly = process.env.PDF_PREVIEW_GESTURES_ONLY === '1';
assert.ok(serial && pdfPath, 'Set ANDROID_SERIAL and PDF_PREVIEW_FIXTURE.');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.codex-tmp/pdf-preview-android');
const app = 'com.codexswitch.mobile.pdfpreviewtest';
const activity = `${app}/com.codexswitch.mobile.MainActivity`;
const adb = async (...args) => (await run('adb', ['-s', serial, ...args], {
  timeout: 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
})).stdout.trim();

async function nodes() {
  try { await adb('shell', 'uiautomator', 'dump', '/sdcard/pdf-preview-layout.xml'); }
  catch (error) {
    // Low-memory emulators can reclaim the inspector after it has written a complete hierarchy.
    if (error.code !== 137 || !error.stdout?.includes('UI hierchary dumped to: /sdcard/pdf-preview-layout.xml')) throw error;
  }
  const xml = await adb('shell', 'cat', '/sdcard/pdf-preview-layout.xml');
  return [...xml.matchAll(/<node\b([^>]*)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])));
}
async function find(label) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const node = (await nodes()).find(entry => entry.text === label || entry['content-desc'] === label);
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
  await adb('shell', 'screencap', '-p', '/sdcard/pdf-preview-screen.png');
  await adb('pull', '/sdcard/pdf-preview-screen.png', path.join(output, `${name}.png`));
  assert.ok((await readFile(path.join(output, `${name}.png`))).length > 1000, 'Missing screenshot data');
}
async function nativeSwipePdf(page, pages, { dx = 0, dy = -140 } = {}) {
  const view = (await nodes()).find(node => node.class === 'android.webkit.WebView');
  assert.ok(view, 'Missing native PDF WebView');
  const [left, top, right] = [...view.bounds.matchAll(/\d+/g)].map(value => Number(value[0]));
  const scale = (right - left) / await page.evaluate(() => window.innerWidth);
  const bounds = await pages.boundingBox();
  const x = left + (bounds.x + bounds.width / 2) * scale;
  const y = top + (bounds.y + bounds.height / 2) * scale;
  const motion = (type, x, y) => adb('shell', 'input', 'motionevent', type, String(Math.round(x)), String(Math.round(y)));
  await motion('DOWN', x, y);
  try {
    for (let step = 1; step <= 4; step++) await motion('MOVE', x + dx * scale * step / 4, y + dy * scale * step / 4);
  } finally { await motion('UP', x + dx * scale, y + dy * scale); }
}
async function connectWebview() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pid = (await adb('shell', 'pidof', app)).split(' ')[0];
    const sockets = await adb('shell', 'cat', '/proc/net/unix');
    const socket = sockets.match(new RegExp(`@([^\\s]*webview_devtools_remote_${pid})`))?.[1];
    if (socket) {
      const port = await adb('forward', 'tcp:0', `localabstract:${socket}`);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
      try {
        const context = browser.contexts()[0];
        const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: 45_000 });
        return { browser, page, port };
      } catch (error) {
        await browser.close();
        await adb('forward', '--remove', `tcp:${port}`);
        throw error;
      }
    }
    await delay(400);
  }
  throw new Error('The fixture WebView did not expose its debug socket.');
}
async function verifyReader(page, entry, scale) {
    const pdf = page.locator('.file-pdf-preview');
    await expect(pdf.locator('.file-pdf-page')).toHaveCount(28, { timeout: 45_000 });
    const first = pdf.locator('.file-pdf-page[data-pdf-page="1"] canvas');
    await expect(first).toBeVisible();
    await expect.poll(() => first.evaluate(canvas => {
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let index = 0; index < pixels.length; index += 16) if (pixels[index] < 100 && pixels[index + 3]) ink++;
      return ink;
    })).toBeGreaterThan(20);
    await screenshot(`android-${entry}-first-page-font${scale}`);
    console.log(`${entry}: rendered the original PDF at font scale ${scale}.`);
    const input = pdf.getByRole('textbox', { name: '页码', exact: true });
    await input.fill('6'); await input.press('Enter');
    await input.blur();
    await expect(pdf.locator('.file-pdf-page[data-pdf-page="6"] canvas')).toBeVisible({ timeout: 45_000 });
    const pages = pdf.locator('.file-pdf-pages');
    const focus = await pinchPdf(page, pages, { dx: 10, dy: 15 });
    assert.ok(focus.liveWidth > focus.width * 1.5, 'PDF should scale while fingers move');
    await expect.poll(() => pdfFocusError(pages, focus), { timeout: 45_000 }).toBeLessThan(4);
    assert.equal(await page.evaluate(() => window.visualViewport?.scale), 1, 'Only the PDF content should zoom');
    await expect(pdf.locator(`.file-pdf-page[data-pdf-page="${focus.page}"] canvas`))
      .toBeVisible({ timeout: 45_000 });
    await screenshot(`android-${entry}-pinch-font${scale}`);
    const before = await pages.evaluate(element => ({ top: element.scrollTop, left: element.scrollLeft }));
    await nativeSwipePdf(page, pages);
    await expect.poll(() => pages.evaluate(element => element.scrollTop)).toBeGreaterThan(before.top + 20);
    await nativeSwipePdf(page, pages, { dx: -90, dy: 0 });
    await expect.poll(() => pages.evaluate(element => element.scrollLeft)).toBeGreaterThan(before.left + 10);
    await page.waitForTimeout(400);
    const smaller = await pinchPdf(page, pages, { from: 190, to: 110 });
    assert.ok(smaller.liveWidth < smaller.width * .7);
    await expect.poll(() => pdfFocusError(pages, smaller), { timeout: 45_000 }).toBeLessThan(4);
    await expect(pdf.locator('.file-pdf-page-list')).toHaveCSS('transform', 'none');
    console.log(`${entry}: pinch in/out, focal position and one-finger panning passed at font scale ${scale}.`);
    if (gesturesOnly) return;
    await pdf.getByRole('button', { name: '适应窗口', exact: true }).click();
    await input.fill('1'); await input.press('Enter');
    await pdf.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(pdf.locator('.file-pdf-pages')).toHaveAttribute('data-current-page', '2');
    await expect(pdf.locator('.file-pdf-page[data-pdf-page="2"] canvas')).toBeVisible();
    await pdf.getByRole('button', { name: 'PDF 导航', exact: true }).click();
    await expect(pdf.locator('.file-pdf-thumbnail')).toHaveCount(28);
    await expect(pdf.locator('.file-pdf-thumbnail[data-thumbnail-page="2"] canvas')).toBeVisible({ timeout: 45_000 });
    await screenshot(`android-${entry}-thumbnails-font${scale}`);
    console.log(`${entry}: selected page thumbnail rendered at font scale ${scale}.`);
    await pdf.getByRole('button', { name: '目录大纲', exact: true }).click();
    await expect(pdf.getByRole('button', { name: 'Additional Experiments', exact: true })).toBeVisible();
    await screenshot(`android-${entry}-outline-font${scale}`);
    await pdf.getByRole('button', { name: 'Additional Experiments', exact: true }).click();
    await expect.poll(() => pdf.locator('.file-pdf-pages').evaluate(element => {
      const target = element.querySelector('.file-pdf-page[data-pdf-page="15"]').getBoundingClientRect();
      const top = element.getBoundingClientRect().top;
      return target.top <= top + 16 && target.bottom > top + 16;
    })).toBe(true);
    await expect(pdf.locator('.file-pdf-page[data-pdf-page="15"] canvas')).toBeVisible();
    await screenshot(`android-${entry}-page15-font${scale}`);
}

async function verifyCommunity(scale) {
  await tap('上限 100 MB');
  await find('Preview limit: 100 MB');
  await tap('社区 PDF 预览');
  const { browser, page, port } = await connectWebview();
  try {
    await verifyReader(page, 'community', scale);
  } finally {
    await browser.close();
    await adb('forward', '--remove', `tcp:${port}`);
  }
  await tap('关闭attachment-2610.39813v2.pdf');
  await find(`${source.length} bytes`);
}

async function verifyProject(scale) {
  await tap(gesturesOnly ? '上限 100 MB' : '上限 1 MB');
  await tap('文件浏览 PDF 预览');
  const { browser, page, port } = await connectWebview();
  try {
    await page.getByRole('treeitem', { name: 'attachment-2610.39813v2.pdf', exact: true }).click();
    if (!gesturesOnly) {
      await expect(page.locator('.pf-file-panel:not([hidden])')).toContainText('暂时无法预览');
      await expect(page.locator('.file-pdf-preview')).toHaveCount(0);
      await screenshot(`android-project-limit-1mb-font${scale}`);
      await tap('上限 100 MB');
    }
    await verifyReader(page, 'project', scale);
    if (!gesturesOnly) {
      await tap('上限 1 MB');
      await expect(page.locator('.file-pdf-preview')).toHaveCount(0);
      await expect(page.locator('.pf-file-panel:not([hidden])')).toContainText('暂时无法预览');
      console.log(`File-browser PDF passed at font scale ${scale}, including live 1/100 MB policy changes.`);
    }
  } finally {
    await browser.close();
    await adb('forward', '--remove', `tcp:${port}`);
  }
  await tap('关闭文件浏览器');
  await find(`${source.length} bytes`);
}

await mkdir(output, { recursive: true });
const source = await readFile(pdfPath);
const hash = createHash('sha256').update(source).digest('hex');
const originalScale = await adb('shell', 'settings', 'get', 'system', 'font_scale');
const previousActivity = (await adb('shell', 'dumpsys', 'activity', 'activities'))
  .match(/mResumedActivity:.*? u\d+ ([\w.]+\/[\w.$]+)/)?.[1];
const apkPath = path.join(root, 'android/app/build-pdf-preview/outputs/apk/debug/app-debug.apk');
if (process.env.PDF_PREVIEW_SKIP_INSTALL === '1') {
  const installed = (await adb('shell', 'pm', 'path', app)).split(/\r?\n/)[0].replace(/^package:/, '');
  assert.match(installed, /^\/data\/app\/[A-Za-z0-9/_=~.+-]+\/base\.apk$/);
  const expected = createHash('sha256').update(await readFile(apkPath)).digest('hex');
  assert.equal((await adb('shell', 'sha256sum', installed)).split(/\s/)[0], expected, 'Installed APK differs from this build');
} else await adb('install', '-r', apkPath);
const deviceDirectory = `/sdcard/Android/data/${app}/files`;
await adb('shell', 'mkdir', '-p', deviceDirectory);
await adb('push', pdfPath, `${deviceDirectory}/preview-paper.pdf`);
assert.equal((await adb('shell', 'sha256sum', `${deviceDirectory}/preview-paper.pdf`)).split(/\s/)[0], hash);
const result = { serial, bytes: source.length, sha256: hash, project: [], community: [], chat: 'not-run' };
try {
  for (const entry of entries) {
    for (const scale of scales) {
      await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
      await adb('shell', 'am', 'force-stop', app);
      await adb('shell', 'am', 'start', '-W', '-n', activity);
      await find(`${source.length} bytes`);
      console.log(`Loaded the original ${source.length}-byte PDF at font scale ${scale} for ${entry}.`);
      if (entry === 'project') await verifyProject(scale); else await verifyCommunity(scale);
      result[entry].push({ scale, pages: 28, continuous: true, pinch: true, oneFingerPan: true,
        ...(!gesturesOnly ? { outlinePage: 15,
          ...(entry === 'project' ? { liveAdminLimits: [1, 100, 1] } : {}) } : {}) });
      await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    }
  }
  await tap('对话 PDF 预览');
  await find('下载后即可用相应的应用打开。');
  assert.ok(!(await nodes()).some(node => node.class === 'android.webkit.WebView'));
  await screenshot('android-chat-pdf-download-only');
  result.chat = 'download-only; no embedded PDF viewer';
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error);
  await screenshot('android-pdf-failure').catch(cause => console.warn('Failure screenshot unavailable:', String(cause)));
  throw error;
} finally {
  const restore = async () => {
    await adb('shell', 'settings', 'put', 'system', 'font_scale', originalScale);
    await adb('shell', 'am', 'force-stop', app);
    if (previousActivity && !previousActivity.startsWith(app)) await adb('shell', 'am', 'start', '-W', '-n', previousActivity);
    else await adb('shell', 'input', 'keyevent', '3');
  };
  await restore().catch(error => console.warn('Device state restoration failed:', String(error)));
}
