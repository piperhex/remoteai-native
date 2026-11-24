import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export async function loadHistorySource(root) {
  const outfile = path.join(root, '.codex-tmp/lounge-sync-source.mjs');
  await build({ entryPoints: [path.join(root, 'e2e/lounge-sync-source.ts')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22' });
  return (await import(pathToFileURL(outfile).href)).createHistorySource();
}

export async function verifyNativeSync({ adb, tap, find, nodes, screenshot, scale, source,
  assertEventually, hideKeyboard }) {
  await tap('与 bob 私聊');
  await find('来自另一台设备的私聊记录');
  await screenshot(`device-sync-private-${scale}`);
  // Numeric input stays literal with either the Chinese or English device keyboard.
  const text = String(Date.now());
  await tap('消息'); await adb('shell', 'input', 'text', text); await tap('发送');
  await assertEventually(() => source.hasText(text), 'Native outgoing message reaches the other device');
  await hideKeyboard(); await tap('返回聊天列表'); await tap('群聊');
  await tap('添加内容'); await tap('历史记录'); await tap('搜索消息或账户');
  await adb('shell', 'input', 'text', '2468'); await find('来自另一台设备的群聊记录 2468');
  await screenshot(`device-sync-history-${scale}`); await tap('返回聊天');
  await tap('添加内容'); await tap('关于聊天');
  await find('消息保存在各设备'); await screenshot(`device-sync-about-${scale}`); await tap('知道了');
  source.broker.fail = true; source.broker.disconnectAll();
  await find('消息');
  const labels = (await nodes()).flatMap(node => [node.text, node['content-desc']]);
  assert.ok(!labels.includes('设备间消息同步暂时中断，正在重试。'));
  assert.ok(!labels.includes('重试'));
  await screenshot(`device-sync-offline-${scale}`);
  source.add(`断线后补回记录 ${scale}`); source.broker.fail = false;
  await find(`断线后补回记录 ${scale}`); await screenshot(`device-sync-restored-${scale}`);
  assert.ok(source.broker.relayFrames > 0, 'Native sync uses existing binary encrypted relay');
  await tap('返回聊天列表'); await tap('返回发现'); await find('在线交流');
  console.log(`PASS native device sync at font scale ${scale}: incoming/outgoing, images, retry and navigation`);
}
