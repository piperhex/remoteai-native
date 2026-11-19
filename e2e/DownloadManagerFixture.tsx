import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Button, DeviceEventEmitter, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { fromByteArray } from 'base64-js';
import { Buffer } from 'buffer';
import { NativeBrowserProvider } from '../src/browser/NativeBrowserProvider';
import { ComposerReferences } from '../src/chat/ComposerReferences';
import { useComposerAttachments } from '../src/chat/useComposerAttachments';
import { DownloadManagerPage } from '../src/downloads/DownloadManagerPage';
import { downloadManager, downloadOwner } from '../src/downloads/manager';
import { textMetrics } from '../src/theme/text';
import { updateThemeMode } from '../src/theme/store';
import type { AuthSession } from '../src/types';
import { DownloadedFileProvider, useDownloadedFileReceiver } from '../vendor/shared/chat/DownloadedFileContext';
import type { DownloadClient } from '../vendor/shared/remote-chat/downloads';
import { setInterfaceLanguage } from "../vendor/shared/localization/interfaceLanguage";

setInterfaceLanguage('zh');
updateThemeMode('dark');
const session: AuthSession = { baseUrl: 'https://download.test', email: 'fixture@download.test',
  accessToken: 'fixture', refreshToken: 'fixture' };
const owner = downloadOwner(session);
const filename = 'RemoteAI-2.0.12-android.apk';
const textFile = '安装说明.txt';
const content = Buffer.from('中文下载预览\n验证保存在手机上的原始文件。');
const client: DownloadClient = {
  open: async ({ path }) => ({ id: '11111111-1111-4111-8111-111111111111', name: path,
    size: content.length, revision: 'fixture', mimeType: path === textFile ? 'text/plain'
      : path.endsWith('.zip') ? 'application/zip' : 'application/vnd.android.package-archive' }),
  read: async ({ offset, length }) => ({ offset, data: fromByteArray(content.subarray(offset, offset + length)) }),
  close: async () => {},
  browse: async () => ({ directory: 'C:/project', parent: null, entries: [], truncated: false }),
};
const files = { open: async () => client.open({ scope: 'computer', path: filename, transferId: 'fixture' }),
  read: client.read, close: client.close };

function DownloadPages() {
  const [page, setPage] = useState<'discover' | 'downloads' | 'chat'>('discover');
  const draft = useComposerAttachments({ threadId: 'fixture', sending: false });
  useDownloadedFileReceiver({ scope: 'fixture', mode: page === 'downloads' ? 'direct' : undefined,
    add: draft.addDownloadedFile });
  const showLegacyDownloads = () => {
    const tasks = downloadManager.snapshot().map(task => ({ ...task, completedAt: undefined }));
    DeviceEventEmitter.emit('downloadTasksChanged', JSON.stringify(tasks));
    setPage('downloads');
  };
  useEffect(() => {
    downloadManager.bind({ owner, deviceId: 'fixture-pc', deviceName: 'ZH', ready: true, mode: 'direct',
      windowSize: 2, cwd: 'C:/project', client, files });
    void downloadManager.initialize().then(async () => {
      if (downloadManager.snapshot().length) return;
      for (const path of [filename, '项目资料.zip', textFile]) {
        await downloadManager.enqueue({ owner, deviceId: 'fixture-pc', deviceName: 'ZH', scope: 'computer', path });
      }
    });
    return () => downloadManager.unbind(files);
  }, []);
  return <SafeAreaView style={{ flex: 1 }}>
    {page === 'downloads' ? <DownloadManagerPage session={session}
      onBack={() => setPage('discover')} onReference={() => setPage('chat')} />
      : <View><Button title="下载管理" onPress={() => setPage('downloads')} />
        <Button title="旧记录" onPress={showLegacyDownloads} />
        {page === 'chat' && <>
          <Text style={textMetrics(16, 24)}>聊天草稿</Text>
          <ComposerReferences items={draft.items} disabled={false} remove={draft.remove} />
          <Text style={textMetrics(14, 22)}>{draft.items[0]?.data === fromByteArray(content) ? '附件内容验证通过' : ''}</Text>
        </>}</View>}
  </SafeAreaView>;
}

function DownloadManagerFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...Feather.font, ...MaterialCommunityIcons.font });
  return <SafeAreaProvider>{fonts && <DownloadedFileProvider owner={owner}>
    <NativeBrowserProvider scope={owner}><DownloadPages /></NativeBrowserProvider>
  </DownloadedFileProvider>}</SafeAreaProvider>;
}

registerRootComponent(DownloadManagerFixture);
