import { afterEach, expect, it, vi } from 'vitest';
import { previewAttachment } from '../../vendor/shared/lounge/previewAttachment';
import type { LoungeAttachmentManager } from '../../vendor/shared/lounge/attachmentManager';
import { DEFAULT_CHAT_POLICY, MIB, setChatPolicy, setChatConnectionMode }
  from '../../vendor/shared/remote-chat/policy';
import { translateMessage } from '../../vendor/shared/localization/messages';

afterEach(() => { setChatConnectionMode('offline'); setChatPolicy(DEFAULT_CHAT_POLICY); });

it('uses the Admin file preview setting before allocating or transferring mobile PDF attachments', async () => {
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 1, fileDownloadMaxMb: 100 });
  const download = vi.fn();
  const attachments = { download } as unknown as LoungeAttachmentManager;
  const file = { id: 'paper', device: 'sender', name: 'paper.PDF', kind: 'file' as const,
    mime: 'application/pdf', size: 2 * MIB };
  const options = { file, attachments, signal: new AbortController().signal, progress: vi.fn() };
  await expect(previewAttachment(options)).rejects.toMatchObject({ code: 'PREVIEW_UNAVAILABLE' });
  expect(download).not.toHaveBeenCalled();
  setChatConnectionMode('direct');
  await expect(previewAttachment(options)).rejects.toMatchObject({ code: 'PREVIEW_UNAVAILABLE' });
  expect(download).not.toHaveBeenCalled();
});

it('allows files above the old hard limit when Admin permits them', async () => {
  const { checkPreviewSize } = await import('../../vendor/shared/file-preview/kinds');
  setChatPolicy({ ...DEFAULT_CHAT_POLICY, filePreviewMaxMb: 200, fileDownloadMaxMb: 1 });
  expect(() => checkPreviewSize(100 * MIB, 'paper.pdf', 'relay')).not.toThrow();
  expect(() => checkPreviewSize(200 * MIB + 1, 'paper.pdf', 'relay')).toThrow();
});

it.each(['zh', 'en', 'ja', 'ru'] as const)('ships PDF navigation labels in the native language package: %s', language => {
  for (const key of ['client.filePreview.pdfNavigation', 'client.filePreview.pdfOutline',
    'client.filePreview.pdfPageNumber'] as const) {
    expect(translateMessage(language, key)).not.toBe(key);
  }
});
