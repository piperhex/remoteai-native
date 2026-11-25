import assert from 'node:assert/strict';

export async function verifyImageDelivery({ broadcast, incoming, deliveryFrames, scale, tap, find,
  screenshot, assertEventually }) {
  const self = { id: 'alice', account: 'alice@example.test' };
  const peer = { id: 'bob', account: 'bob@example.test' };
  const file = { name: 'photo.png', device: crypto.randomUUID(), id: crypto.randomUUID(),
    mime: 'image/png', kind: 'image', size: 8192, grant: 'fixture' };
  const message = { ...incoming('照片'), recipient: self, receipts: true, attachments: [file] };
  broadcast(message);
  await tap('与 bob 私聊');
  await find('暂时无法接收，请确认发送方在线后重试。');
  await assertEventually(() => deliveryFrames.some(f => f.id === message.id && f.type === 'image-pending'),
    'Message was saved before the image could be received');
  assert.ok(!deliveryFrames.some(f => f.id === message.id && f.type === 'receipt'));
  await screenshot(`image-unavailable-${scale}`);
  const outgoing = { ...message, sender: self, recipient: peer, id: crypto.randomUUID(), text: '照片副本' };
  broadcast(outgoing);
  await find('照片副本');
  broadcast({ type: 'image-pending', from: peer.id, to: self.id, id: outgoing.id, status: 'delivered' });
  await find('对方已收到'); await find('等待对方接收');
  await screenshot(`image-pending-${scale}`);
  broadcast({ type: 'receipt', from: peer.id, to: self.id, id: outgoing.id, status: 'read' });
  await find('对方已阅读');
  await screenshot(`image-read-${scale}`);
}
