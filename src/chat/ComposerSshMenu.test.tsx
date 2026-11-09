import React, { type ReactElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ComposerSshMenu } from './ComposerSshMenu';
import type { SshProfile } from '../../vendor/shared/terminal/sshProfiles';

const result = vi.hoisted(() => ({ items: [
  { id: 'dev', name: 'Development', host: 'dev.example.test', username: 'developer', port: 22,
    auth: 'key' as const, password: 'never-in-attachment', privateKey: 'never-in-attachment' },
  { id: 'prod', name: 'Production', host: '192.0.2.10', username: 'operator', port: 2222, auth: 'password' as const },
], loading: false, error: '' }));
const search = vi.hoisted(() => vi.fn());
vi.mock('../../vendor/shared/chat/useSshCandidates', () => ({
  useSshCandidates: (options: unknown) => { search(options); return result; },
}));
vi.mock('react-native', () => ({ FlatList: 'List', Pressable: 'Button', Text: 'Text', View: 'View',
  Platform: { OS: 'android' } }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: 'Icon' }));
vi.mock('../theme/styles', () => ({ createThemedStyles: () => () => ({}) }));
vi.mock('../theme/store', () => ({ useThemeColor: () => () => '#777' }));
vi.mock('../i18n', async original => ({ ...await original<typeof import('../i18n')>(), useLanguage() {} }));
beforeEach(() => { vi.stubGlobal('React', React); search.mockClear(); });
afterEach(() => vi.unstubAllGlobals());

function render(query: string, ready = true) {
  const choose = vi.fn();
  const profiles = { list: vi.fn(async () => result.items) };
  const tree = ComposerSshMenu({ query, ready, profiles, choose, close: vi.fn() });
  const list = tree.props.children[1] as ReactElement<{
    data: SshProfile[]; keyboardShouldPersistTaps: string;
    renderItem: (options: { item: SshProfile }) => ReactElement<{ onPress: () => void }>;
  }>;
  return { choose, profiles, list };
}

it('filters saved hosts by name, endpoint and username, retaining taps while the keyboard is open', () => {
  for (const query of ['development', 'dev.example', 'developer']) {
    const { list, profiles } = render(query);
    expect(list.props.data.map(item => item.id)).toEqual(['dev']);
    expect(list.props.keyboardShouldPersistTaps).toBe('always');
    expect(search).toHaveBeenLastCalledWith({ active: true, connected: true, profiles });
  }
  expect(render('missing').list.props.data).toEqual([]);
});

it('inserts only a host reference, excluding credentials and connection details', () => {
  const { choose, list } = render('dev');
  list.props.renderItem({ item: list.props.data[0] }).props.onPress();
  expect(choose).toHaveBeenCalledExactlyOnceWith({ kind: 'ssh', name: 'Development', path: 'ssh-profile://dev' });
});

it('hides stale host candidates when the connection becomes unavailable', () => {
  const { list, profiles } = render('', false);
  expect(list.props.data).toEqual([]);
  expect(search).toHaveBeenLastCalledWith({ active: true, connected: false, profiles });
});
