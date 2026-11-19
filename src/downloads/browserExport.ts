import ReactNativeBlobUtil from 'react-native-blob-util';
import type { DownloadTask } from './types';

export interface BrowserExportMetadata {
  pageUrl: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface BrowserExport {
  write: (offset: number, data: string, bytes: number) => Promise<void>;
  finish: () => Promise<void>;
  discard: () => Promise<void>;
}

export async function openBrowserExport({ task, size, directory, publish }: {
  task: DownloadTask; size: number; directory: string; publish: (task: DownloadTask) => Promise<unknown>;
}): Promise<BrowserExport> {
  const { fs } = ReactNativeBlobUtil;
  const partial = `${fs.dirs.CacheDir}/browser-export-${task.id}.partial`;
  await fs.writeFile(partial, '', 'base64');
  let received = 0;
  return {
    async write(offset, data, bytes) {
      if (offset !== received || received + bytes > size) throw new Error('Invalid browser download range');
      await fs.appendFile(partial, data, 'base64');
      received += bytes;
    },
    async finish() {
      if (received !== size) throw new Error('Incomplete browser download');
      await fs.mkdir(directory);
      const destination = `${directory}/${task.name}`;
      try {
        await fs.mv(partial, destination);
        await publish({ ...task, status: 'completed', size, received, completedAt: Date.now(),
          uri: `file://${encodeURI(destination).replace(/#/g, '%23')}`, website: { url: '' } });
      } catch (error) {
        await fs.unlink(directory);
        throw error;
      }
    },
    async discard() {
      if (await fs.exists(partial)) await fs.unlink(partial);
    },
  };
}
