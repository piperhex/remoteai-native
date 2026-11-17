import type { Thread } from '../../conversation/types';

export const SUMMARY_PREVIEW_LIMIT = 240;
const SUMMARY_TITLE_LIMIT = 500;

/** Explicit allowlist: transcript, tool output and token accounting never enter list snapshots. */
export function threadSummary(thread: Thread): Thread {
  return { id: thread.id, name: thread.name?.slice(0, SUMMARY_TITLE_LIMIT) ?? null,
    preview: (thread.preview ?? '').slice(0, SUMMARY_PREVIEW_LIMIT), cwd: thread.cwd,
    updatedAt: thread.updatedAt, ...(thread.status ? { status: { type: thread.status.type } } : {}) };
}
