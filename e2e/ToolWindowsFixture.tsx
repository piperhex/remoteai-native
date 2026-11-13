import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatTools } from '../src/chat/ChatTools';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { ChatFileReferencesProvider } from '../vendor/shared/chat/ChatFileReferences';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { browserRoot } from '../vendor/apps/desktop/e2e/project-browser-fixture';
import { textMetrics } from '../src/theme/text';
import { updateThemeMode, useThemeColor } from '../src/theme/store';
import { ThemeStatusBar } from '../src/theme/ThemeStatusBar';
import { createToolWindowsClient } from './toolWindowsClient';

setInterfaceLanguage('zh');
const client = createToolWindowsClient();

function ToolWindowsFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
  const [active, setActive] = useState(true);
  const color = useThemeColor();
  return <SafeAreaProvider><ChatFileReferencesProvider><NativeBrowserProvider scope="tool-windows-fixture">
    <ThemeStatusBar /><SafeAreaView style={{ flex: 1, backgroundColor: color('#fff', 'canvas') }}>
      <ChatOverlay>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <Text style={{ flex: 1, color: color('#10251d', 'ink'), ...textMetrics(16, 24) }}>Tools fixture</Text>
          {fonts && <ChatTools client={client} cwd={browserRoot} scope="tool-windows-fixture"
            active={active} connected deviceName="Fixture PC" />}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Button title="Light" onPress={() => updateThemeMode('light')} />
          <Button title="Dark" onPress={() => updateThemeMode('dark')} />
          <Button title="Chat" onPress={() => setActive(true)} />
          <Button title="Accounts" onPress={() => setActive(false)} />
        </View>
      </ChatOverlay>
    </SafeAreaView>
  </NativeBrowserProvider></ChatFileReferencesProvider></SafeAreaProvider>;
}
registerRootComponent(ToolWindowsFixture);
