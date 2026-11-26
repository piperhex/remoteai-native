import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const bounds = node => node.bounds.match(/-?\d+/g).map(Number);
const center = ([left, top, right, bottom]) => ({ x: (left + right) / 2, y: (top + bottom) / 2 });
const named = (nodes, label) => nodes.find(node => node['content-desc'] === label);
const selectedTab = '(await import("./ui/legacy/legacy.js")).InspectorView.InspectorView.instance()'
  + '.tabbedPane.selectedTabId';
const pixels = values => values.map(value => String(Math.round(value)));

async function movePointer({ adb, nodes, tap }, { density, width, height }, destination) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const tree = await nodes();
    const button = named(tree, '鼠标左键');
    if (!button && named(tree, '展开鼠标面板')) { await tap('展开鼠标面板'); continue; }
    assert.ok(button, 'The mouse panel is present above the inspector');
    const [left, top] = bounds(button);
    // The arrow is 24 dp to the left of the panel, which has a 2 dp border.
    const cursor = { x: left - 26 * density, y: top - 2 * density };
    const target = destination(tree);
    const dx = target.x - cursor.x, dy = target.y - cursor.y;
    if (Math.abs(dx) <= 3 * density && Math.abs(dy) <= 3 * density) return;
    const grip = center(bounds(named(tree, '拖动鼠标面板')));
    const end = { x: Math.max(5, Math.min(width - 5, grip.x + dx)),
      y: Math.max(5, Math.min(height - 5, grip.y + dy)) };
    await adb('shell', 'input', 'swipe', ...pixels([grip.x, grip.y, end.x, end.y]), '280');
  }
  assert.fail('The pointer reaches the requested control across the dock divider');
}

export async function frontendPoint(frontend, selector) {
  return frontend.evaluate(`(() => {
    const roots = [document];
    for (const root of roots) for (const node of root.querySelectorAll('*')) {
      if (node.shadowRoot) roots.push(node.shadowRoot);
      if (!node.matches(${JSON.stringify(selector)})) continue;
      const r = node.getBoundingClientRect();
      if (r.width) return { x: (r.x + r.width/2)*devicePixelRatio, y: (r.y + r.height/2)*devicePixelRatio };
    }
  })()`);
}

async function verifyBottomDock({ adb, tap, screenshot, tapFrontend, typeConsoleNumber }, frontend, move) {
  const clickFrontend = async selector => {
    const point = await frontendPoint(frontend, selector);
    assert.ok(point, `Visible DevTools control: ${selector}`);
    await move(tree => ({ x: point.x, y: bounds(named(tree, '关闭'))[3] + point.y }));
    await tap('鼠标左键'); await delay(300);
  };
  await clickFrontend('#tab-console');
  assert.equal(await frontend.evaluate(selectedTab), 'console', 'The panel clicks the docked Console tab');
  await screenshot('mouse-bottom-console');
  await clickFrontend('#console-prompt');
  assert.ok((await adb('shell', 'dumpsys', 'input_method')).includes('mInputShown=true'),
    'Clicking Console opens the keyboard');
  await screenshot('mouse-console-keyboard');
  await typeConsoleNumber(29);
  await tapFrontend('#tab-elements');
  assert.equal(await frontend.evaluate(selectedTab), 'elements', 'Direct touch beside the panel still reaches DevTools');
}

async function verifyRightDock({ adb, tap, screenshot, find }, frontend, move, density) {
  await tap('停靠在右侧');
  await frontend.evaluate(`window.dockMouseEvents = [];
    for (const type of ['click','wheel']) addEventListener(type, () => dockMouseEvents.push(type), true); true`);
  await move(tree => {
    const [, top, right] = bounds(named(tree, '调整开发者工具大小'));
    return { x: right + 38 * density, y: top + 205 * density };
  });
  await tap('鼠标左键'); await delay(200);
  assert.deepEqual(await frontend.evaluate('dockMouseEvents'), ['click'], 'One click reaches the right-docked frontend');
  await screenshot('mouse-right-elements');
  const wheel = center(bounds(await find('按住并拖动以滚动')));
  await adb('shell', 'input', 'swipe', ...pixels([wheel.x, wheel.y, wheel.x, wheel.y + 100]), '450');
  assert.ok(await frontend.evaluate('dockMouseEvents.includes("wheel")'));
}

export async function verifyInspectorMouse(controls, frontend) {
  const { adb, tap, pageValue } = controls;
  const density = Number((await adb('shell', 'wm', 'density')).match(/\d+/g).at(-1)) / 160;
  const [width, height] = (await adb('shell', 'wm', 'size')).match(/\d+x\d+/g).at(-1).split('x').map(Number);
  const move = destination => movePointer(controls, { density, width, height }, destination);
  const clearMargin = () => move(() => ({ x: 36 * density, y: 118 * density }));
  await tap('停靠在底部'); await tap('设置'); await tap('鼠标操作');
  await verifyBottomDock(controls, frontend, move);
  await clearMargin();
  await verifyRightDock(controls, frontend, move, density);
  await clearMargin();
  await tap('停靠在底部');
  await pageValue('window.mousePageClicks=0; document.querySelector("button").addEventListener("click",'
    + '()=>window.mousePageClicks++,{once:true})');
  await move(tree => center(bounds(tree.find(node => node.text === 'Fetch data') ?? named(tree, 'Fetch data'))));
  await tap('鼠标左键');
  assert.equal(await pageValue('window.mousePageClicks'), 1, 'The same pointer returns to the inspected page');
  await tap('设置'); await tap('鼠标操作');
}
