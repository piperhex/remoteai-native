import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { fromByteArray, toByteArray } from 'base64-js';
import { ChatFileContext, ChatFileProvider } from '../src/chat/ChatFilePreview';
import { LoungeFilePreview } from '../src/lounge/LoungeFilePreview';
import { ProjectBrowser } from '../src/chat/ProjectBrowser';
import type { ProjectBrowserClient } from '../vendor/shared/project-browser/protocol';
import type { LoungeController } from '../vendor/shared/lounge/controller';
import type { LoungeAttachment, AttachmentSink } from '../vendor/shared/lounge/attachments';
import { DEFAULT_CHAT_POLICY, getChatPolicy, subscribeChatPolicy, setChatPolicy, setChatConnectionMode } from '../vendor/shared/remote-chat/policy';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';
import { updateThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';

setInterfaceLanguage('zh');
updateThemeMode('light');
setChatConnectionMode('relay');
const setLimit = (limit: number) => setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: limit, fileDownloadMaxMb: 1 });
setLimit(100);
const name = 'attachment-2610.39813v2.pdf';
// SDCardDir is scoped to the app's external files directory on modern Android.
const source = `${ReactNativeBlobUtil.fs.dirs.SDCardDir}/preview-paper.pdf`;
const id = '11111111-1111-4111-8111-111111111111';
let fixtureBytes: Promise<Uint8Array> | undefined;
const bytes = () => fixtureBytes ??= ReactNativeBlobUtil.fs.readFile(source, 'base64').then(toByteArray);
const files = {
  open: async () => ({ id, name, size: (await bytes()).length, mimeType: 'application/pdf' }),
  read: async ({ offset, length }: { offset: number; length: number }) => ({
    offset, data: fromByteArray((await bytes()).subarray(offset, offset + length)),
  }),
  close: async () => {},
};
const cwd = 'C:/fixture';
const projectClient: ProjectBrowserClient = {
  previewMode: 'relay',
  list: async () => ({ directory: cwd, parent: null, truncated: false,
    entries: [{ name, path: `${cwd}/${name}`, directory: false }] }),
  read: async ({ path }) => ({ path, kind: 'binary', size: (await bytes()).length,
    revision: 'fixture', readOnly: true }),
  save: async () => { throw new Error('Read-only fixture'); },
  mutate: async () => { throw new Error('Read-only fixture'); },
  transfer: { open: files.open, read: files.read, close: files.close,
    browse: async () => ({ directory: cwd, parent: null, truncated: false, entries: [] }) },
};
// Use production preview screens with a scoped local-file transport, without sending a real message.
const controller = { attachments: {
  download: async (_file: LoungeAttachment, sink: AttachmentSink, options: {
    signal: AbortSignal; progress: (value: number) => void;
  }) => {
    const content = await bytes();
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < content.length; offset += chunkSize) {
      if (options.signal.aborted) throw new Error('Fixture transfer cancelled');
      await sink.write(fromByteArray(content.subarray(offset, offset + chunkSize)));
      options.progress(Math.min(1, (offset + chunkSize) / content.length));
    }
    await sink.finish();
  },
} } as unknown as LoungeController;

function Actions({ file }: { file: LoungeAttachment }) {
  const open = useContext(ChatFileContext);
  const limit = useSyncExternalStore(subscribeChatPolicy, () => getChatPolicy('relay').filePreviewMaxMb);
  const [community, setCommunity] = useState(false);
  const [browser, setBrowser] = useState(false);
  return <View style={{ flex: 1, padding: 20, gap: 16 }}>
    <Text style={textMetrics(16, 24)}>{name}</Text>
    <Text style={textMetrics(14, 22)}>{file.size} bytes</Text>
    <Text style={textMetrics(14, 22)}>Preview limit: {limit} MB</Text>
    <Button title="上限 1 MB" onPress={() => setLimit(1)} />
    <Button title="上限 100 MB" onPress={() => setLimit(100)} />
    <Button title="对话 PDF 预览" onPress={() => open?.({ path: `C:/fixture/${name}` })} />
    <Button title="社区 PDF 预览" onPress={() => setCommunity(true)} />
    <Button title="文件浏览 PDF 预览" onPress={() => setBrowser(true)} />
    {community && <LoungeFilePreview file={file} controller={controller} close={() => setCommunity(false)} />}
    {browser && <ProjectBrowser client={projectClient} cwd={cwd} connected active
      host={{ copyPath: async () => {} }} onClose={() => setBrowser(false)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Button title="上限 1 MB" onPress={() => setLimit(1)} />
        <Button title="上限 100 MB" onPress={() => setLimit(100)} />
      </View>
    </ProjectBrowser>}
  </View>;
}

function PdfPreviewFixture() {
  const [fontsReady] = useFonts(MaterialCommunityIcons.font);
  const [file, setFile] = useState<LoungeAttachment>();
  const [error, setError] = useState('');
  useEffect(() => {
    void ReactNativeBlobUtil.fs.stat(source).then(info => setFile({ id: 'paper', device: 'fixture', name,
      mime: 'application/pdf', kind: 'file', size: Number(info.size) })).catch(cause => setError(String(cause)));
  }, []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
    {!!error && <Text style={textMetrics(14, 22)}>{error}</Text>}
    {fontsReady && file && <ChatFileProvider threadId="pdf-fixture" ready files={files}
      videos={{ ...files, open: async () => { throw new Error('Not a video'); } }}
      load={async () => { throw new Error('PDF must not load as text'); }}>
      <Actions file={file} />
    </ChatFileProvider>}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(PdfPreviewFixture);
