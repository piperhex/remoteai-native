import { toByteArray } from 'base64-js';
import { checkPreviewSize } from '../file-preview/kinds';
import { downloadFile, type FileClient } from './fileDownload';
import type { PreviewLoadOptions } from './previewProgress';
import type { TextPreview } from './textPreview';
import { DEFAULT_CHAT_POLICY, fileDownloadByteLimit, MIB, textPreviewByteLimit } from './policy';
import type { ConnectionMode } from './protocol';

/** Small online previews can still populate the existing offline text cache. */
export function canCacheHtmlPreview(size: number | null | undefined, mode: ConnectionMode) {
  return typeof size === 'number' && size <= Math.min(DEFAULT_CHAT_POLICY.filePreviewMaxMb * MIB,
    textPreviewByteLimit(mode), fileDownloadByteLimit(mode));
}

/** Portable browsers need the document text to resolve its neighboring assets inside an opaque iframe. */
export async function readHtmlDocument(client: FileClient, threadId: string, path: string,
  options?: PreviewLoadOptions): Promise<TextPreview> {
  const parts: string[] = [];
  let decoder: TextDecoder | undefined;
  let size = 0;
  await downloadFile({ client, threadId, path, preview: 'html',
    signal: options?.signal ?? new AbortController().signal,
    checkSize: bytes => checkPreviewSize(bytes, path),
    progress: (received, total) => options?.onProgress?.({ received, total, status: 'downloading' }),
    target: async info => {
      size = info.size;
      return {
        write: async data => {
          const bytes = toByteArray(data);
          decoder ??= new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
            : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8');
          parts.push(decoder.decode(bytes, { stream: true }));
        },
        finish: async () => { if (decoder) parts.push(decoder.decode()); },
        dispose: async () => {},
      };
    } });
  return { path, size, text: parts.join('') };
}
