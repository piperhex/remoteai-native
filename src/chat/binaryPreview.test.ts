import { expect, it, vi } from 'vitest';
import { fromByteArray } from 'base64-js';
import { loadBinaryPreview } from './binaryPreview';
import { DEFAULT_CHAT_POLICY, setChatPolicy } from '../../vendor/shared/remote-chat/policy';

it('uses the PDF preview allowance and releases the remote file after reading', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 2, fileDownloadMaxMb: 1 });
  const bytes = new Uint8Array(1.5 * 1024 * 1024).fill(42);
  const client = { open: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111',
    size: bytes.length, name: 'report.pdf', mimeType: 'application/pdf' })),
    read: vi.fn(async ({ offset, length }: { offset: number; length: number }) => ({ offset,
      data: fromByteArray(bytes.subarray(offset, offset + length)) })), close: vi.fn(async () => {}) };
  try {
    const result = await loadBinaryPreview({ client, threadId: 'original-thread', path: 'C:/report.pdf',
      signal: new AbortController().signal, progress: vi.fn() });
    expect(result.bytes).toEqual(bytes);
    expect(client.open).toHaveBeenCalledWith('original-thread', 'C:/report.pdf', { preview: 'pdf' });
    expect(client.read.mock.calls.every(([request]) => 'preview' in request && request.preview === 'pdf')).toBe(true);
    expect(client.close).toHaveBeenCalledOnce();
    await expect(loadBinaryPreview({ client, threadId: 'original-thread', path: 'C:/audio.mp3',
      signal: new AbortController().signal, progress: vi.fn() })).rejects.toThrow();
    expect(client.close).toHaveBeenCalledTimes(2);
  } finally { setChatPolicy(DEFAULT_CHAT_POLICY); }
});
