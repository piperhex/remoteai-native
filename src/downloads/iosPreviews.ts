import ReactNativeBlobUtil from 'react-native-blob-util';
import { randomUUID } from 'expo-crypto';
import { PreviewDownloads, type PreviewAdapter, type PreviewSource } from '../../vendor/shared/remote-chat/previewDownloads';
import { transferFileChunks, validateFileInfo } from '../../vendor/shared/remote-chat/fileDownload';
import type { ChatController } from '../../vendor/shared/remote-chat/client/controller';
import type { DownloadTask } from './types';
import { saveImage } from '../chat/saveImage';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import Storage from 'expo-sqlite/kv-store';

const { fs } = ReactNativeBlobUtil;
const DIRECTORY = `${fs.dirs.DocumentDir}/preview-downloads`;
type Identity = { owner: string; deviceId: string };

/** iOS uses the same bounded range-transfer fallback as its ordinary file downloads.
 * Android's native binary receiver is deliberately not exposed as an iOS capability.
 */
class IosPreviewBackend {
  private tasks: DownloadTask[] = [];
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private active = new Map<string, { abort: AbortController; done: Promise<void> }>();
  private controllers = new Set<ChatController>();
  private requests = 0;
  private writes = Promise.resolve();
  private readonly directory: string;
  private readonly index: string;
  constructor(private readonly identity: Identity, private readonly onIdle: () => void) {
    const key = bytesToHex(sha256(utf8ToBytes(JSON.stringify(identity))));
    this.directory = `${DIRECTORY}/${key}`;
    this.index = `preview-downloads:${key}`;
  }
  attach(controller: ChatController) { this.controllers.add(controller); }
  detach(controller: ChatController) {
    this.controllers.delete(controller);
    if (!this.controllers.size) {
      for (const transfer of this.active.values()) transfer.abort.abort();
      for (const task of this.tasks) if (task.status === 'queued') task.status = 'paused';
      this.releaseIfIdle();
    }
  }
  private releaseIfIdle() {
    if (!this.controllers.size && !this.active.size && !this.requests) this.onIdle();
  }
  async track<T>(read: () => Promise<T>): Promise<T> {
    this.requests++;
    try { return await read(); }
    finally { this.requests--; this.releaseIfIdle(); }
  }
  private get controller() { return [...this.controllers].at(-1); }
  private file(id: string) {
    if (!/^[a-f\d-]{36}$/i.test(id)) throw new Error('预览已失效，请重试。');
    return `${this.directory}/${id}.part`;
  }
  snapshot = () => this.tasks;
  error = () => '';
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  connection = () => ({ ...this.identity, deviceName: '', ready: this.controller?.snapshot().ready ?? false });
  initialize = () => this.initialization ??= (async () => {
    if (!await fs.exists(this.directory)) await fs.mkdir(this.directory);
    const saved = await Storage.getItem(this.index);
    if (saved) {
      this.tasks = (JSON.parse(saved) as DownloadTask[])
        .map(task => ({ ...task, status: task.status === 'completed' ? 'completed' : 'paused' }));
    }
  })();
  private persist() {
    const json = JSON.stringify(this.tasks);
    const saved = this.writes.then(() => Storage.setItem(this.index, json));
    this.writes = saved.catch(() => { /* Each caller handles its own failed checkpoint. */ });
    this.listeners.forEach(listener => listener());
    return saved;
  }
  enqueue = async (source: PreviewSource) => {
    const task: DownloadTask = { id: randomUUID(), source, status: 'queued', received: 0,
      size: 0, createdAt: Date.now(), message: '', name: 'preview' };
    this.tasks.push(task); await this.persist(); this.schedule(); return task.id;
  };
  resume = async (id: string) => {
    const previous = this.active.get(id);
    if (previous?.abort.signal.aborted) await previous.done;
    const task = this.tasks.find(value => value.id === id);
    if (!task || this.active.has(id)) return;
    task.status = 'queued'; task.message = ''; await this.persist(); this.schedule();
  };
  remove = async (id: string) => {
    if (this.active.has(id)) return;
    if (await fs.exists(this.file(id))) await fs.unlink(this.file(id));
    this.tasks = this.tasks.filter(task => task.id !== id); await this.persist();
  };
  text = (task: DownloadTask) => fs.readFile(this.file(task.id), 'utf8');
  image = async (task: DownloadTask) => {
    if (!await fs.exists(this.file(task.id))) throw new Error('预览缓存已清理，请重试。');
    return `file://${this.file(task.id)}`;
  };
  save = async (task: DownloadTask) => { await saveImage(await this.image(task), task.mimeType); };
  private schedule() {
    const client = this.controller?.downloads;
    if (!client) return;
    for (const task of this.tasks) {
      if (this.active.size >= 2) return;
      if (task.status !== 'queued' || this.active.has(task.id) || task.source.owner !== this.identity.owner
        || task.source.deviceId !== this.identity.deviceId) continue;
      const transfer = new AbortController();
      const done = this.run(task, client, transfer.signal).finally(() => {
        this.active.delete(task.id);
        this.schedule();
        this.releaseIfIdle();
      });
      this.active.set(task.id, { abort: transfer, done });
    }
  }
  private async run(task: DownloadTask, client: ChatController['downloads'], signal: AbortSignal) {
    let remoteId: string | undefined;
    try {
      const info = await client.open({ ...task.source, transferId: task.id });
      remoteId = info.id; validateFileInfo(info);
      const exists = await fs.exists(this.file(task.id));
      const resume = exists && task.size === info.size && task.revision === info.revision && !!info.revision;
      if (!resume) { task.received = 0; await fs.writeFile(this.file(task.id), '', 'base64'); }
      else if (Number((await fs.stat(this.file(task.id))).size) !== task.received) {
        task.received = 0; await fs.writeFile(this.file(task.id), '', 'base64');
      }
      Object.assign(task, { size: info.size, revision: info.revision, mimeType: info.mimeType, name: info.name,
        status: 'downloading', bytesPerSecond: undefined });
      await this.persist();
      const startedAt = performance.now();
      const startingOffset = task.received;
      await transferFileChunks({ client, threadId: task.id, info,
        signal, offset: task.received,
        write: async (chunk, received) => {
          await fs.appendFile(this.file(task.id), chunk.data, 'base64'); task.received = received;
          task.bytesPerSecond = (received - startingOffset) * 1000 / Math.max(1, performance.now() - startedAt);
          await this.persist();
        } });
      task.status = 'completed'; task.bytesPerSecond = undefined; await this.persist();
    } catch {
      task.status = 'paused'; task.message = '加载中断，重新打开即可继续。';
      await this.persist().catch(() => console.warn('Could not checkpoint preview download.'));
    } finally {
      if (remoteId) await client.close(task.id, remoteId)
        .catch(() => console.warn('Remote preview handle will expire.'));
    }
  }
}

const backends = new Map<string, IosPreviewBackend>();
export function createIosPreviewDownloads(controller: ChatController, identity: Identity): PreviewAdapter {
  const key = JSON.stringify(identity);
  let session: { backend: IosPreviewBackend; previews: PreviewDownloads<DownloadTask> } | undefined;
  // A stopped chat can later start again. Acquire its file index only when a preview is actually opened.
  function use<T>(read: (previews: PreviewAdapter) => Promise<T>) {
    if (!session) {
      const backend = backends.get(key) ?? new IosPreviewBackend(identity, () => backends.delete(key));
      backends.set(key, backend);
      backend.attach(controller);
      session = { backend, previews: new PreviewDownloads(backend, identity) };
    }
    const { backend, previews } = session;
    return backend.track(() => read(previews));
  }
  return {
    image: (...args) => use(previews => previews.image(...args)),
    text: (...args) => use(previews => previews.text(...args)),
    saveImage: url => use(previews => previews.saveImage(url)),
    dispose: () => {
      session?.previews.dispose();
      session?.backend.detach(controller);
      session = undefined;
    },
  };
}
