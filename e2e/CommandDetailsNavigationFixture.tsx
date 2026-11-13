import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatDrawer, type ChatDrawerMethods } from '../src/chat/ChatDrawer';
import { ChatDrawerSurface } from '../src/chat/ChatDrawerSurface';
import { ChatMessages } from '../src/chat/ChatMessages';
import { ChatQuotesProvider } from '../src/chat/ChatQuotes';
import { useChatDrawerSwipe } from '../src/chat/useChatDrawerSwipe';
import { PrimaryPagePager } from '../src/navigation/PrimaryPagePager';
import { PRIMARY_PAGES } from '../vendor/shared/navigation/pageSwipe';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { textMetrics } from '../src/theme/text';
import { updateThemeMode, useThemeColor } from '../src/theme/store';
import { ThemeStatusBar } from '../src/theme/ThemeStatusBar';
import type { Thread } from '../src/chat/types';

setInterfaceLanguage('zh');
const thread: Thread = { id: 'navigation', cwd: '', preview: '', updatedAt: 0, turns: [
  { id: 'single-turn', status: 'inProgress', items: [
    { id: 'single', type: 'commandExecution', status: 'completed', command: 'echo single',
      aggregatedOutput: 'SINGLE_OUTPUT' },
  ] },
  { id: 'group-turn', status: 'inProgress', items: [
    { id: 'first', type: 'commandExecution', status: 'completed', command: 'echo first',
      aggregatedOutput: 'FIRST_OUTPUT' },
    { id: 'second', type: 'commandExecution', status: 'inProgress', command: 'echo second',
      aggregatedOutput: 'SECOND_OUTPUT' },
  ] },
] };

function Conversation({ active }: { active: boolean }) {
  const drawer = useRef<ChatDrawerMethods>(null);
  const swipe = useChatDrawerSwipe(active);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(value => value + 1), 500);
    return () => clearInterval(timer);
  }, []);
  return <ChatQuotesProvider scope="details-navigation" active={active} enabled>
    <ChatDrawer ref={drawer} enabled={active} onOpen={() => undefined} onClose={() => undefined}
      onMoving={() => undefined} navigation={<Text style={textMetrics(14, 22)}>Conversations</Text>}>
      <Text style={textMetrics(14, 22)} testID="heartbeat">{tick}</Text>
      <ChatDrawerSurface enabled={active} {...swipe}>
        <ChatMessages thread={thread} active={active} />
      </ChatDrawerSurface>
    </ChatDrawer>
  </ChatQuotesProvider>;
}

function Fixture() {
  const [fonts] = useFonts(Ionicons.font);
  const [page, setPage] = useState('chat');
  const color = useThemeColor();
  const canvas = { flex: 1, backgroundColor: color('#ffffff', 'canvas') };
  const pages = { chat: <Conversation active={page === 'chat'} />, accounts: <Text>Accounts</Text>,
    discover: <Text>Discover</Text>, settings: <Text>Settings</Text> };
  const pageStyles = { chat: canvas, accounts: canvas, discover: canvas, settings: canvas };
  if (!fonts) return null;
  return <SafeAreaProvider><ThemeStatusBar /><SafeAreaView edges={['top', 'bottom']} style={canvas}>
    <View style={{ flexDirection: 'row' }}>
      <Button title="Light" onPress={() => updateThemeMode('light')} />
      <Button title="Dark" onPress={() => updateThemeMode('dark')} />
      <Button title="Switch later" onPress={() => setTimeout(() => setPage('accounts'), 3000)} />
    </View>
    <PrimaryPagePager page={page} onChange={setPage} pages={pages} pageStyles={pageStyles} />
    <View style={{ flexDirection: 'row', paddingBottom: 32 }}>
      {PRIMARY_PAGES.map(key => <Button key={key} title={key} onPress={() => setPage(key)} />)}
    </View>
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(Fixture);
