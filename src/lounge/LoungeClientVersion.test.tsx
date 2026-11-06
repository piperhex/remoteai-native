import * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoungeClientVersion } from './LoungeClientVersion';
import type { LoungeAccount } from '../../vendor/shared/lounge/types';

vi.mock('@expo/vector-icons/Feather', () => ({ default: 'DeviceIcon' }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Platform: { OS: 'android' },
  StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('../theme/store', () => ({ useThemeMode: () => 'dark' }));

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

function icons(node: React.ReactNode): React.ReactElement<{ color: string }>[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return [];
    if (String(child.type) === 'DeviceIcon') return [child as React.ReactElement<{ color: string }>];
    return icons(child.props.children);
  });
}

const user: LoungeAccount = { id: 'bob', account: 'bob', clients: [
  { version: '2.2.7', platform: 'desktop' }, { version: '1.5.3', platform: 'mobile' },
] };

it('lights the connected device icons while retaining muted version text', () => {
  const online = LoungeClientVersion({ user, online: true })!;
  expect(icons(online).map(icon => icon.props.color)).toEqual(['#22c55e', '#22c55e']);
  expect(online.props.accessibilityHint).toBe('在线');
  const offline = LoungeClientVersion({ user })!;
  expect(icons(offline).map(icon => icon.props.color)).toEqual(['#a0adb5', '#a0adb5']);
  expect(offline.props.accessibilityHint).toBeUndefined();
});

it('keeps legacy versions readable without inventing a device', () => {
  const legacy = LoungeClientVersion({ user: { id: 'old', account: 'old', clientVersions: ['2.2.7'] } })!;
  expect(icons(legacy)).toHaveLength(0);
  expect(legacy.props.accessibilityLabel).toBe('v2.2.7');
  expect(LoungeClientVersion({ user: { id: 'offline', account: 'offline', clients: [] } })).toBeNull();
});
