import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Platform, Pressable } from 'react-native';
import { DeviceOptionsMenu } from './DeviceOptionsMenu';
import { RemoteModelSwitchContent } from './RemoteModelSwitchContent';
import type { RemoteDevice } from '../types';
import type { ScreenPowerReading } from '../../vendor/shared/remote-desktop/screenControl';

type MenuPage = 'actions' | 'model' | 'confirmScreen' | 'openingDesktop';
const runtime = vi.hoisted(() => ({ page: 'actions' as MenuPage, reading: 'on' as ScreenPowerReading }));
vi.mock('../../vendor/shared/remote-desktop/useScreenPowerStatus', async () => {
  const { screenPowerAction } = await import('../../vendor/shared/remote-desktop/screenControl');
  return { useScreenPowerStatus: (device: RemoteDevice) => screenPowerAction(device, runtime.reading) };
});
vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'),
  useState: () => [runtime.page, (page: MenuPage) => { runtime.page = page; }],
  useEffect: vi.fn(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'android' },
  ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: <T,>(value: T) => value, absoluteFill: {} } }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: 'BottomSheet' }));
vi.mock('../components/SheetScrollView', () => ({ SheetScrollView: 'SheetScrollView', SHEET_READABLE_WIDTH: 440 }));

interface Props { children?: ReactNode; disabled?: boolean; onPress?: () => void }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
function button(tree: ReactNode, label: string) {
  return nodes(tree).find(node => node.type === Pressable
    && nodes(node.props.children).some(child => child.props.children === label));
}
const device: RemoteDevice = { deviceId: 'pc', name: '工作电脑', platform: 'Windows', online: true,
  capabilities: ['screen-power', 'screen-power-status'], localProxyRunning: false, lastSeenAt: '2026-10-23T00:00:00Z' };
const props = { device, deletingDeviceId: null, switchingAuthDeviceId: null, accounts: [], providers: [],
  modelSwitch: { switchingAccountId: null, switchingProvider: null, onSwitchAccount: vi.fn(),
    onSwitchProvider: vi.fn(), onSwitchProviderGroup: vi.fn() },
  onClose: vi.fn(), onOpenDesktop: vi.fn(), onDelete: vi.fn(), onRevokeService: vi.fn(), onSelectAuthAccount: vi.fn(),
  screenControl: { change: vi.fn(), read: vi.fn() } };
beforeEach(() => {
  vi.clearAllMocks(); runtime.page = 'actions'; runtime.reading = 'on'; vi.stubGlobal('React', React);
});

it('opens the selected online desktop and disables the shortcut offline', () => {
  button(DeviceOptionsMenu(props), '远程桌面')!.props.onPress!();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onOpenDesktop).toHaveBeenCalledExactlyOnceWith(device.deviceId);
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(button(offline, '远程桌面')!.props.disabled).toBe(true);
});

it('waits for the iOS menu to dismiss before presenting the desktop', () => {
  const platform = Platform.OS;
  try {
    Platform.OS = 'ios';
    button(DeviceOptionsMenu(props), '远程桌面')!.props.onPress!();
    const sheet = DeviceOptionsMenu(props);
    expect(sheet.props.visible).toBe(false);
    expect(props.onOpenDesktop).not.toHaveBeenCalled();
    sheet.props.onDismiss();
    expect(props.onOpenDesktop).toHaveBeenCalledExactlyOnceWith(device.deviceId);
  } finally {
    Platform.OS = platform;
  }
});

it('opens model selection for the same device and returns to the actions', () => {
  button(DeviceOptionsMenu(props), '切换模型')!.props.onPress!();
  const sheet = DeviceOptionsMenu(props);
  expect(sheet.props.title).toBe('切换模型');
  expect(sheet.props.children.type).toBe(RemoteModelSwitchContent);
  expect(sheet.props.children.props.device).toBe(device);
  sheet.props.onBack();
  expect(DeviceOptionsMenu(props).props.title).toBe(device.name);
  expect(props.onClose).not.toHaveBeenCalled();
});

it('disables switching on offline devices and while a switch is pending', () => {
  expect(button(DeviceOptionsMenu({ ...props, device: { ...device, online: false } }), '切换模型')!
    .props.disabled).toBe(true);
  const modelSwitch = { ...props.modelSwitch, switchingProvider: { deviceId: device.deviceId, providerId: 'provider' } };
  expect(button(DeviceOptionsMenu({ ...props, modelSwitch }), '切换模型')!.props.disabled).toBe(true);
});

it('confirms shutdown in a drawer with one action and closes without sending a command', () => {
  const menu = DeviceOptionsMenu(props);
  expect(button(menu, '恢复电脑屏幕')).toBeUndefined();
  button(menu, '关闭电脑屏幕')!.props.onPress!();
  expect(runtime.page).toBe('confirmScreen');
  expect(props.screenControl.change).not.toHaveBeenCalled();
  const confirmation = DeviceOptionsMenu(props);
  expect(confirmation!.props.maxWidth).toBe(440);
  expect(confirmation!.props.title).toBe('暂时关闭电脑屏幕？');
  expect(confirmation!.props.subtitle).toBe(device.name);
  expect(button(confirmation, '取消')).toBeUndefined();
  expect(confirmation!.props.actions).toHaveLength(1);
  confirmation!.props.onClose();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.screenControl.change).not.toHaveBeenCalled();
});

it('confirms screen shutdown for the selected computer and disables confirmation when offline', () => {
  runtime.page = 'confirmScreen';
  const confirmation = DeviceOptionsMenu(props);
  confirmation!.props.actions[0].onPress();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.screenControl.change).toHaveBeenCalledExactlyOnceWith(device, true);
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(offline!.props.actions[0].disabled).toBe(true);
});

it('restores screens without a shutdown confirmation', () => {
  runtime.reading = 'off';
  const menu = DeviceOptionsMenu(props);
  expect(button(menu, '关闭电脑屏幕')).toBeUndefined();
  button(menu, '恢复电脑屏幕')!.props.onPress!();
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.screenControl.change).toHaveBeenCalledExactlyOnceWith(device, false);
});

it('shows one disabled display row until the screen status is available', () => {
  runtime.reading = undefined;
  expect(button(DeviceOptionsMenu(props), '显示器')!.props.disabled).toBe(true);
  const offline = DeviceOptionsMenu({ ...props, device: { ...device, online: false } });
  expect(button(offline, '显示器')!.props.disabled).toBe(true);
  for (const platform of ['macOS', 'linux']) {
    const menu = DeviceOptionsMenu({ ...props, device: { ...device, platform } });
    expect(button(menu, '显示器')).toBeUndefined();
  }
});
