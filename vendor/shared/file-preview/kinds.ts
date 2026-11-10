import { checkFilePreviewSize, textPreviewByteLimit } from '../remote-chat/policy';
import type { ConnectionMode } from '../remote-chat/protocol';

export type FilePreviewKind = 'html' | 'markdown' | 'image' | 'pdf' | 'video' | 'audio';

const extensions: Record<FilePreviewKind, readonly string[]> = {
  html: ['html', 'htm', 'xhtml'],
  markdown: ['md', 'markdown', 'mdown', 'mkd', 'mdx'],
  image: ['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'bmp', 'avif', 'svg', 'ico', 'apng'],
  pdf: ['pdf'],
  video: ['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', 'mkv', 'avi', 'mpeg', 'mpg', '3gp', '3g2', 'm2ts', 'wmv', 'flv'],
  audio: ['mp3', 'wav', 'wave', 'm4a', 'aac', 'flac', 'oga', 'opus', 'aif', 'aiff', 'weba'],
};

export function filePreviewKind(path: string): FilePreviewKind | undefined {
  const name = path.split(/[\\/]/).at(-1) ?? '';
  if (!name.includes('.')) return undefined;
  const extension = name.split('.').at(-1)?.toLowerCase();
  return (Object.keys(extensions) as FilePreviewKind[]).find(kind => extensions[kind].includes(extension ?? ''));
}

export const PREVIEW_BYTE_LIMIT = 64 * 1024 * 1024;
export function previewMimeType(path: string) {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
  const types: Record<string, string> = { svg: 'image/svg+xml', ico: 'image/x-icon', pdf: 'application/pdf',
    mp3: 'audio/mpeg', wav: 'audio/wav', wave: 'audio/wav', m4a: 'audio/mp4', oga: 'audio/ogg',
    ogg: 'video/ogg', ogv: 'video/ogg', mov: 'video/quicktime', m4v: 'video/mp4' };
  return types[extension] ?? `${filePreviewKind(path) ?? 'application'}/${extension}`;
}
export type PreviewLoader = ((path: string, options: {
  signal: AbortSignal; progress: (received: number, total: number) => void;
}) => Promise<Blob>) & { mode?: ConnectionMode };

export function previewByteLimit(path: string, mode?: ConnectionMode) {
  return filePreviewKind(path) === 'pdf' ? textPreviewByteLimit(mode) : PREVIEW_BYTE_LIMIT;
}
export function checkPreviewSize(size: number, path = '', mode?: ConnectionMode) {
  if (filePreviewKind(path) === 'pdf') { checkFilePreviewSize(size, mode); return; }
  if (!Number.isSafeInteger(size) || size < 0 || size > PREVIEW_BYTE_LIMIT) {
    throw new Error('client.filePreview.tooLarge');
  }
}
