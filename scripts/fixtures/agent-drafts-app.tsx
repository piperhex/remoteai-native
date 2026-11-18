import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useSyncExternalStore } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatComposer } from '../../src/chat/ChatComposer';
import { ChatQuotesProvider } from '../../src/chat/ChatQuotes';
import { textMetrics } from '../../src/theme/text';
import { updateThemeMode } from '../../src/theme/store';
import { setInterfaceLanguage } from '../../vendor/shared/localization/interfaceLanguage';
import { ChatController } from '../../vendor/shared/remote-chat/client/controller';
import { cliPickerModels } from '../../vendor/shared/cli-gui/modelSelection';
import { createCliFixture } from './cli-gui';

setInterfaceLanguage('zh');
updateThemeMode('light');
const fixture = createCliFixture();
const thread = { id: 'existing', name: 'Existing', cwd: '/project-a', preview: '', updatedAt: 1, turns: [] };
const controller = new ChatController(() => ({ start() {}, stop() {}, request: async <T,>() =>
  ({ data: [], nextCursor: null, thread }) as T }));
const models = cliPickerModels([{ id: 'test-model', label: 'Test Model' }]);
const selection = { model: 'test-model', effort: '', access: 'read-only' as const };
const readUsage = async () => ({ totalTokens: 0, estimatedCostUsd: 0, primaryRemainingPercent: null,
  primaryRemainingAggregated: false, providerEstimatedCost: null });
const noAction = async () => {};

function Screen() {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [sent, setSent] = useState('');
  const choose = (target: string) => {
    Keyboard.dismiss();
    if (target === 'existing') void controller.select(thread);
    else controller.back(target === 'empty' ? null : { cwd: `/${target}`, label: target });
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>
      {['empty', 'project-a', 'project-b', 'existing'].map(target =>
        <Pressable key={target} accessibilityRole="button" accessibilityLabel={target}
          onPress={() => choose(target)} style={{ padding: 12, backgroundColor: '#eef4f0' }}>
          <Text style={textMetrics(14, 22)}>{target}</Text>
        </Pressable>)}
    </View>
    {sent && <Text accessibilityLabel="sent-message" style={textMetrics(14, 22)}>{sent}</Text>}
    <View style={{ flex: 1 }} />
    <ChatQuotesProvider active enabled scope={state.draftScope ?? null}>
      <ChatComposer threadId={state.selected?.id ?? null} draftScope={state.draftScope}
        active ready sending={false} running={false} usageActive={false} models={models} selection={selection}
        cwd={state.selected?.cwd ?? state.draftProject?.cwd ?? ''} settingsBusy={false} settingsError=""
        updateSettings={noAction} refreshModels={noAction} readUsage={readUsage}
        readConversationMetrics={async () => ({ totalOutputTokens: 0, totalOutputTimeMs: 0, outputRequestCount: 0 })}
        contextSettings={controller.contextSettings} connection={{ client: fixture.accounts, chooseDevice() {} }}
        send={async input => { setSent(input.text); return true; }}
        interrupt={noAction} compacting={false} compactReason={null}
        compact={async () => true} catalog={{ skills: [], loaded: true, loading: false, error: '', refresh() {} }}
        loadCatalog={async () => ({ data: [], plugins: [] })}
        loadFiles={async () => ({ directory: '/', parent: null, entries: [], truncated: false })}
        loadConversations={async () => ({ data: [], nextCursor: null })} />
    </ChatQuotesProvider>
  </SafeAreaView>;
}
function Fixture() {
  const [ready] = useFonts({ ...Feather.font, ...Ionicons.font });
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    {ready && <Screen />}
  </SafeAreaProvider></GestureHandlerRootView>;
}
registerRootComponent(Fixture);
