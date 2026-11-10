import { fromByteArray } from 'base64-js';
import { afterEach, expect, it, vi } from 'vitest';
import { handleBrowserRequest } from '../../vendor/shared/project-browser/nativeBridge';
import type { ProjectBrowserClient } from '../../vendor/shared/project-browser/protocol';
import { DEFAULT_CHAT_POLICY, MIB, setChatPolicy, setChatConnectionMode }
  from '../../vendor/shared/remote-chat/policy';

const token = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const path = '/project/paper.pdf';
afterEach(() => { setChatConnectionMode('offline'); setChatPolicy(DEFAULT_CHAT_POLICY); });

function fixture(size = 2 * MIB) {
  const bytes = new Uint8Array(size).fill(37);
  const transfer = { open: vi.fn().mockResolvedValue({ id, name: 'paper.pdf', mimeType: 'application/pdf', size }),
    read: vi.fn(async ({ offset, length }: { offset: number; length: number }) => ({
      offset, data: fromByteArray(bytes.subarray(offset, offset + length)),
    })), close: vi.fn().mockResolvedValue(undefined), browse: vi.fn() };
  const client: ProjectBrowserClient = { list: vi.fn(), read: vi.fn(), save: vi.fn(), mutate: vi.fn(), transfer };
  const signal = new AbortController();
  const send = (body: object = { path, token }) => handleBrowserRequest(JSON.stringify({ type: 'request',
    id: 1, action: 'previewPdf', body }), { client, cwd: '/project', connected: true, signal: signal.signal });
  return { bytes, transfer, client, signal, send };
}

it('opens native file-browser PDFs using preview permission independently of download permission', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 100, fileDownloadMaxMb: 1 });
  const { bytes, transfer, send } = fixture();
  const reply = await send({ path, token, cwd: '/other', maxBytes: Number.MAX_SAFE_INTEGER });
  expect(reply?.error).toBeUndefined();
  expect((reply?.data as { data: string }).data).toBe(fromByteArray(bytes));
  expect(transfer.open).toHaveBeenCalledExactlyOnceWith({ cwd: '/project', path, scope: 'project',
    transferId: token, filePreview: 'pdf' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(transfer.read.mock.calls[0][0]).toMatchObject({ threadId: token, id, preview: 'pdf' });
  expect(transfer.close).toHaveBeenCalledExactlyOnceWith(token, id);
});

it('enforces the host Admin limit before reading bytes and releases the handle', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 1, fileDownloadMaxMb: 100 });
  const { send, transfer } = fixture();
  expect(await send()).toMatchObject({ error: expect.any(String) });
  expect(transfer.read).not.toHaveBeenCalled();
  expect(transfer.close).toHaveBeenCalledExactlyOnceWith(token, id);
});

it('stops an in-progress preview when the Admin limit decreases', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 100 });
  const { send, transfer } = fixture();
  transfer.read.mockImplementationOnce(async ({ offset, length }) => {
    setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 1 });
    return { offset, data: fromByteArray(new Uint8Array(length)) };
  });
  expect(await send()).toMatchObject({ error: expect.any(String) });
  expect(transfer.close).toHaveBeenCalledExactlyOnceWith(token, id);
});

it('retains unrestricted direct preview while preventing forged modes, paths and transfer IDs', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 1 });
  const { client, send, transfer } = fixture();
  expect(await send({ path, token, mode: 'direct' })).toMatchObject({ error: expect.any(String) });
  transfer.open.mockClear();
  for (const change of [{ path: '/other/a.pdf' }, { path: '/project/../private.pdf' },
    { path: '/project/a.zip' }, { token: 'invalid' }]) {
    expect(await send({ path, token, ...change })).toMatchObject({ error: expect.any(String) });
  }
  expect(transfer.open).not.toHaveBeenCalled();
  client.previewMode = 'direct';
  expect(await send()).toHaveProperty('data');
});

it('releases a pending remote handle after its native preview screen closes', async () => {
  const { send, signal, transfer } = fixture(16);
  let opened!: (value: { id: string; name: string; mimeType: string; size: number }) => void;
  transfer.open.mockImplementationOnce(() => new Promise(resolve => { opened = resolve; }));
  const reply = send();
  signal.abort();
  opened({ id, name: 'paper.pdf', mimeType: 'application/pdf', size: 16 });
  expect(await reply).toMatchObject({ error: expect.any(String) });
  await vi.waitFor(() => expect(transfer.close).toHaveBeenCalledExactlyOnceWith(token, id));
  expect(transfer.read).not.toHaveBeenCalled();
});
