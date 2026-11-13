import { toByteArray } from 'base64-js';
import { downloadFile, type FileClient } from '../../vendor/shared/remote-chat/fileDownload';
import { checkPreviewSize, filePreviewKind } from '../../vendor/shared/file-preview/kinds';
import { checkDownloadSize } from '../../vendor/shared/remote-chat/policy';

export async function loadBinaryPreview(options: {
  client: FileClient; threadId: string; path: string; signal: AbortSignal;
  progress: (received: number, total: number) => void;
}) {
  const pdf = filePreviewKind(options.path) === 'pdf';
  let bytes = new Uint8Array();
  let mime = '';
  await downloadFile({ ...options, preview: pdf ? 'pdf' : undefined,
    checkSize: size => { checkPreviewSize(size, options.path); if (!pdf) checkDownloadSize(size); },
    target: async info => {
      bytes = new Uint8Array(info.size); mime = info.mimeType;
      let offset = 0;
      return {
        write: async data => { const chunk = toByteArray(data); bytes.set(chunk, offset); offset += chunk.length; },
        finish: async () => {}, dispose: async () => {},
      };
    },
  });
  return { bytes, mime };
}
