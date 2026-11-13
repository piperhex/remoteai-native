import { fromByteArray } from 'base64-js';
import type { DownloadClient } from '../vendor/shared/remote-chat/downloads';

const FILE_SIZE = 32 * 1024 * 1024;
export const browserDownloadClient: DownloadClient = {
  open: async ({ path }) => ({ id: '11111111-1111-4111-8111-111111111111', name: path.split('/').at(-1)!,
    size: FILE_SIZE, mimeType: 'application/zip', revision: 'browser-download-fixture' }),
  read: async ({ offset, length }) => {
    await new Promise(resolve => setTimeout(resolve, 700));
    return { offset, data: fromByteArray(new Uint8Array(Math.min(length, FILE_SIZE - offset)).fill(65)) };
  },
  close: async () => {},
  browse: async () => ({ directory: '/', parent: null, entries: [], truncated: false }),
};
