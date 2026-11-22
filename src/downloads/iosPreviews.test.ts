import { beforeEach, expect, it, vi } from 'vitest';
import type { ChatController } from '../../vendor/shared/remote-chat/client/controller';
import { createIosPreviewDownloads } from './iosPreviews';
import { saveImage } from '../chat/saveImage';
import Storage from 'expo-sqlite/kv-store';
import type { DownloadOpen } from '../../vendor/shared/remote-chat/downloads';

const data = vi.hoisted(() => ({ files: new Map<string, Buffer>(), index: new Map<string, string>() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('expo-sqlite/kv-store', () => ({ default: {
  getItem: vi.fn(async (key: string) => data.index.get(key)),
  setItem: async (key: string, value: string) => { data.index.set(key, value); },
} }));
vi.mock('../chat/saveImage', () => ({ saveImage: vi.fn(async () => {}) }));
vi.mock('react-native-blob-util', () => ({ default: { fs: {
  dirs: { DocumentDir: '/documents' }, mkdir: async () => {}, exists: async (path: string) => data.files.has(path),
  writeFile: async (path: string, value: string, encoding: BufferEncoding) => {
    data.files.set(path, Buffer.from(value, encoding));
  },
  appendFile: async (path: string, value: string, encoding: BufferEncoding) => {
    data.files.set(path, Buffer.concat([data.files.get(path)!, Buffer.from(value, encoding)]));
  },
  readFile: async (path: string) => data.files.get(path)!.toString('utf8'),
  stat: async (path: string) => ({ size: data.files.get(path)!.length }),
  unlink: async (path: string) => { data.files.delete(path); },
} } }));
beforeEach(() => { data.files.clear(); data.index.clear(); vi.clearAllMocks(); });

function fixture() {
  const bytes = Buffer.alloc(700_001, 65);
  let fail = true;
  const client = {
    open: vi.fn(async (_source: DownloadOpen) => ({ id: crypto.randomUUID(), revision: 'snapshot-sha256', size: bytes.length,
      name: 'image.png', mimeType: 'image/png' })),
    read: vi.fn(async ({ offset, length }: { offset: number; length: number }) => {
      if (offset > 0 && fail) throw new Error('disconnected');
      return { offset, data: bytes.subarray(offset, offset + length).toString('base64') };
    }), close: vi.fn(async () => {}),
  };
  const controller = { downloads: client, snapshot: () => ({ ready: true }) } as unknown as ChatController;
  const previews = createIosPreviewDownloads(controller, { owner: crypto.randomUUID(), deviceId: 'pc' });
  return { previews, client, bytes, reconnect: () => { fail = false; } };
}

it('continues the normal range-download fallback from its saved offset and exports the local original', async () => {
  const { previews, client, bytes, reconnect } = fixture();
  await expect(previews.image('thread', './image.png', true)).rejects.toThrow('中断');
  const checkpoint = JSON.parse([...data.index.values()][0])[0];
  expect(checkpoint.received).toBe(262_144);
  reconnect(); client.read.mockClear();
  const progress = vi.fn();
  const url = await previews.image('thread', './image.png', true, { onProgress: progress });
  expect(client.read.mock.calls[0][0].offset).toBe(262_144);
  expect(data.files.get(url.slice('file://'.length))).toEqual(bytes);
  await previews.saveImage(url);
  expect(saveImage).toHaveBeenCalledWith(url, 'image/png');
  expect(client.open).toHaveBeenCalledTimes(2);
  expect(client.open.mock.calls[0][0]).toMatchObject({ preview: 'image' });
  expect(progress).toHaveBeenCalledWith(expect.objectContaining({ received: 262_144, total: bytes.length }));
  expect(progress.mock.calls.some(([value]) => value.bytesPerSecond > 0)).toBe(true);
  previews.dispose();
});

it('pauses a disposed transfer and reloads its checkpoint when the same chat starts again', async () => {
  const { previews, client, reconnect } = fixture();
  let release!: () => void;
  const reading = new Promise<void>(resolve => { release = resolve; });
  client.read.mockImplementationOnce(async () => {
    await reading;
    return { offset: 0, data: Buffer.alloc(262_144).toString('base64') };
  });
  const result = previews.image('thread', './image.png', true);
  await vi.waitFor(() => expect(client.read).toHaveBeenCalled());
  previews.dispose();
  await expect(result).rejects.toThrow();
  release();
  await vi.waitFor(() => expect(client.close).toHaveBeenCalledTimes(1));
  expect(JSON.parse([...data.index.values()][0])[0]).toMatchObject({ status: 'paused', received: 0 });
  reconnect();
  await expect(previews.image('thread', './image.png', true)).resolves.toMatch(/^file:/);
  expect(Storage.getItem).toHaveBeenCalledTimes(2);
  previews.dispose();
});
