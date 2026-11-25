import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ChatTools } from '../src/chat/ChatTools';
import { RemoteDesktopWindowHost } from '../src/chat/desktop/RemoteDesktopWindow';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { createToolWindowsClient } from './toolWindowsClient';
import { DeviceManagementList } from '../src/devices/DeviceManagementList';
import { useDeviceScreenControl } from '../vendor/shared/remote-desktop/useDeviceScreenControl';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';
import { parseDeviceStatusSocketMessage } from '../src/realtime/deviceStatus';
import type { RemoteDevice } from '../src/types';
import type { ScreenPowerState } from '../vendor/shared/remote-desktop/screenControl';

const reportedDevices: RemoteDevice[] = [{ deviceId: 'computer', name: '工作电脑', platform: 'Windows', online: true,
  capabilities: ['screen-power', 'screen-power-status'], localProxyRunning: false, lastSeenAt: '2026-10-23T00:00:00Z' }];
const snapshot = parseDeviceStatusSocketMessage(JSON.stringify({ type: 'devices-snapshot', devices: reportedDevices }));
if (snapshot?.type !== 'devices-snapshot') throw new Error('Invalid device screen fixture');
const devices = snapshot.devices;
setInterfaceLanguage('zh');
const client = createToolWindowsClient();

function DeviceScreenFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
  const [desktopDeviceId, setDesktopDeviceId] = useState<string>();
  const [result, setResult] = useState('');
  const state = useRef<ScreenPowerState>('on');
  const read = useCallback(async () => state.current, []);
  const change = useDeviceScreenControl({ scope: 'fixture', request: async (_path, init) => {
    state.current = init.body === '{"action":"off"}' ? 'off' : 'on';
  },
    notify: key => setResult(t(key)) });
  return <SafeAreaProvider><RemoteDesktopWindowHost><SafeAreaView style={{ flex: 1 }}>
    <Text style={textMetrics(14, 22)}>{result}</Text>
    {fonts && <View style={{ display: 'none' }}>
      <NativeBrowserProvider scope="device-screen-fixture">
        <ChatTools client={client} cwd="" scope="device-screen-fixture" active={false} connected
          closeDeviceDesktop={desktopDeviceId === 'computer' ? () => setDesktopDeviceId(undefined) : undefined} />
      </NativeBrowserProvider>
    </View>}
    {fonts && <DeviceManagementList devices={devices} accounts={[]} providers={[]} refreshing={false}
      onBack={() => {}} onOpenDesktop={setDesktopDeviceId}
      deletingDeviceId={null} switchingAuthDeviceId={null}
      modelSwitch={{ switchingAccountId: null, switchingProvider: null, onSwitchAccount: async () => false,
        onSwitchProvider: async () => false, onSwitchProviderGroup: async () => false }}
      onRefresh={async () => {}} onSelectAuthAccount={() => {}}
      onDelete={() => {}} onRevokeService={() => {}} screenControl={{ change, read }} />}
  </SafeAreaView></RemoteDesktopWindowHost></SafeAreaProvider>;
}

registerRootComponent(DeviceScreenFixture);
