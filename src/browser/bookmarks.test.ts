import { afterEach, expect, it, vi } from 'vitest';
import { BookmarkChannel } from '../../vendor/shared/browser/bookmarks/channel';
import { BookmarkStore } from '../../vendor/shared/browser/bookmarks/store';
import type { BookmarkDocument } from '../../vendor/shared/browser/bookmarks/model';

afterEach(() => vi.unstubAllGlobals());

it('uses native request IDs and shares PC bookmarks, broadcasts and offline edits through the account channel', async () => {
  vi.stubGlobal('crypto', undefined);
  let sequence = 0;
  let document: BookmarkDocument = { revision: 0, entries: [] };
  const channels: BookmarkChannel[] = [];
  const connect = () => {
    const channel = new BookmarkChannel(frame => {
      queueMicrotask(() => {
        const incoming = frame.bookmarks as BookmarkDocument | undefined;
        const accepted = !!incoming && incoming.revision === document.revision;
        if (accepted) document = { revision: document.revision + 1, entries: incoming.entries };
        channel.receive({ type: 'bookmarks', id: frame.id, accepted, document });
        if (accepted) channels.filter(peer => peer !== channel && peer.available)
          .forEach(peer => peer.receive({ type: 'bookmarks', document }));
      });
      return true;
    }, () => `native-${++sequence}`);
    channels.push(channel); channel.ready(true); return channel;
  };
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  const pc = new BookmarkStore('account', undefined, connect());
  const mobileChannel = connect();
  const mobile = new BookmarkStore('account', storage, mobileChannel);
  const stops = [pc.start(), mobile.start()];
  try {
    const entry = { id: 'guide', title: 'PC guide', kind: 'link' as const,
      url: 'https://example.test/guide', parentId: '', position: 0 };
    pc.save(entry);
    await vi.waitFor(() => expect(mobile.snapshot().entries).toEqual([entry]));
    mobileChannel.disconnect(); mobile.save({ ...entry, title: 'Mobile edit' });
    expect(new BookmarkStore('account', storage).snapshot().entries[0].title).toBe('Mobile edit');
    expect(new BookmarkStore('another-account', storage).snapshot().entries).toEqual([]);
    mobileChannel.ready(true);
    await vi.waitFor(() => expect(pc.snapshot().entries[0].title).toBe('Mobile edit'));
    expect(sequence).toBeGreaterThan(0);
  } finally { stops.forEach(stop => stop()); channels.forEach(channel => channel.disconnect()); }
});
