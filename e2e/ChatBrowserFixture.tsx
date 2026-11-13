import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Buffer } from 'buffer';
import { fromByteArray } from 'base64-js';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { ChatFileProvider } from '../src/chat/ChatFilePreview';
import { ChatImageContext } from '../src/chat/ChatImage';
import { ChatImagePreviewProvider } from '../src/chat/ChatImagePreview';
import { ChatMarkdown } from '../src/chat/Markdown';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { statusBarTestImage } from './modalStatusBarImage';

setInterfaceLanguage('zh');
updateThemeMode('light');
const files = {
  '页面预览.html': '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<h1>聊天页面预览</h1><input aria-label="draft" value="保留页面状态"><button '
    + 'onclick="this.textContent=\'点击成功\'">验证交互</button>',
  '说明文档.md': '# 中文预览标题\n\n聊天预览在独立的浏览器标签页中打开。\n\n[相关文件](代码预览.ts#L2)',
  '代码预览.ts': 'const retained = true;\nconst newTab = true;\n',
};
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Resources<</Font<</F1 4 0 R>>>>'
  + '/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'
  + '5 0 obj<</Length 48>>stream\nBT /F1 24 Tf 20 340 Td (Chat PDF preview) Tj ET\nendstream\nendobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF');
const data = new Map<string, Uint8Array>();
let next = 0;
const client = {
  open: async (_threadId: string, path: string) => {
    const bytes = path.endsWith('.pdf') ? pdf : Buffer.from('download fixture');
    const id = `11111111-1111-4111-8111-${String(next++).padStart(12, '0')}`;
    data.set(id, bytes);
    return { id, size: bytes.length, name: path.split('/').at(-1)!,
      mimeType: path.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream' };
  },
  read: async ({ id, offset, length }: { id: string; offset: number; length: number }) => ({
    offset, data: fromByteArray(data.get(id)!.subarray(offset, offset + length)),
  }),
  close: async (_threadId: string, id: string) => { data.delete(id); },
};
const videos = { ...client, open: async () => { throw new Error('Unavailable fixture video'); } };
const load = async (_threadId: string, path: string) => ({ path,
  text: files[path.split('/').at(-1) as keyof typeof files] ?? '' });
const image = { threadId: 'fixture', ready: true, load: async () => statusBarTestImage };
const message = [...Object.keys(files), '阅读文档.pdf', '下载文件.zip', '图片预览.png']
  .map(name => `[${name}](C:/fixture/${name})`).join('\n\n')
  + '\n\n[网页链接](http://127.0.0.1:18408/page)\n\n![图片菜单](C:/fixture/photo.png)';

function ChatBrowserFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
  const [active, setActive] = useState(false);
  const footer = <View style={{ flexDirection: 'row', padding: 12, justifyContent: 'space-around' }}>
    {['聊天', '浏览器', '深色模式'].map((name, index) => <Pressable key={name} accessibilityRole="button"
      onPress={() => index === 2 ? updateThemeMode('dark') : setActive(index === 1)}>
      <Text style={textMetrics(14, 22)}>{name}</Text></Pressable>)}
  </View>;
  return <SafeAreaProvider>{fonts && <NativeBrowserProvider scope="chat-browser-fixture" active={active}
    onActiveChange={setActive} footer={footer}>
    <SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 16 }}>
      <ChatImageContext.Provider value={image}><ChatImagePreviewProvider active={!active}>
        <ChatFileProvider ready active={!active} threadId="fixture" files={client} videos={videos} load={load}>
          <ChatMarkdown text={message} />
        </ChatFileProvider>
      </ChatImagePreviewProvider></ChatImageContext.Provider>
    </ScrollView></SafeAreaView>
  </NativeBrowserProvider>}</SafeAreaProvider>;
}
registerRootComponent(ChatBrowserFixture);
