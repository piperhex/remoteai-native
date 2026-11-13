import assert from 'node:assert/strict';

const bounds = node => node.bounds.match(/\d+/g).map(Number);
const hasExit = entries => entries.some(node => (node['content-desc'] || node.text) === '退出全屏');

export async function verifyBrowserFullscreen({ adb, find, tap, nodes, screenshot, prefix }) {
  await find('更多操作');
  assert.ok(!hasExit(await nodes()), 'Exit text must stay inside the closed menu');
  await screenshot(`${prefix}-fullscreen-circle`);
  const before = bounds(await find('更多操作'));
  const [width, height] = [...(await adb('shell', 'wm', 'size')).matchAll(/(\d+)x(\d+)/g)]
    .at(-1).slice(1).map(Number);
  const drag = async (x, y) => {
    const [left, top, right, bottom] = bounds(await find('更多操作'));
    await adb('shell', 'input', 'swipe', String((left + right) >> 1), String((top + bottom) >> 1),
      String(x), String(y), '650');
    assert.ok(!hasExit(await nodes()), 'Dragging must not open the menu');
  };
  await drag(Math.round(width * 0.25), Math.round(height * 0.5));
  assert.ok(bounds(await find('更多操作'))[1] > before[1] + 100, 'Control must move with the drag');
  await tap('更多操作'); await find('退出全屏');
  await screenshot(`${prefix}-fullscreen-dragged-menu`);
  await adb('shell', 'input', 'keyevent', '4');
  await find('更多操作'); assert.ok(!hasExit(await nodes()), 'Back closes the menu first');
  await tap('更多操作'); await find('退出全屏');
  await adb('shell', 'input', 'tap', String(Math.round(width * 0.75)), String(Math.round(height * 0.7)));
  assert.ok(!hasExit(await nodes()), 'Outside tap closes the menu');
  await drag(width - 4, height - 120);
  const moved = bounds(await find('更多操作'));
  assert.ok(moved[0] >= 0 && moved[1] >= 0 && moved[2] < width && moved[3] < height);
  await tap('更多操作');
  const menu = bounds(await find('退出全屏'));
  assert.ok(menu[0] >= 0 && menu[1] >= 0 && menu[2] <= width && menu[3] < height);
  await screenshot(`${prefix}-fullscreen-edge-menu`);
  await tap('退出全屏'); await find('访问地址');
}
