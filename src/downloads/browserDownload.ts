import ReactNativeBlobUtil from 'react-native-blob-util';
import type { DownloadTask } from './types';

export interface BrowserDownloadRequest {
  downloadUrl: string;
  downloadName?: string;
  contentDisposition?: string;
  mimeType?: string;
  userAgent?: string;
}

const FAILURE = 'client.mobile.downloadFailedTryAgainLater';

function dispositionName(value = '') {
  const encoded = /(?:^|;)\s*filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i.exec(value)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded.trim()); } catch { /* Try the plain filename. */ }
  }
  const plain = /(?:^|;)\s*filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;]+))/i.exec(value);
  return plain?.[1]?.replace(/\\(.)/g, '$1') ?? plain?.[2]?.trim();
}

export function browserDownloadTask(owner: string, id: string, request: BrowserDownloadRequest): DownloadTask {
  const url = request.downloadUrl.split('#')[0];
  const origin = /^https?:\/\/([^/\s?@\\]+)(?=[/?]|$)/i.exec(url)?.[1];
  if (!origin || /[\s\\]/.test(url)) throw new Error(FAILURE);
  const candidate = (dispositionName(request.contentDisposition) || request.downloadName || '').trim();
  const safeName = candidate.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  const name = [...safeName].slice(0, 60).join('');
  const path = name && !/^\.+$/.test(name) && name !== '.partial' ? name : 'download';
  return { id, name: path, source: { owner, deviceId: 'browser', deviceName: origin, scope: 'computer', path },
    website: { url, userAgent: request.userAgent }, mimeType: request.mimeType, status: 'queued',
    received: 0, size: 0, createdAt: Date.now(), message: '' };
}

export async function transferBrowserDownload({ task, directory, signal, update }: {
  task: DownloadTask; directory: string; signal: AbortSignal; update: () => void;
}) {
  const { fs } = ReactNativeBlobUtil;
  const request = task.website;
  if (!request || signal.aborted) throw new Error(FAILURE);
  const partial = `${directory}/.partial`;
  if (!await fs.exists(directory)) await fs.mkdir(directory);
  if (signal.aborted) throw new Error(FAILURE);
  Object.assign(task, { status: 'downloading', received: 0, size: 0, message: '' });
  update();
  const started = Date.now();
  // The platform networking stack applies cookies for each destination, including after redirects.
  const headers: Record<string, string> = request.userAgent ? { 'User-Agent': request.userAgent } : {};
  const transfer = ReactNativeBlobUtil.config({ path: partial, overwrite: true }).fetch('GET', request.url, headers);
  let cancelled: Promise<void> | undefined;
  const cancel = () => { cancelled = new Promise(resolve => { transfer.cancel(() => resolve()); }); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await transfer.progress({ interval: 300 }, (received, size) => {
      if (signal.aborted) return;
      task.received = Number(received);
      task.size = Math.max(0, Number(size) || 0);
      task.bytesPerSecond = task.received * 1000 / Math.max(1, Date.now() - started);
      update();
    });
    const { status, headers: responseHeaders } = result.info();
    const contentType = Object.entries(responseHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
    const mimeType = typeof contentType === 'string' ? contentType.split(';')[0].toLowerCase() : undefined;
    if (signal.aborted || status < 200 || status >= 300 || status === 206
      || (mimeType?.startsWith('text/html') && task.mimeType && !task.mimeType.startsWith('text/html'))) {
      throw new Error(FAILURE);
    }
    const size = Number((await fs.stat(partial)).size);
    const destination = `${directory}/${task.name}`;
    await fs.mv(partial, destination);
    Object.assign(task, { status: 'completed', size, received: size, mimeType: mimeType || task.mimeType,
      uri: `file://${encodeURI(destination).replace(/#/g, '%23')}`, completedAt: Date.now(),
      bytesPerSecond: undefined, website: { url: '' } });
  } finally {
    signal.removeEventListener('abort', cancel);
    await cancelled;
    if (task.status !== 'completed' && await fs.exists(partial)) await fs.unlink(partial);
  }
}
