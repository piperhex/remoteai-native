import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { randomUUID } from 'expo-crypto';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CliGuiProvider, useCliGui } from '../../vendor/shared/cli-gui/context';
import { cliSidebarThread } from '../../vendor/shared/cli-gui/useCliSidebar';
import { ChatController } from '../../vendor/shared/remote-chat/client/controller';
import { initialChatState, type Thread } from '../../src/chat/types';
import { ChatThreads } from '../../src/chat/ChatThreads';
import { ChatProfileMenu } from '../../src/chat/ChatProfileMenu';
import { ChatOverlay } from '../../src/chat/ChatOverlay';
import { ChatDrawer, type ChatDrawerMethods } from '../../src/chat/ChatDrawer';
import { ChatDrawerSurface } from '../../src/chat/ChatDrawerSurface';
import { useChatDrawerSwipe } from '../../src/chat/useChatDrawerSwipe';
import { PrimaryPagePager } from '../../src/navigation/PrimaryPagePager';
import type { PrimaryPage } from '../../vendor/shared/navigation/pageSwipe';
import { CliConversation } from '../../src/chat/cli/CliConversation';
import { ChatSettings } from '../../src/chat/ChatSettings';
import { ChatProjectSwitch } from '../../src/chat/ChatProjectSwitch';
import { ComposerModelButton } from '../../src/chat/ComposerModelButton';
import { cliPickerModels } from '../../vendor/shared/cli-gui/modelSelection';
import { createThemedStyles } from '../../src/theme/styles';
import { textMetrics } from '../../src/theme/text';
import { updateThemeMode, useThemeMode } from '../../src/theme/store';
import { setInterfaceLanguage } from '../../vendor/shared/localization/interfaceLanguage';
import { createCliFixture } from './cli-gui';

setInterfaceLanguage('zh');
updateThemeMode('light');
const fixture = createCliFixture();
const host = new ChatController(() => ({ start() {}, stop() {},
  request: async <T,>() => ({ data: [], nextCursor: null }) as T }));
Object.assign(host.guiAccounts, fixture.accounts);
Object.assign(host.snapshot(), { ready: true });
host.guiTools.projects.list = async () => [{ cwd: '/project', label: 'Remote AI' }];
const connection = { client: host.guiAccounts, deviceName: 'Office PC', chooseDevice() {} };
const codex: Thread = { id: 'codex-history', name: 'Codex 历史对话', preview: '', cwd: '/project', updatedAt: 1 };
const models = cliPickerModels([{ id: 'model-a', label: 'Model A', efforts: [{ id: 'high', label: 'High' }] }]);
const selection = { model: 'model-a', effort: 'high', access: 'read-only' as const, speed: 'normal' as const };
const readUsage = async () => ({ totalTokens: 125000, estimatedCostUsd: 4.5, primaryRemainingPercent: 80,
  primaryRemainingAggregated: false, providerEstimatedCost: null });
const readMetrics = async () => ({ totalOutputTokens: 0, totalOutputTimeMs: 0, outputRequestCount: 0 });

function CodexSettings({ locked }: { locked: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <ComposerModelButton models={models} selection={selection} compact={false} onPress={() => setOpen(true)} />
    {open && <ChatSettings connection={connection} threadId={locked ? codex.id : null} cwd="/project"
      contextSettings={host.contextSettings} readUsage={readUsage} readConversationMetrics={readMetrics}
      usageActive models={models} selection={selection} saving={false} ready error=""
      updateSettings={async () => {}} refreshModels={async () => {}} onClose={() => setOpen(false)} />}
  </>;
}

function Screen({ active }: { active: boolean }) {
  const cli = useCliGui()!;
  const [history, setHistory] = useState(false);
  const drawer = useRef<ChatDrawerMethods>(null);
  const swipe = { ...useChatDrawerSwipe(active && !history), enabled: active };
  const [codexSelected, setCodexSelected] = useState(false);
  const styles = useStyles();
  const mode = useThemeMode();
  const select = (thread: Thread) => {
    const session = cli.state.sessions.find(value => cliSidebarThread(value).id === thread.id);
    if (session) cli.controller.open(session); else { cli.controller.showCodex(); setCodexSelected(true); }
    drawer.current?.closeDrawer();
  };
  const newChat = () => { cli.controller.newConversation(); setCodexSelected(false); drawer.current?.closeDrawer(); };
  return <SafeAreaView style={styles.page}>
    <View style={styles.toolbar}>
      <Pressable accessibilityLabel="history" onPress={() => drawer.current?.openDrawer()}>
        <Text style={styles.text}>历史</Text></Pressable>
      <Pressable accessibilityLabel="new-conversation" onPress={newChat}>
        <Text style={styles.text}>新聊天</Text></Pressable>
      <Pressable accessibilityLabel="toggle-theme" onPress={() => updateThemeMode(mode === 'light' ? 'dark' : 'light')}>
        <Text style={styles.text}>{mode}</Text></Pressable>
    </View>
    <ChatDrawer ref={drawer} enabled={active} onOpen={() => setHistory(true)}
      onMoving={() => setHistory(true)} onClose={() => setHistory(false)}
      navigation={<ChatThreads state={{ ...initialChatState(), ready: true, mode: 'direct',
      threads: [codex], selected: codexSelected ? codex : null }} controller={host} newChat={newChat}
      openSearch={() => {}} select={select} active profileMenu={<ChatProfileMenu {...connection}
        guiTools={host.guiTools} email="test@example.test" running={false} ready active />} />}>
    <ChatOverlay>{cli.state.engine === 'codex' ? <><ChatDrawerSurface {...swipe}>
      <View style={styles.empty}><Text style={styles.title}>Codex GUI</Text></View></ChatDrawerSurface>
        <ChatProjectSwitch state={host.snapshot()} controller={host} active />
        <CodexSettings locked={codexSelected} /></>
        : <CliConversation host={host} connection={connection} active={active} ready swipe={swipe} />}
    </ChatOverlay>
    </ChatDrawer>
    <Text accessibilityLabel="call-count" style={styles.counter}>{fixture.calls.filter(call => call.action === 'send').length}</Text>
  </SafeAreaView>;
}

function Pages() {
  const [page, setPage] = useState<PrimaryPage>('chat');
  const styles = useStyles();
  return <View style={styles.page}>
    <PrimaryPagePager page={page} onChange={setPage}
      pageStyles={{ chat: styles.page, accounts: styles.page, discover: styles.page, settings: styles.page }}
      pages={{ chat: <Screen active={page === 'chat'} />,
        accounts: <Text accessibilityLabel="accounts-page" style={styles.title}>Accounts</Text>,
        discover: <Text style={styles.title}>Discover</Text>, settings: <Text style={styles.title}>Settings</Text> }} />
    <Pressable accessibilityLabel="chat-tab" onPress={() => setPage('chat')}>
      <Text accessibilityLabel={`active-tab-${page}`} style={styles.text}>{page}</Text>
    </Pressable>
  </View>;
}

function Fixture() {
  const [fontsReady] = useFonts({ ...Feather.font, ...Ionicons.font });
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    {fontsReady && <CliGuiProvider transport={fixture.transport} createMessageId={randomUUID}><Pages /></CliGuiProvider>}
  </SafeAreaProvider></GestureHandlerRootView>;
}

const useStyles = createThemedStyles(color => ({
  page: { flex: 1, backgroundColor: color('#fff', 'canvas') },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  text: { ...textMetrics(14, 22), color: color('#222', 'ink') },
  title: { ...textMetrics(18, 28), color: color('#222', 'ink') },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  counter: { ...textMetrics(10, 16), color: color('#888', 'muted'), textAlign: 'right' },
}));

registerRootComponent(Fixture);
