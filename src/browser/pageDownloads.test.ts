import { expect, it, vi } from 'vitest';
import { PageDownloads } from './pageDownloads';
import { PAGE_DOWNLOAD_PREFIX } from './pageDownloadScript';

it('waits for each write before acknowledging it and cleans up when the tab closes', async () => {
  const file = { write: vi.fn(async () => {}), finish: vi.fn(async () => {}), discard: vi.fn(async () => {}) };
  const handlers = { begin: vi.fn(async () => file), finished: vi.fn(), failed: vi.fn() };
  const acknowledge = vi.fn();
  const downloads = new PageDownloads();
  const send = (packet: object) => {
    downloads.receive(PAGE_DOWNLOAD_PREFIX + JSON.stringify({ id: 'page-1', ...packet }),
      'https://example.test/report', handlers, acknowledge);
  };
  send({ action: 'start', name: 'report.md', mimeType: 'text/markdown', size: 3 });
  await vi.waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(1));
  send({ action: 'write', offset: 0, data: 'YWJj' });
  await vi.waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(2));
  expect(file.write).toHaveBeenCalledExactlyOnceWith(0, 'YWJj', 3);
  send({ action: 'finish' });
  await vi.waitFor(() => expect(handlers.finished).toHaveBeenCalledOnce());
  expect(file.finish).toHaveBeenCalledOnce();

  send({ action: 'start', name: 'incomplete.md', mimeType: 'text/plain', size: 4 });
  await vi.waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(4));
  downloads.reset();
  await vi.waitFor(() => expect(file.discard).toHaveBeenCalledOnce());
});
