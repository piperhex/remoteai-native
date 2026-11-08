import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import Feather from '@expo/vector-icons/Feather';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatThreads } from '../src/chat/ChatThreads';
import { ChatController } from '../src/chat/controller';
import { initialChatState } from '../src/chat/types';
import { textMetrics } from '../src/theme/text';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { activityThreads, completedActivityThreads } from '../vendor/shared/testing/threadActivityFixture';

setInterfaceLanguage('zh');
const controller = new ChatController({ baseUrl: 'http://127.0.0.1:1597', email: 'fixture@example.test',
  accessToken: 'test-only', refreshToken: 'test-only' }, 'fixture-computer');

function ThreadActivityFixture() {
  const [fonts] = useFonts(Feather.font);
  const [completed, setCompleted] = useState(false);
  const [custom, setCustom] = useState(false);
  const threads = completed ? completedActivityThreads() : activityThreads;
  const grouping = { groups: custom ? [{ id: 'custom', name: '自定义分组', parentId: null }] : [], projects: {},
    threads: custom ? Object.fromEntries(threads.map(thread => [thread.id, 'custom'])) : {} };
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f8f7' }}>
      <View style={{ flexDirection: 'row', padding: 12, gap: 20 }}>
        <Pressable accessibilityRole="button" onPress={() => setCompleted(true)}>
          <Text style={textMetrics(14, 22)}>完成对话</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setCustom(true)}>
          <Text style={textMetrics(14, 22)}>切换自定义分组</Text></Pressable>
      </View>
      {fonts && <ChatThreads state={{ ...initialChatState(), ready: true, threads,
        sidebar: { revision: 1, threads: {}, readState: {}, grouping } }} controller={controller}
        newChat={() => {}} openSearch={() => {}} select={() => {}} profileMenu={null} />}
    </SafeAreaView>
  </SafeAreaProvider></GestureHandlerRootView>;
}

registerRootComponent(ThreadActivityFixture);
