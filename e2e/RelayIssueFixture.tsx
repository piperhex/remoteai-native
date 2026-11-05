import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatPage } from '../src/chat/ChatPage';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';
import { activateSession, sessionEpoch } from '../src/api/sessionStore';
import type { AuthSession, RemoteDevice } from '../src/types';

setInterfaceLanguage('zh');
updateThemeMode('dark');
const session: AuthSession = { baseUrl: 'http://127.0.0.1:1490', email: 'mobile-test@example.test',
  accessToken: 'local-test-token', refreshToken: 'local-test-refresh' };
const devices: RemoteDevice[] = [{ deviceId: 'computer', name: '测试电脑', platform: 'Windows', online: true,
  localProxyRunning: false, capabilities: [], lastSeenAt: '2026-11-05T00:00:00Z' }];

function RelayIssueFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...Feather.font });
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    void activateSession(session, sessionEpoch()).then(() => setAuthenticated(true)).catch(console.error);
  }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101513' }}>
      {fonts && authenticated && <ChatPage session={session} devices={devices} devicesLoaded active
        notification={null} notificationError="" notificationHandled={() => {}}
        tokenSummary={false} closeTokenSummary={() => {}} />}
    </SafeAreaView>
  </SafeAreaProvider></GestureHandlerRootView>;
}

registerRootComponent(RelayIssueFixture);
