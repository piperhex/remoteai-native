import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useCallback, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { DiscoveryPage } from '../src/discovery/DiscoveryPage';
import { BrowserBottomNavigation } from '../src/discovery/BrowserBottomNavigation';
import { updateThemeMode, useThemeColor } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';
import { ThemeStatusBar } from '../src/theme/ThemeStatusBar';

setInterfaceLanguage('zh');
function BottomNavigationFixture() {
  const [fonts] = useFonts(Ionicons.font);
  const [page, setPage] = useState('discover');
  const onBrowserActiveChange = useCallback((active: boolean) => {
    setPage(current => active ? 'browser' : current === 'browser' ? 'discover' : current);
  }, []);
  const color = useThemeColor();
  const canvas = { flex: 1, backgroundColor: color('#ededed', 'canvas') };
  if (!fonts) return null;
  return <SafeAreaProvider><ThemeStatusBar /><NativeBrowserProvider scope="bottom-navigation-fixture"
    active={page === 'browser'} onActiveChange={onBrowserActiveChange}
    footer={<BrowserBottomNavigation activePage={page} onChange={setPage} />}>
    <SafeAreaView style={canvas} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Light" onPress={() => updateThemeMode('light')} />
        <Button title="Dark" onPress={() => updateThemeMode('dark')} />
      </View>
      {page === 'discover' ? <DiscoveryPage onOpen={setPage} />
        : <View style={canvas}><Text style={{ ...textMetrics(18, 28), color: color('#181818', 'ink') }}>
          {t(page === 'accounts' ? 'client.app.accounts'
            : page === 'chat' ? 'client.app.chat' : 'client.app.settings')}
        </Text></View>}
    </SafeAreaView>
  </NativeBrowserProvider></SafeAreaProvider>;
}
registerRootComponent(BottomNavigationFixture);
