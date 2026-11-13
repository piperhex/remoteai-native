import assert from 'node:assert/strict';

export async function verifyBrowserTabClosing({ adb, find, tap, nodes, screenshot, visit, back, activity }) {
  const home = async () => {
    await find('在上方搜索或输入网址，也可以从这里打开常用链接。');
    await find('管理标签页（1）');
    const entries = await nodes();
    assert.ok(!entries.some(node => node['content-desc'] === '搜索标签页'), 'The manager must close automatically');
    const address = (await find('访问地址')).text;
    assert.ok(!address || address === '搜索或输入网址');
  };
  for (const [scale, theme] of [['1.0', 'Light'], ['1.3', 'Dark']]) {
    await tap('Return to fixture');
    await adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    await tap(theme); await tap('浏览器');
    const prefix = `android-${theme.toLowerCase()}-font-${scale}`;
    await tap('管理标签页（1）'); await find('搜索标签页');
    const add = (await find('新标签页')).bounds.match(/\d+/g).map(Number);
    const menu = (await find('更多操作')).bounds.match(/\d+/g).map(Number);
    assert.ok(menu[0] >= add[2], 'More actions must follow the add button');
    await screenshot(`${prefix}-last-tab`);
    await tap('关闭 新标签页'); await home();
    await screenshot(`${prefix}-last-tab-home`);
    await visit('one'); await tap('新标签页'); await visit('two'); await tap('新标签页'); await visit('three');
    await tap('管理标签页（3）'); await tap('关闭 Page one'); await find('搜索标签页');
    await tap('更多操作'); await find('关闭全部标签页'); await screenshot(`${prefix}-close-all-menu`);
    await back(); await find('搜索标签页');
    await tap('搜索标签页'); await adb('shell', 'input', 'text', 'missing');
    await find('没有匹配的标签页'); await tap('更多操作'); await tap('关闭全部标签页'); await home();
    await screenshot(`${prefix}-close-all-home`);
    await tap('管理标签页（1）'); await tap('更多操作'); await tap('关闭全部标签页'); await home();
    await adb('shell', 'am', 'start', '-W', '-S', '-n', activity);
    await tap('浏览器'); await home();
    console.log(`${prefix}: close last, keep other tabs, dismiss menu, close hidden tabs and persist homepage passed.`);
  }
}
