import assert from 'node:assert/strict';

async function draft(options, text) {
  await options.tap('消息');
  await options.adb('shell', 'input', 'text', text);
  await options.tap('发送');
}

export async function verifyNativeModeratorOpening(options) {
  const { tap, find, nodes, screenshot, hideKeyboard, scale, broadcast, incoming, sent, assertEventually } = options;
  await tap('群聊');
  await tap('查看 bob 的资料'); await tap('发消息'); await find('在线');
  const before = sent.length;
  for (const text of ['Admin-first', 'Admin-second', 'Admin-third']) {
    await draft(options, text);
    await assertEventually(() => sent.at(-1)?.text === text && sent.at(-1)?.to === 'bob', 'Moderator send');
    await find(text);
  }
  assert.equal(sent.length, before + 3, 'No reply is required between moderator messages');
  await hideKeyboard();
  assert.ok(!(await nodes()).some(node => node.text === '对方回复后才能继续发送。'));
  await screenshot(`moderator-opening-${scale}`);
  broadcast({ type: 'policy', policy: { moderator: false, mutedUntil: null } });
  await draft(options, 'Retained-draft');
  await find('对方回复后才能继续发送。'); await find('Retained-draft');
  assert.equal(sent.length, before + 3, 'Revocation restores the opening limit');
  await hideKeyboard(); await screenshot(`moderator-revoked-${scale}`);
  broadcast({ type: 'policy', policy: { moderator: true, mutedUntil: null } });
  await tap('发送');
  await assertEventually(() => sent.length === before + 4 && sent.at(-1)?.text === 'Retained-draft', 'Promotion');
  broadcast({ type: 'policy', policy: { moderator: false, mutedUntil: null } });
  broadcast({ ...incoming('对方已回复，可以继续交流'), recipient: { id: 'alice', account: 'alice@example.test' },
    receipts: true });
  broadcast({ type: 'direct-permissions', states: { bob: 'open' }, generations: { bob: 0 } });
  await find('对方已回复，可以继续交流');
  await draft(options, 'After-reply');
  await assertEventually(() => sent.at(-1)?.text === 'After-reply', 'An actual reply opens the conversation');
  await hideKeyboard(); await screenshot(`moderator-after-reply-${scale}`);
  await tap('返回聊天列表'); await find('搜索聊天'); await tap('返回发现');
  console.log(`PASS native moderator opening, revocation, promotion and reply at font scale ${scale}`);
}
