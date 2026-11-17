import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatController } from '../vendor/shared/remote-chat/client/controller';
import { createDirectoryFixture } from '../vendor/shared/testing/directoryFixture';
import { CliGuiProvider } from '../vendor/shared/cli-gui/context';
import { ChatThreads } from '../src/chat/ChatThreads';
import type { ChatController as NativeController } from '../src/chat/controller';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { textMetrics } from '../src/theme/text';
import { useThemeColor } from '../src/theme/store';
import { randomUUID } from 'expo-crypto';
import { nativeDirectoryStorage } from '../src/chat/offline/directory';

setInterfaceLanguage('zh');

function Fixture() {
  const color = useThemeColor();
  const fixture = useMemo(createDirectoryFixture, []);
  const [generation, setGeneration] = useState(0);
  const resumeStart = useRef(0);
  const controller = useMemo(() => {
    const value = new ChatController(events => ({ request: fixture.request,
      start() { fixture.listen(events.event); events.mode('direct'); events.ready(); }, stop() {} }));
    value.directoryStorage = nativeDirectoryStorage({ baseUrl: 'https://fixture.invalid',
      email: 'directory@example.test' }, 'fixture-device');
    return value;
  }, [fixture, generation]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [fontsReady] = useFonts(Feather.font);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  const resumed = generation > 0 && state.ready
    && fixture.metrics.slice(resumeStart.current).every(entry => entry.summaries === 0);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: color('#fff', 'canvas') }}>
    <View style={{ padding: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="fixture-rename"
      onPress={fixture.rename}><Text style={[textMetrics(14, 22), { color: color('#17211b', 'ink') }]}>
        目录同步测试数据 · 改名</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="fixture-reopen" onPress={() => {
        void controller.flushCache().then(() => {
          resumeStart.current = fixture.metrics.length; setGeneration(value => value + 1);
        });
      }}><Text style={[textMetrics(12, 18), { color: color('#17211b', 'ink') }]}>
        {resumed ? '缓存恢复已验证' : '测试从缓存恢复'}</Text></Pressable>
    </View>
    {fontsReady && <CliGuiProvider transport={controller.cliGui} createMessageId={randomUUID} enabled={state.ready}>
      <ChatThreads state={state} controller={controller as NativeController} newChat={() => {}}
        select={() => {}} openSearch={() => {}} profileMenu={null} />
    </CliGuiProvider>}
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(Fixture);
