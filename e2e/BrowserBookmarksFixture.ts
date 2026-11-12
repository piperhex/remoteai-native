import { randomUUID } from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { BookmarkChannel } from '../vendor/shared/browser/bookmarks/channel';
import type { BookmarkDocument } from '../vendor/shared/browser/bookmarks/model';

const initial: BookmarkDocument = { revision: 1, entries: [
  { id: 'pc-link', kind: 'link', title: 'PC bookmark', url: 'http://127.0.0.1:18406/', parentId: '', position: 0 },
  { id: 'pc-folder', kind: 'folder', title: 'PC folder', url: '', parentId: '', position: 1 },
  { id: 'pc-nested', kind: 'link', title: 'PC nested', url: 'http://127.0.0.1:18406/next',
    parentId: 'pc-folder', position: 0 },
] };
let document: BookmarkDocument = JSON.parse(Storage.getItemSync('browser-fixture:document') ?? 'null') ?? initial;
export const bookmarkFixture = new BookmarkChannel(frame => {
  queueMicrotask(() => {
    const incoming = frame.bookmarks as BookmarkDocument | undefined;
    const accepted = !!incoming && incoming.revision === document.revision;
    if (accepted) {
      document = { revision: document.revision + 1, entries: incoming.entries };
      Storage.setItemSync('browser-fixture:document', JSON.stringify(document));
    }
    bookmarkFixture.receive({ type: 'bookmarks', id: frame.id, document, accepted });
  });
  return true;
}, randomUUID);
bookmarkFixture.ready(true);

export function updatePcBookmark() {
  document = { revision: document.revision + 1, entries: document.entries.map(entry => entry.id === 'pc-link'
    ? { ...entry, title: 'PC updated bookmark' } : entry) };
  Storage.setItemSync('browser-fixture:document', JSON.stringify(document));
  bookmarkFixture.receive({ type: 'bookmarks', document });
}
