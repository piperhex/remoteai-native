import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

async function send(options, text) {
  await options.tap('消息'); await options.adb('shell', 'input', 'text', text); await options.tap('发送');
  await options.assertEventually(() => options.sent.at(-1)?.text === text, 'Group send');
  await options.hideKeyboard();
}

async function verifyReaders(options) {
  const { tap, find, screenshot, scale, broadcast, sent, restart } = options;
  await send(options, 'Admin-group-announcement');
  await find('0 人已读');
  const id = sent.at(-1).id;
  for (const reader of [{ id: 'bob', account: 'bob', nickname: '小波' },
    { id: 'bob', account: 'bob', nickname: '小波' }, { id: 'carol', account: 'carol', nickname: '小陈' }]) {
    broadcast({ type: 'group-read', id, from: reader.id, to: 'alice', reader, groupReceipt: `fixture-group-${id}` });
  }
  await find('2 人已读'); await screenshot(`group-read-count-${scale}`);
  await tap('2 人已读'); await find('已读成员'); await find('小波'); await find('小陈');
  await screenshot(`group-read-members-${scale}`);
  broadcast({ type: 'policy', policy: { moderator: false, mutedUntil: null } });
  await find('消息');
  assert.ok(!(await options.nodes()).some(node => node.text === '2 人已读'), 'Revocation hides the administrator action');
  broadcast({ type: 'policy', policy: { moderator: true, mutedUntil: null } });
  await find('2 人已读');
  assert.ok(!(await options.nodes()).some(node => node.text === '已读成员'), 'Promotion does not reopen the list');
  await restart(); await find('2 人已读'); await tap('2 人已读'); await find('小波'); await find('小陈');
  await screenshot(`group-read-restored-${scale}`); await tap('取消');
}

async function verifyOrdinaryReader(options) {
  const { tap, find, nodes, broadcast, incoming, groupReadFrames, assertEventually, screenshot, scale } = options;
  broadcast({ type: 'policy', policy: { moderator: false, mutedUntil: null } });
  await send(options, 'Ordinary-group-message');
  assert.ok(!(await nodes()).some(node => /\d+ 人已读/.test(node.text)), 'Ordinary authors have no read counter');
  await tap('返回聊天列表'); await find('搜索聊天');
  const message = { ...incoming('看到通知后才会上报已读'), id: `visible-${scale}`,
    sender: { id: 'manager', account: 'manager', moderator: true }, groupReceipt: `incoming-group-${scale}` };
  broadcast(message);
  await delay(650);
  assert.ok(!groupReadFrames.some(frame => frame.type === 'group-read' && frame.id === message.id),
    'The hidden group conversation cannot generate a read receipt');
  await tap('群聊'); await find('看到通知后才会上报已读');
  await assertEventually(() => groupReadFrames.some(frame => frame.type === 'group-read' && frame.id === message.id),
    'The visible administrator message generates an actual read receipt');
  assert.ok(!(await nodes()).some(node => /\d+ 人已读/.test(node.text)), 'Readers cannot open the administrator list');
  await screenshot(`group-read-ordinary-${scale}`);
  await tap('返回聊天列表'); await tap('返回发现');
}

export async function verifyNativeGroupReads(options) {
  await options.tap('群聊');
  await verifyReaders(options);
  await verifyOrdinaryReader(options);
  console.log(`PASS native administrator group counts, reader names, persistence and visibility at font scale ${options.scale}`);
}
