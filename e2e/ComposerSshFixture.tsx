import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useMemo, useState, type ComponentProps } from 'react';
import { Button, KeyboardAvoidingView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatComposer } from '../src/chat/ChatComposer';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { updateThemeMode, useThemeColor } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { composerSshProfiles } from '../vendor/shared/testing/sshProfiles';
import { testModels } from '../vendor/shared/conversation/testing/models';

setInterfaceLanguage('zh');
const noop = () => {};
const props: Omit<ComponentProps<typeof ChatComposer>, 'send'> = {
  models: testModels, selection: { model: 'gpt-test', effort: 'high', access: 'workspace-write' as const },
  threadId: 'native-ssh-fixture', active: true, ready: true, sending: false, running: false,
  settingsBusy: false, settingsError: '', compacting: false, compactReason: null, cwd: '/project',
  updateSettings: async () => {}, refreshModels: async () => {}, interrupt: async () => {}, compact: async () => true,
  contextSettings: { read: async () => ({ capacity: null }),
    write: async (_id: string, value: { capacity: number | null }) => value },
  catalog: { skills: [], loaded: true, loading: false, error: '', refresh: noop },
  loadFiles: async () => ({ directory: '/project', parent: null, entries: [], truncated: false }),
  loadCatalog: async () => ({ data: [], plugins: [] }),
  loadConversations: async () => ({ data: [], nextCursor: null }),
  readUsage: async () => ({ totalTokens: 0, estimatedCostUsd: 0, primaryRemainingPercent: null,
    primaryRemainingAggregated: false, providerEstimatedCost: null }),
  readConversationMetrics: async () => ({ totalOutputTokens: 0, totalOutputTimeMs: 0, outputRequestCount: 0 }),
  usageActive: false,
  connection: { deviceName: 'Fixture PC', chooseDevice: noop, client: {
    read: async () => ({ running: true, choices: [], selection: { kind: 'none' as const } }),
    select: async selection => selection, subscribe: () => noop,
  } },
};

function Fixture() {
  const [fonts] = useFonts(Feather.font);
  const [state, setState] = useState('ready');
  const [sent, setSent] = useState('');
  const [dark, setDark] = useState(false);
  const color = useThemeColor();
  const profiles = useMemo(() => ({ list: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (state === 'error') throw new Error('Fixture unavailable');
    return state === 'empty' ? [] : composerSshProfiles;
  } }), [state]);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: color('#ededed', 'canvas') }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {['ready', 'empty', 'error', 'offline'].map(value => <Button key={value} title={value}
        onPress={() => setState(value)} />)}
      <Button title="Theme" onPress={() => { updateThemeMode(dark ? 'light' : 'dark'); setDark(!dark); }} />
    </View>
    <Text accessibilityLabel="sent" style={{ ...textMetrics(12, 18), color: color('#777', 'muted') }}>{sent}</Text>
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <ChatOverlay><View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {fonts && <ChatComposer {...props} key={state} ready={state !== 'offline'} sshProfiles={profiles}
          send={async input => { setSent(JSON.stringify(input)); return true; }} />}
      </View></ChatOverlay>
    </KeyboardAvoidingView>
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(Fixture);
