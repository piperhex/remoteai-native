import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatImage, ChatImageContext } from '../../src/chat/ChatImage';
import { ChatImagePreviewProvider } from '../../src/chat/ChatImagePreview';
import { ChatPhotoPicker } from '../../src/chat/ChatPhotoPicker';
import { ImageAiContext } from '../../vendor/shared/chat/ImageAiContext';
import type { Turn } from '../../vendor/shared/conversation/types';
import { setInterfaceLanguage } from '../../vendor/shared/localization/interfaceLanguage';
import { textMetrics } from '../../src/theme/text';
import { updateThemeMode } from '../../src/theme/store';

setInterfaceLanguage('zh');
const sources = ['/fixtures/first.png', '/fixtures/second.png', '/fixtures/third.png'];
const assets = [require('./image-navigation-1.png'), require('./image-navigation-2.png'),
  require('./image-navigation-3.png')];
const images = assets.map(asset => Image.resolveAssetSource(asset).uri);
const turns: Turn[] = [{ id: 'images', status: 'completed', items: [
  { id: 'sent', type: 'userMessage', content: [{ type: 'localImage', path: sources[0] }] },
  { id: 'reply', type: 'agentMessage', text: `![Image 2](${sources[1]})\n\n![Image 3](${sources[2]})` },
] }];
const load = async (_thread: string, source: string) => {
  const response = await fetch(`http://127.0.0.1:15987/image?index=${sources.indexOf(source)}`);
  return (await response.json()).url as string;
};
const noAction = () => {};
const photos = images.map((uri, index) => ({ id: String(index), uri, dataUrl: uri }));

function Screen() {
  const [single, setSingle] = useState(false);
  return <SafeAreaView style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={textMetrics(18, 26)}>Image navigation</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="single" onPress={() => setSingle(!single)}>
        <Text style={textMetrics(14, 22)}>{single ? 'Single image' : 'Conversation gallery'}</Text>
      </Pressable>
      <ChatImageContext.Provider value={{ threadId: 'navigation', ready: true, load }}>
        <ChatImagePreviewProvider turns={single ? [] : turns}>
          {/* Only the last image is mounted, as in a virtualized conversation. */}
          <ChatImage source={sources[2]} description="Image 3" />
        </ChatImagePreviewProvider>
      </ChatImageContext.Provider>
      <ChatPhotoPicker active disabled={false} photos={{ photos, busy: false, error: '', settingsRequired: false,
        pick: async () => {}, remove: noAction, replace: noAction, restore: noAction,
        clearSubmitted: noAction, openSettings: noAction }} />
    </ScrollView>
  </SafeAreaView>;
}

function Fixture() {
  const [ready] = useFonts({ ...MaterialCommunityIcons.font, ...Feather.font });
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
    <ImageAiContext.Provider value={{ enabled: true, send: async () => true }}>
      {ready && <Screen />}
    </ImageAiContext.Provider>
  </SafeAreaProvider></GestureHandlerRootView>;
}
updateThemeMode('light');
registerRootComponent(Fixture);
