import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createMobileProjectPickerFixture } from '../vendor/shared/testing/mobileProjectPickerFixture';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { ChatProjectSwitch } from '../src/chat/ChatProjectSwitch';
import { updateThemeMode, useThemeColor, useThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';

setInterfaceLanguage('zh');
updateThemeMode('dark');
function ProjectPickerFixture() {
  const [{ controller }] = useState(createMobileProjectPickerFixture);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const mode = useThemeMode();
  const color = useThemeColor();
  const [fontsReady] = useFonts(Feather.font);
  const [draft, setDraft] = useState('保留这条尚未发送的消息');
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: color('#fff', 'surface') }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, gap: 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.settings.light')}
        onPress={() => updateThemeMode(mode === 'dark' ? 'light' : 'dark')}>
        <Text style={{ ...textMetrics(14, 22), color: color('#13231c', 'ink') }}>{t('client.settings.light')}</Text>
      </Pressable>
      {fontsReady && <ChatProjectSwitch state={state} controller={controller} active />}
      <TextInput accessibilityLabel={t('client.chat.chatMessage')} value={draft} onChangeText={setDraft}
        style={{ ...textMetrics(14, 22), color: color('#13231c', 'ink'), borderWidth: 1,
          borderColor: color('#dce6e0', 'border'), borderRadius: 12, padding: 12 }} />
    </View>
  </SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(ProjectPickerFixture);
