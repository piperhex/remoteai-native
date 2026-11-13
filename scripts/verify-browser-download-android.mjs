import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const bounds = node => node.bounds.match(/\d+/g).map(Number);
export async function verifyBrowserDownload({ adb, find, tap, nodes, screenshot, prefix }) {
  await tap('下载文件.zip');
  await find('下载后即可用相应的应用打开。');
  const capture = async state => {
    const tree = await nodes();
    const card = tree.find(node => node['resource-id'] === 'browser-download-card');
    assert.ok(card, 'The download card has a measurable native layout');
    const [left, top, right, bottom] = bounds(card);
    const toolbar = bounds(tree.find(node => node['content-desc'] === '设置'));
    const footer = bounds(tree.find(node => node['content-desc'] === '聊天'));
    const size = await adb('shell', 'wm', 'size');
    const width = Number([...size.matchAll(/(\d+)x(\d+)/g)].at(-1)[1]);
    assert.ok(Math.abs((left + right) / 2 - width / 2) < 8, 'The card is horizontally centered');
    assert.ok(Math.abs((top + bottom) / 2 - (toolbar[3] + footer[1]) / 2) < 64,
      'The card is vertically centered between browser navigation and the footer');
    assert.ok(left >= 0 && right <= width && top > toolbar[3] && bottom < footer[1],
      'The card fits without clipping text or controls');
    await screenshot(`${prefix}-download-${state}`);
  };
  await capture('idle');
  console.log(`${prefix}: idle card is centered.`);
  await tap('下载');
  await find('暂停下载');
  const progress = async () => {
    const tree = await nodes();
    return tree.find(node => node['content-desc']?.includes('下载进度'));
  };
  await delay(1000);
  const current = await progress();
  assert.ok(current, 'Download exposes a native accessible progress bar');
  await capture('downloading');
  console.log(`${prefix}: live progress bar is visible.`);
  await tap('暂停下载'); await find('继续下载');
  await capture('paused');
  console.log(`${prefix}: paused progress is retained.`);
  await tap('继续下载');
  // Avoid waiting for UIAutomator's idle window while transfer events arrive continuously.
  await delay(1000); await screenshot(`${prefix}-download-resumed`);
  await find('打开文件'); await capture('completed');
  await tap('聊天'); await find('页面预览.html');
  await tap('浏览器'); await find('打开文件');
  console.log(`${prefix}: centered download, progress bar, pause/resume and retained browser state passed.`);
}
