import { useContext, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { toByteArray } from 'base64-js';
import { useReferenceDownloadedFile } from '../../vendor/shared/chat/DownloadedFileContext';
import { downloadedDocument } from '../../vendor/shared/downloads/previewCompletedDownload';
import { fileResourceUrl } from '../../vendor/shared/file-preview/resourceAddress';
import { base64Bytes, checkFileUploadSize } from '../../vendor/shared/remote-chat/policy';
import { NativeBrowserContext } from '../browser/context';
import { LoungeFilePreviewContent } from '../lounge/LoungeFilePreviewContent';
import { t, useLanguage } from '../i18n';
import { downloadManager } from './manager';
import { useStyles } from './styles';
import type { DownloadTask } from './types';

function DownloadPreview({ task }: { task: DownloadTask }) {
  useLanguage();
  const styles = useStyles();
  const [bytes, setBytes] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void downloadManager.readCompletedFile(task).then(data => {
      if (current) setBytes(toByteArray(data));
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [task]);
  return <View style={styles.preview}>
    {bytes ? <LoungeFilePreviewContent file={downloadedDocument(task)} bytes={bytes} />
      : <Text style={styles.text} accessibilityRole="alert">
        {t(failed ? 'client.filePreview.unavailable' : 'client.projectBrowser.loading')}</Text>}
  </View>;
}

export function useDownloadedFileActions(onReference?: () => void) {
  const browser = useContext(NativeBrowserContext);
  const reference = useReferenceDownloadedFile();
  return {
    preview: browser && ((task: DownloadTask) => browser.openResource({
      url: fileResourceUrl(`/Downloads/${task.name}`), title: task.name,
      render: ({ active }) => active && <DownloadPreview task={task} />,
    })),
    reference: onReference && (async (task: DownloadTask) => {
      await reference(async mode => {
        checkFileUploadSize(task.size, mode);
        const data = await downloadManager.readCompletedFile(task);
        checkFileUploadSize(base64Bytes(data), mode);
        return { kind: 'file', path: '', name: task.name, data };
      });
      onReference();
    }),
  };
}
