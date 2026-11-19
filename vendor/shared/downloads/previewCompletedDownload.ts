import { checkPreviewSize, filePreviewKind, PREVIEW_BYTE_LIMIT } from '../file-preview/kinds';
import { isDownloadOnlyFile } from '../remote-chat/filePreview';

interface DownloadedDocument { name: string; size: number; mimeType?: string }
const TEXT_NAMES = new Set(['readme', 'license', 'makefile', 'dockerfile']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'csv', 'tsv', 'json', 'jsonc', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'css', 'scss', 'less',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'rs', 'go', 'sh', 'ps1', 'bat', 'sql', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'hpp', 'cs', 'diff', 'patch',
]);

export function downloadedDocument({ name, size, mimeType }: DownloadedDocument) {
  return { name, size, mime: mimeType ?? '' };
}

export function canPreviewCompletedDownload({ name, size, mimeType }: DownloadedDocument) {
  if (size > PREVIEW_BYTE_LIMIT || isDownloadOnlyFile(name, { mediaPreview: true })) return false;
  try { checkPreviewSize(size, name, 'relay'); } catch { return false; }
  const filename = name.toLowerCase();
  const knownText = TEXT_NAMES.has(filename) || filename.includes('.') && TEXT_EXTENSIONS.has(filename.split('.').at(-1)!);
  return !!filePreviewKind(name) || knownText || /^text\//i.test(mimeType ?? '')
    || /^application\/(?:json|xml|[\w.+-]+\+(?:json|xml))(?:;|$)/i.test(mimeType ?? '');
}
