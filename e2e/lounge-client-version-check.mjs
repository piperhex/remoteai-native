import assert from 'node:assert/strict';

export async function verifyNativeClientVersions({ tap, find, nodes, screenshot, longPress, scale, broadcast, incoming }) {
  const versions = clients => broadcast({ type: 'client-versions',
    users: [{ id: 'bob', clientVersions: clients.map(client => client.version), clients }] });
  const nickname = scale > 1 ? '这是一位名字很长的联系人' : 'Jia';
  const profile = `查看 ${nickname} 的资料`;
  await tap('群聊');
  const message = incoming('群聊版本测试');
  broadcast({ ...message, sender: { ...message.sender, nickname } });
  await find('群聊版本测试');
  await longPress('群聊版本测试');
  await find('个人资料');
  await screenshot(`versions-group-menu-${scale}`);
  await tap('个人资料');
  assert.ok(!(await nodes()).some(node => node.text?.includes('v2.2.7')));
  versions([{ version: '2.2.7', platform: 'desktop' }, { version: '1.5.3', platform: 'mobile' },
    { version: '2.2.7', platform: 'desktop' }]);
  await find('当前版本 v2.2.7 · v1.5.3');
  await screenshot(`versions-profile-${scale}`);
  await tap('返回');
  await find('群聊版本测试');
  await tap(profile);
  await find('当前版本 v2.2.7 · v1.5.3');
  await tap('发消息');
  await find('v2.2.7 · v1.5.3');
  assert.ok(!(await nodes()).some(node => node.text === '在线'), 'Device icons replace the separate status row');
  await screenshot(`versions-private-${scale}`);
  versions([{ version: '1.5.3', platform: 'mobile' }]);
  await find('v1.5.3');
  await screenshot(`versions-phone-online-${scale}`);
  broadcast({ type: 'contacts', contacts: [{ id: 'bob', online: false }] });
  versions([]);
  await find('离线');
  await screenshot(`versions-offline-${scale}`);
  broadcast({ type: 'contacts', contacts: [{ id: 'bob', online: true }] });
  versions([{ version: '2.2.7' }]);
  await find('在线');
  await screenshot(`versions-legacy-online-${scale}`);
  versions([{ version: '2.2.8', platform: 'desktop' }]);
  await find('v2.2.8');
  assert.ok(!(await nodes()).some(node => node.text === '在线'));
  await screenshot(`versions-desktop-online-${scale}`);
  await tap(profile);
  await find('当前版本 v2.2.8');
  await screenshot(`versions-profile-updated-${scale}`);
  versions([]);
  assert.ok(!(await nodes()).some(node => node.text?.includes('v2.2.8')));
  await tap('返回');
  await tap('返回聊天列表');
  await find('搜索聊天');
  console.log(`PASS native peer versions, live updates, group profile and navigation at font scale ${scale}`);
}
