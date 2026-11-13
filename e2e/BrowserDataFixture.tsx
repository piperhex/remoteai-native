import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { useNativeBrowser } from '../src/browser/context';
import { useBrowserData } from '../vendor/shared/browser/data/context';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { readBrowserDocument } from '../vendor/shared/browser/data/model';
import vaultFixture from './browser-data-vault.json';
import { BrowserLoginFixture } from './BrowserLoginFixture';

setInterfaceLanguage('zh');
updateThemeMode('light');
function FixtureFooter() {
  const browser = useNativeBrowser(), { store } = useBrowserData();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (store.snapshot().entries.length) { setReady(true); return; }
    const now = Date.now();
    for (const [index, title] of ['Remote AI 使用指南', '项目开发文档与常用工具', '网页测试页面', '昨天的浏览记录'].entries()) {
      store.visit({ id: `fixture-${index}`, kind: 'visit', title,
        url: `https://example.com/${index}`, at: now - (index === 3 ? 86400000 : index * 60000) });
    }
    const document = readBrowserDocument({ revision: 0, entries: vaultFixture.map(entry =>
      entry.kind === 'password' ? { ...entry, at: now } : entry) });
    if (!document) throw new Error('Invalid encrypted fixture');
    store.edit(Object.fromEntries(document.entries.map(entry => [entry.id, entry]))); setReady(true);
  }, [store]);
  return <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 8 }}>
    {ready && <Text style={textMetrics(12, 20)}>Ready</Text>}
    <Pressable accessibilityRole="button" onPress={() => browser.openResource({ url: 'https://browser-fixture.test/',
      title: 'Login test', render: ({ close }) => <BrowserLoginFixture close={close} /> })}>
      <Text style={textMetrics(14, 22)}>Login test</Text></Pressable>
    {['Light', 'Dark', 'Browser'].map((name, index) => <Pressable key={name} accessibilityRole="button"
      onPress={() => index === 2 ? browser.open() : updateThemeMode(index === 0 ? 'light' : 'dark')}>
      <Text style={textMetrics(14, 22)}>{name}</Text></Pressable>)}
  </View>;
}
function Fixture() {
  const [fonts] = useFonts(Ionicons.font), [active, setActive] = useState(true);
  return <SafeAreaProvider>{fonts && <NativeBrowserProvider scope="browser-data-fixture" active={active}
    onActiveChange={setActive} footer={<FixtureFooter />}><View /></NativeBrowserProvider>}</SafeAreaProvider>;
}
registerRootComponent(Fixture);
