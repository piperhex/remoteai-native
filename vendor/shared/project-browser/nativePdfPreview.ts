import { fromByteArray, toByteArray } from 'base64-js';
import { checkPreviewSize } from '../file-preview/kinds';
import { downloadProjectEntry } from './downloads';
import type { ProjectBrowserClient } from './protocol';

export interface NativePdfData { data: string; size: number }

/** Keep remote handles and policy enforcement in the native host, outside the WebView. */
export async function readNativePdfPreview(options: {
  client: ProjectBrowserClient; cwd: string; path: string; token: string; signal: AbortSignal;
}): Promise<NativePdfData> {
  const { client, cwd, path, token, signal } = options;
  if (!client.transfer) throw new Error('client.filePreview.unavailable');
  const checkSize = (size: number) => checkPreviewSize(size, path, client.previewMode);
  let bytes = new Uint8Array();
  let offset = 0;
  await downloadProjectEntry({ client: client.transfer, file: { cwd, path }, transferId: token,
    signal, preview: 'pdf', checkSize, progress: () => {},
    target: async info => {
      bytes = new Uint8Array(info.size);
      return {
        write: async data => { const chunk = toByteArray(data); bytes.set(chunk, offset); offset += chunk.length; },
        finish: async () => {}, dispose: async () => {},
      };
    },
  });
  checkSize(bytes.length);
  return { data: fromByteArray(bytes), size: bytes.length };
}
