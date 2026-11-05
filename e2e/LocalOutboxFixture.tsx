import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChatComposer } from '../src/chat/ChatComposer';
import { ChatQuotesProvider } from '../src/chat/ChatQuotes';
import { createLocalOutboxFixture } from '../vendor/shared/remote-chat/testing/localOutboxFixture';
import { queueProps } from '../vendor/shared/remote-chat/client/queueProps';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';

setInterfaceLanguage('zh');
updateThemeMode('dark');
const fixture = createLocalOutboxFixture();
const { controller } = fixture;
function LocalOutboxFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...Feather.font });
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(() => { void fixture.start(); return () => controller.stop(); }, []);
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101513' }}>
      <View style={{ padding: 20, gap: 16, flex: 1 }}>
        <Text style={{ color: '#fff', ...textMetrics(20, 28) }}>消息发送</Text>
        <Text style={{ color: '#aeb9b3', ...textMetrics(14, 22) }}>正在检查项目。</Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="确认接收" onPress={fixture.accept}>
            <Text style={{ color: '#80d8bb', ...textMetrics(14, 22) }}>确认接收</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="模拟失败" onPress={fixture.fail}>
            <Text style={{ color: '#80d8bb', ...textMetrics(14, 22) }}>模拟失败</Text></Pressable>
        </View>
      </View>
      {fonts && <ChatQuotesProvider active enabled scope={state.draftScope ?? state.selected?.id ?? null}>
        <ChatComposer connection={{ client: controller.guiAccounts, deviceName: '测试电脑', chooseDevice: () => {} }}
          queue={queueProps(state, controller)} contextSettings={controller.contextSettings}
          readUsage={controller.readUsage} readConversationMetrics={controller.readConversationMetrics} usageActive={false}
          models={state.models} selection={state.settings} settingsBusy={state.settingsBusy} settingsError={state.settingsError}
          updateSettings={settings => controller.setSettings(settings)} refreshModels={controller.refreshModels}
          threadId={state.selected?.id ?? null} draftScope={state.draftScope} active ready={state.ready}
          sending={state.sending} running send={input => controller.enqueueMessage(input)}
          interrupt={() => controller.interrupt()} goals={controller.goals}
          catalog={{ skills: [], loaded: true, loading: false, error: '', refresh: () => {} }}
          cwd={state.selected?.cwd ?? ''} compactReason={null} compacting={false} compact={controller.compact}
          loadCatalog={controller.loadComposerCatalog} loadFiles={controller.loadProjectFiles}
          loadConversations={controller.searchThreads} />
      </ChatQuotesProvider>}
    </SafeAreaView>
  </SafeAreaProvider></GestureHandlerRootView>;
}
registerRootComponent(LocalOutboxFixture);
